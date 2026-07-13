import { useMemo, useState } from "react";
import type { Editor, Range } from "@tiptap/core";
import { v7 as uuid7 } from "uuid";
import { modals } from "@mantine/modals";
import { useQuery } from "@tanstack/react-query";
import {
  Group,
  Loader,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from "@mantine/core";
import { IconSearch, IconTable } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { listBases } from "@/ee/base/services/base-service";
import { getPageById } from "@/features/page/services/page-service";
import i18n from "@/i18n.ts";

// Fork: embed an EXISTING base as a linked inline view. Upstream's slash
// commands only create brand-new bases; this picker inserts a base node
// pointing at a picked base, with a fresh embedId so the block gets its
// own view scope.
function LinkedBasePickerBody({
  editor,
  range,
  onDone,
}: {
  editor: Editor;
  range?: Range;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const hostPageId = (editor.storage as any)?.pageId as string | undefined;

  const { data: hostPage } = useQuery({
    queryKey: ["pages", hostPageId],
    queryFn: () => getPageById({ pageId: hostPageId! }),
    enabled: !!hostPageId,
    staleTime: 60_000,
  });

  const { data: basesPage, isLoading } = useQuery({
    queryKey: ["bases", "space", hostPage?.spaceId],
    queryFn: () => listBases(hostPage!.spaceId, { limit: 100 }),
    enabled: !!hostPage?.spaceId,
    staleTime: 30_000,
  });

  const bases = useMemo(() => {
    const items = basesPage?.items ?? [];
    const query = search.trim().toLowerCase();
    const filtered = query
      ? items.filter((b) =>
          (b.name || "Untitled base").toLowerCase().includes(query),
        )
      : items;
    // Embedding the host base into itself renders recursively; skip it.
    return filtered.filter((b) => b.id !== hostPageId);
  }, [basesPage?.items, search, hostPageId]);

  const insert = (basePageId: string) => {
    onDone();
    const chain = editor.chain().focus();
    if (range) chain.deleteRange(range);
    chain
      .insertBaseEmbed({ pageId: basePageId, embedId: uuid7() })
      .run();
  };

  return (
    <Stack gap="xs">
      <TextInput
        data-autofocus
        placeholder={t("Search bases")}
        leftSection={<IconSearch size={14} />}
        value={search}
        onChange={(e) => setSearch(e.currentTarget.value)}
        size="sm"
      />
      {isLoading ? (
        <Group justify="center" p="md">
          <Loader size="sm" />
        </Group>
      ) : bases.length === 0 ? (
        <Text c="dimmed" size="sm" p="xs">
          {t("No bases found")}
        </Text>
      ) : (
        <Stack gap={2} mah={320} style={{ overflowY: "auto" }}>
          {bases.map((base) => (
            <UnstyledButton
              key={base.id}
              onClick={() => insert(base.id)}
              px="xs"
              py={6}
              style={{ borderRadius: "var(--mantine-radius-sm)" }}
              className="mantine-focus-auto"
              data-hover-highlight
            >
              <Group gap={8} wrap="nowrap">
                <IconTable size={16} opacity={0.7} />
                <Text size="sm" truncate>
                  {base.icon ? `${base.icon} ` : ""}
                  {base.name || t("Untitled base")}
                </Text>
              </Group>
            </UnstyledButton>
          ))}
        </Stack>
      )}
    </Stack>
  );
}

export function openLinkedBasePicker(editor: Editor, range?: Range): void {
  const modalId = "linked-base-picker";
  modals.open({
    modalId,
    title: i18n.t("Link a base"),
    size: 420,
    children: (
      <LinkedBasePickerBody
        editor={editor}
        range={range}
        onDone={() => modals.close(modalId)}
      />
    ),
  });
}
