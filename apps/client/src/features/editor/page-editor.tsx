import "@/features/editor/styles/index.css";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { IndexeddbPersistence } from "y-indexeddb";
import * as Y from "yjs";
import {
  HocuspocusProvider,
  onStatusParameters,
  WebSocketStatus,
  HocuspocusProviderWebsocket,
  onSyncedParameters,
  onStatelessParameters,
} from "@hocuspocus/provider";
import {
  Editor,
  EditorContent,
  EditorProvider,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import {
  collabExtensions,
  mainExtensions,
} from "@/features/editor/extensions/extensions";
import { useAtom, useAtomValue } from "jotai";
import useCollaborationUrl from "@/features/editor/hooks/use-collaboration-url";
import { currentUserAtom } from "@/features/user/atoms/current-user-atom";
import {
  currentPageEditModeAtom,
  pageEditorAtom,
  yjsConnectionStatusAtom,
} from "@/features/editor/atoms/editor-atoms";
import { asideStateAtom } from "@/components/layouts/global/hooks/atoms/sidebar-atom";
import {
  activeCommentIdAtom,
  showCommentPopupAtom,
  showReadOnlyCommentPopupAtom,
} from "@/features/comment/atoms/comment-atom";
import CommentDialog from "@/features/comment/components/comment-dialog";
import { EditorBubbleMenu } from "@/features/editor/components/bubble-menu/bubble-menu";
import { ReadonlyBubbleMenu } from "@/features/editor/components/bubble-menu/readonly-bubble-menu";
import TableMenu from "@/features/editor/components/table/table-menu.tsx";
import { TableHandlesLayer } from "@/features/editor/components/table/handle/table-handles-layer";
import ImageMenu from "@/features/editor/components/image/image-menu.tsx";
import CalloutMenu from "@/features/editor/components/callout/callout-menu.tsx";
import VideoMenu from "@/features/editor/components/video/video-menu.tsx";
import PdfMenu from "@/features/editor/components/pdf/pdf-menu.tsx";
import SubpagesMenu from "@/features/editor/components/subpages/subpages-menu.tsx";
import {
  handleFileDrop,
  handlePaste,
} from "@/features/editor/components/common/editor-paste-handler.tsx";
import ExcalidrawMenu from "./components/excalidraw/excalidraw-menu-lazy";
import DrawioMenu from "./components/drawio/drawio-menu";
import { useCollabToken } from "@/features/auth/queries/auth-query.tsx";
import SearchAndReplaceDialog from "@/features/editor/components/search-and-replace/search-and-replace-dialog.tsx";
import { useDebouncedCallback, useDocumentVisibility } from "@mantine/hooks";
import { useIdle } from "@/hooks/use-idle.ts";
import { queryClient } from "@/main.tsx";
import { IPage } from "@/features/page/types/page.types.ts";
import { useParams } from "react-router-dom";
import { extractPageSlugId, platformModifierKey } from "@/lib";
import { FIVE_MINUTES } from "@/lib/constants.ts";
import { PageEditMode } from "@/features/user/types/user.types.ts";
import { jwtDecode } from "jwt-decode";
import { searchSpotlight } from "@/features/search/constants.ts";
import { useEditorScroll } from "./hooks/use-editor-scroll";
import { EditorAiMenu } from "@/ee/ai/components/editor/ai-menu/ai-menu";
import { EditorLinkMenu } from "@/features/editor/components/link/link-menu";
import ColumnsMenu from "@/features/editor/components/columns/columns-menu.tsx";
import { TransclusionLookupProvider } from "@/features/editor/components/transclusion/transclusion-lookup-context";
import { useTranslation } from "react-i18next";
import { DatabasePickerModal } from "@/features/database/components/embed/database-picker-modal.tsx";
import { usePageQuery } from "@/features/page/queries/page-query.ts";

interface PageEditorProps {
  pageId: string;
  editable: boolean;
  content: any;
  canComment?: boolean;
  // Peek mode: the editor is mounted for a page OTHER than the current route
  // (e.g. a relation target previewed in an aside/modal, #94). In this mode the
  // editor must not couple to the route or hijack global single-editor state:
  // it reads slugId from props instead of useParams, skips setting the global
  // pageEditorAtom / asideState, and stays editable regardless of the global
  // page edit-mode toggle. Collab still syncs to the real doc (page.${pageId}).
  embedded?: boolean;
  // The page's own slugId. Required in embedded mode since useParams() would
  // resolve to the host route's page, not this one. Ignored when not embedded.
  slugId?: string;
}

export default function PageEditor({
  pageId,
  editable,
  content,
  canComment,
  embedded = false,
  slugId: slugIdProp,
}: PageEditorProps) {
  const { t } = useTranslation();
  const collaborationURL = useCollaborationUrl();
  const isComponentMounted = useRef(false);
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    isComponentMounted.current = true;
  }, []);

  const [currentUser] = useAtom(currentUserAtom);
  const [, setEditor] = useAtom(pageEditorAtom);
  const [, setAsideState] = useAtom(asideStateAtom);
  const [, setActiveCommentId] = useAtom(activeCommentIdAtom);
  const [showCommentPopup, setShowCommentPopup] = useAtom(showCommentPopupAtom);
  const [showReadOnlyCommentPopup] = useAtom(showReadOnlyCommentPopupAtom);
  const [isLocalSynced, setIsLocalSynced] = useState(false);
  const [isRemoteSynced, setIsRemoteSynced] = useState(false);
  const [yjsConnectionStatus, setYjsConnectionStatus] = useAtom(
    yjsConnectionStatusAtom,
  );
  const menuContainerRef = useRef(null);
  const { data: collabQuery, refetch: refetchCollabToken } = useCollabToken();
  const { isIdle, resetIdle } = useIdle(FIVE_MINUTES, { initialState: false });
  const documentState = useDocumentVisibility();
  const { pageSlug } = useParams();
  // In embedded (peek) mode the route points at the HOST page, not this one, so
  // the page's slugId is passed in explicitly.
  const slugId = embedded ? slugIdProp : extractPageSlugId(pageSlug);
  // Host space of the current page, used to scope the database picker list.
  const { data: page } = usePageQuery({ pageId: slugId });
  const [dbPickerOpened, setDbPickerOpened] = useState(false);
  const currentPageEditMode = useAtomValue(currentPageEditModeAtom);
  const canScroll = useCallback(
    () => Boolean(isComponentMounted.current && editorRef.current),
    [isComponentMounted],
  );
  const { handleScrollTo } = useEditorScroll({ canScroll });
  // Providers only created once per pageId
  const providersRef = useRef<{
    local: IndexeddbPersistence;
    remote: HocuspocusProvider;
    socket: HocuspocusProviderWebsocket;
  } | null>(null);
  const [providersReady, setProvidersReady] = useState(false);

  useEffect(() => {
    if (!providersRef.current) {
      const documentName = `page.${pageId}`;
      const ydoc = new Y.Doc();
      const local = new IndexeddbPersistence(documentName, ydoc);
      const socket = new HocuspocusProviderWebsocket({
        url: collaborationURL,
      });
      const onLocalSyncedHandler = () => {
        setIsLocalSynced(true);
      };
      const onStatusHandler = (event: onStatusParameters) => {
        setYjsConnectionStatus(event.status);
      };
      const onSyncedHandler = (event: onSyncedParameters) => {
        setIsRemoteSynced(event.state);
      };
      const onStatelessHandler = ({ payload }: onStatelessParameters) => {
        try {
          const message = JSON.parse(payload);
          if (message?.type !== "page.updated" || !message.updatedAt) return;
          const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);
          if (pageData) {
            queryClient.setQueryData(["pages", slugId], {
              ...pageData,
              updatedAt: message.updatedAt,
              ...(message.lastUpdatedBy && {
                lastUpdatedBy: message.lastUpdatedBy,
              }),
            });
          }
        } catch {
          // ignore unrelated stateless messages
        }
      };
      const onAuthenticationFailedHandler = () => {
        const payload = jwtDecode(collabQuery?.token);
        const now = Date.now().valueOf() / 1000;
        const isTokenExpired = now >= payload.exp;
        if (isTokenExpired) {
          refetchCollabToken().then((result) => {
            if (result.data?.token) {
              socket.disconnect();
              setTimeout(() => {
                remote.configuration.token = result.data.token;
                socket.connect();
              }, 100);
            }
          });
        }
      };
      const remote = new HocuspocusProvider({
        websocketProvider: socket,
        name: documentName,
        document: ydoc,
        token: collabQuery?.token,
        onAuthenticationFailed: onAuthenticationFailedHandler,
        onStatus: onStatusHandler,
        onSynced: onSyncedHandler,
        onStateless: onStatelessHandler,
      });

      local.on("synced", onLocalSyncedHandler);
      providersRef.current = { socket, local, remote };
      setProvidersReady(true);
    } else {
      setProvidersReady(true);
    }
    // Only destroy on final unmount
    return () => {
      providersRef.current?.socket.destroy();
      providersRef.current?.remote.destroy();
      providersRef.current?.local.destroy();
      providersRef.current = null;
    };
  }, [pageId]);

  // Only connect/disconnect on tab/idle, not destroy
  useEffect(() => {
    if (!providersReady || !providersRef.current) return;
    const socket = providersRef.current.socket;

    if (
      isIdle &&
      documentState === "hidden" &&
      yjsConnectionStatus === WebSocketStatus.Connected
    ) {
      socket.disconnect();
      return;
    }
    if (
      documentState === "visible" &&
      yjsConnectionStatus === WebSocketStatus.Disconnected
    ) {
      resetIdle();
      socket.connect();
    }
  }, [isIdle, documentState, providersReady, resetIdle]);

  // Attach here, to make sure the connection gets properly established
  providersRef.current?.remote.attach();

  const extensions = useMemo(() => {
    if (!providersReady || !providersRef.current || !currentUser?.user) {
      return mainExtensions;
    }

    const remoteProvider = providersRef.current.remote;

    return [
      ...mainExtensions,
      ...collabExtensions(remoteProvider, currentUser?.user),
    ];
  }, [providersReady, currentUser?.user]);

  const editor = useEditor(
    {
      extensions,
      editable,
      immediatelyRender: true,
      shouldRerenderOnTransaction: false,
      editorProps: {
        scrollThreshold: 80,
        scrollMargin: 80,
        attributes: {
          "aria-label": t("Page content"),
        },
        handleDOMEvents: {
          keydown: (_view, event) => {
            if (platformModifierKey(event) && event.code === "KeyS") {
              event.preventDefault();
              return true;
            }
            if (platformModifierKey(event) && event.code === "KeyK") {
              searchSpotlight.open();
              return true;
            }
            if (["ArrowUp", "ArrowDown", "Enter"].includes(event.key)) {
              const slashCommand = document.querySelector("#slash-command");
              if (slashCommand) {
                return true;
              }
            }
            if (
              [
                "ArrowUp",
                "ArrowDown",
                "ArrowLeft",
                "ArrowRight",
                "Enter",
              ].includes(event.key)
            ) {
              const emojiCommand = document.querySelector("#emoji-command");
              if (emojiCommand) {
                return true;
              }
            }
          },
        },
        handlePaste: (_view, event) => {
          if (!editorRef.current) return false;

          return handlePaste(
            editorRef.current,
            event,
            pageId,
            currentUser?.user.id,
          );
        },
        handleDrop: (_view, event, _slice, moved) => {
          if (!editorRef.current) return false;

          return handleFileDrop(editorRef.current, event, moved, pageId);
        },
      },
      onCreate({ editor }) {
        if (editor) {
          // Don't claim the global single-editor slot in peek mode — the host
          // page's editor owns it (TOC / details / comments read from it).
          if (!embedded) {
            // @ts-ignore
            setEditor(editor);
          }
          // @ts-ignore
          editor.storage.pageId = pageId;
          handleScrollTo(editor);
          editorRef.current = editor;
        }
      },
      onUpdate({ editor }) {
        if (editor.isEmpty) return;
        const editorJson = editor.getJSON();
        //update local page cache to reduce flickers
        debouncedUpdateContent(editorJson);
      },
    },
    [pageId, editable, extensions],
  );

  const editorIsEditable = useEditorState({
    editor,
    selector: (ctx) => {
      return ctx.editor?.isEditable ?? false;
    },
  });

  // The "Database view (linked)" slash item can't insert synchronously (the
  // picker is a two-step async flow), so it dispatches this event for us to
  // open the modal (mirrors search-and-replace's openFindDialogFromEditor).
  useEffect(() => {
    const openPicker = (e: Event) => {
      // Only respond when the event targets this page (or carries no page, for
      // backward-compat), so a picker opened in one editor can't surface in
      // another mounted instance.
      const detail = (e as CustomEvent).detail;
      if (detail?.pageId && detail.pageId !== pageId) return;
      setDbPickerOpened(true);
    };
    document.addEventListener("openDatabasePickerFromEditor", openPicker);
    return () => {
      document.removeEventListener("openDatabasePickerFromEditor", openPicker);
    };
  }, [pageId]);

  const debouncedUpdateContent = useDebouncedCallback((newContent: any) => {
    const pageData = queryClient.getQueryData<IPage>(["pages", slugId]);

    if (pageData) {
      queryClient.setQueryData(["pages", slugId], {
        ...pageData,
        content: newContent,
      });
    }
  }, 3000);

  const handleActiveCommentEvent = (event) => {
    const { commentId, resolved } = event.detail;

    if (resolved) {
      return;
    }

    setActiveCommentId(commentId);
    setAsideState({ tab: "comments", isAsideOpen: true });

    //wait if aside is closed
    setTimeout(() => {
      const selector = `div[data-comment-id="${commentId}"]`;
      const commentElement = document.querySelector(selector);
      commentElement?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 400);
  };

  useEffect(() => {
    // Comments are driven through the global aside, which the peek must not
    // touch — a peek reacting to comment events would fight the host editor.
    if (embedded) return;
    document.addEventListener("ACTIVE_COMMENT_EVENT", handleActiveCommentEvent);
    return () => {
      document.removeEventListener(
        "ACTIVE_COMMENT_EVENT",
        handleActiveCommentEvent,
      );
    };
  }, [embedded]);

  useEffect(() => {
    // In peek mode this would close the very aside hosting the peek and reset
    // the host page's comment state, so skip it.
    if (embedded) return;
    setActiveCommentId(null);
    setShowCommentPopup(false);
    setAsideState({ tab: "", isAsideOpen: false });
  }, [pageId, embedded]);

  const isSynced = isLocalSynced && isRemoteSynced;

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (yjsConnectionStatus === WebSocketStatus.Connecting || !isSynced) {
        setYjsConnectionStatus(WebSocketStatus.Disconnected);
      }
    }, 7500);

    return () => clearTimeout(timeout);
  }, [yjsConnectionStatus, isSynced]);
  useEffect(() => {
    if (!editor) return;
    // Peek follows its own page-permission `editable` and ignores the global
    // read/edit toggle (which belongs to the host page).
    editor.setEditable(
      editable && (embedded || currentPageEditMode === PageEditMode.Edit),
    );
  }, [currentPageEditMode, editor, editable, embedded]);

  const hasConnectedOnceRef = useRef(false);
  const [showStatic, setShowStatic] = useState(true);

  useEffect(() => {
    if (
      !hasConnectedOnceRef.current &&
      yjsConnectionStatus === WebSocketStatus.Connected &&
      isSynced
    ) {
      hasConnectedOnceRef.current = true;
      setShowStatic(false);
    }
  }, [yjsConnectionStatus, isSynced]);

  return (
    <TransclusionLookupProvider>
      {showStatic ? (
        <EditorProvider
          editable={false}
          immediatelyRender={true}
          extensions={mainExtensions}
          content={content}
          editorProps={{
            attributes: {
              "aria-label": t("Page content"),
            },
          }}
        />
      ) : (
        <div className="editor-container" style={{ position: "relative" }}>
          <div ref={menuContainerRef}>
            <EditorContent editor={editor} />

            {editor && (
              <SearchAndReplaceDialog editor={editor} editable={editable} />
            )}

            {!embedded && editor && editorIsEditable && page?.spaceId && (
              <DatabasePickerModal
                opened={dbPickerOpened}
                spaceId={page.spaceId}
                onClose={() => setDbPickerOpened(false)}
                onConfirm={({ databaseId }) => {
                  editor.commands.insertDatabaseView({ databaseId });
                  setDbPickerOpened(false);
                }}
              />
            )}

            {editor && editorIsEditable && (
              <div>
                <EditorAiMenu editor={editor} />
                <EditorLinkMenu editor={editor} />
                <EditorBubbleMenu editor={editor} />
                <TableMenu editor={editor} />
                <TableHandlesLayer editor={editor} />
                <ImageMenu editor={editor} />
                <VideoMenu editor={editor} />
                <PdfMenu editor={editor} />
                <CalloutMenu editor={editor} />
                <SubpagesMenu editor={editor} />
                <ExcalidrawMenu editor={editor} />
                <DrawioMenu editor={editor} />
                <ColumnsMenu editor={editor} />
              </div>
            )}
            {editor &&
              !editorIsEditable &&
              (editable || canComment) &&
              providersRef.current && <ReadonlyBubbleMenu editor={editor} />}
            {showCommentPopup && (
              <CommentDialog editor={editor} pageId={pageId} />
            )}
            {showReadOnlyCommentPopup && (
              <CommentDialog editor={editor} pageId={pageId} readOnly />
            )}
          </div>
          <div
            onClick={() => editor.commands.focus("end")}
            style={{ paddingBottom: "20vh" }}
          ></div>
        </div>
      )}
    </TransclusionLookupProvider>
  );
}
