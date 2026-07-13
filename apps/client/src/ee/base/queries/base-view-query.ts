import { useMutation, useQuery, UseQueryResult } from "@tanstack/react-query";
import {
  createView,
  updateView,
  deleteView,
  listViews,
  setDefaultView,
} from "@/ee/base/services/base-service";
import {
  IBase,
  IBaseView,
  CreateViewInput,
  UpdateViewInput,
  DeleteViewInput,
  SetDefaultViewInput,
  ViewConfig,
  ViewConfigPatch,
} from "@/ee/base/types/base.types";
import { notifications } from "@mantine/notifications";
import { queryClient } from "@/main";
import { useTranslation } from "react-i18next";
import { getApiErrorMessage } from "@/lib/api-error";

function applyConfigPatch(
  existing: ViewConfig | undefined,
  patch: ViewConfigPatch | undefined,
): ViewConfig {
  const merged: Record<string, unknown> = { ...(existing ?? {}) };
  for (const [key, value] of Object.entries(patch ?? {})) {
    if (value === null) delete merged[key];
    else if (value !== undefined) merged[key] = value;
  }
  return merged as ViewConfig;
}

// Fork: embed-scoped views live in their own query (["base-views",
// pageId, embedId]); the base's own views ride in ["bases", pageId].
export function baseViewsQueryKey(pageId: string, embedId: string) {
  return ["base-views", pageId, embedId] as const;
}

export function useBaseViewsQuery(
  pageId: string | undefined,
  embedId: string | undefined,
  sourcePageId?: string | null,
): UseQueryResult<IBaseView[], Error> {
  return useQuery({
    queryKey: baseViewsQueryKey(pageId ?? "", embedId ?? ""),
    queryFn: () => listViews(pageId!, embedId!, sourcePageId),
    enabled: !!pageId && !!embedId,
    staleTime: 5 * 60 * 1000,
  });
}

// Applies an updater to whichever cache holds the scope's views.
function patchViewCaches(
  pageId: string,
  embedId: string | null | undefined,
  update: (views: IBaseView[]) => IBaseView[],
) {
  if (embedId) {
    queryClient.setQueryData<IBaseView[]>(
      baseViewsQueryKey(pageId, embedId),
      (old) => (old ? update(old) : old),
    );
    return;
  }
  queryClient.setQueryData<IBase>(["bases", pageId], (old) => {
    if (!old) return old;
    return { ...old, views: update(old.views) };
  });
}

function snapshotViews(
  pageId: string,
  embedId: string | null | undefined,
): IBaseView[] | undefined {
  if (embedId) {
    return queryClient.getQueryData<IBaseView[]>(
      baseViewsQueryKey(pageId, embedId),
    );
  }
  return queryClient.getQueryData<IBase>(["bases", pageId])?.views;
}

function restoreViews(
  pageId: string,
  embedId: string | null | undefined,
  views: IBaseView[] | undefined,
) {
  if (!views) return;
  patchViewCaches(pageId, embedId, () => views);
}

export function useCreateViewMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseView, Error, CreateViewInput>({
    mutationFn: (data) => createView(data),
    onSuccess: (newView, variables) => {
      patchViewCaches(newView.pageId, variables.embedId, (views) => [
        ...views,
        newView,
      ]);
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to create view")),
        color: "red",
      });
    },
  });
}

export function useUpdateViewMutation() {
  const { t } = useTranslation();
  return useMutation<
    IBaseView,
    Error,
    UpdateViewInput,
    { previous: IBaseView[] | undefined }
  >({
    mutationFn: (data) => updateView(data),
    onMutate: async (variables) => {
      await queryClient.cancelQueries({
        queryKey: variables.embedId
          ? baseViewsQueryKey(variables.pageId, variables.embedId)
          : ["bases", variables.pageId],
      });

      const previous = snapshotViews(variables.pageId, variables.embedId);

      patchViewCaches(variables.pageId, variables.embedId, (views) =>
        views.map((v) =>
          v.id === variables.viewId
            ? {
                ...v,
                ...(variables.name !== undefined && { name: variables.name }),
                ...(variables.type !== undefined && { type: variables.type }),
                ...(variables.config !== undefined && {
                  config: applyConfigPatch(v.config, variables.config),
                }),
                ...(variables.position !== undefined && {
                  position: variables.position,
                }),
              }
            : v,
        ),
      );

      return { previous };
    },
    onError: (error, variables, context) => {
      restoreViews(variables.pageId, variables.embedId, context?.previous);
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update view")),
        color: "red",
      });
    },
    onSuccess: (updatedView, variables) => {
      patchViewCaches(updatedView.pageId, variables.embedId, (views) =>
        views.map((v) => (v.id === updatedView.id ? updatedView : v)),
      );
    },
  });
}

export function useDeleteViewMutation() {
  const { t } = useTranslation();
  return useMutation<void, Error, DeleteViewInput>({
    mutationFn: (data) => deleteView(data),
    onSuccess: (_, variables) => {
      patchViewCaches(variables.pageId, variables.embedId, (views) =>
        views.filter((v) => v.id !== variables.viewId),
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to delete view")),
        color: "red",
      });
    },
  });
}

export function useSetDefaultViewMutation() {
  const { t } = useTranslation();
  return useMutation<IBaseView, Error, SetDefaultViewInput>({
    mutationFn: (data) => setDefaultView(data),
    onSuccess: (updatedView, variables) => {
      // Only one default per scope; personal defaults never displace
      // shared ones (they live in different owner scopes server-side,
      // but the tab strip shows both, so clear matching-owner flags).
      patchViewCaches(variables.pageId, variables.embedId, (views) =>
        views.map((v) =>
          v.id === updatedView.id
            ? updatedView
            : (v.ownerUserId ?? null) === (updatedView.ownerUserId ?? null)
              ? { ...v, isDefault: false }
              : v,
        ),
      );
    },
    onError: (error) => {
      notifications.show({
        message: getApiErrorMessage(error, t("Failed to update view")),
        color: "red",
      });
    },
  });
}
