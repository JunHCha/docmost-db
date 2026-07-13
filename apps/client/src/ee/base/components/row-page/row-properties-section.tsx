import { useCallback, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { IconPlus } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { resolveRowPage } from "@/ee/base/services/base-service";
import { useBaseQuery } from "@/ee/base/queries/base-query";
import {
  useBaseRowQuery,
  useUpdateRowMutation,
} from "@/ee/base/queries/base-row-query";
import { useBaseSocket } from "@/ee/base/hooks/use-base-socket";
import { BaseEditableProvider } from "@/ee/base/context/base-editable";
import { PropertyRow } from "@/ee/base/components/row-detail-modal/property-row";
import { CreatePropertyPopover } from "@/ee/base/components/property/create-property-popover";
import classes from "@/ee/base/styles/row-detail-modal.module.css";

// Fork: a base row's backing page shows its row properties under the
// title, Notion-style. Mounted by the page route for pages that back a
// row (resolved via /bases/rows/resolve-page; ordinary pages get null).
export function useRowPageResolveQuery(
  pageId: string | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["base-row-resolve", pageId],
    queryFn: () => resolveRowPage(pageId!),
    enabled: enabled && !!pageId,
    staleTime: 30_000,
  });
}

export function RowPropertiesSection({
  basePageId,
  rowId,
  editable,
}: {
  basePageId: string;
  rowId: string;
  editable: boolean;
}) {
  const { t } = useTranslation();
  useBaseSocket(basePageId);
  const { data: base } = useBaseQuery(basePageId);
  const { data: row } = useBaseRowQuery(basePageId, rowId, { enabled: true });
  const updateRowMutation = useUpdateRowMutation();

  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [newPropertyId, setNewPropertyId] = useState<string | null>(null);

  const updateCells = useCallback(
    (targetRowId: string, cells: Record<string, unknown>) => {
      updateRowMutation.mutate({ rowId: targetRowId, pageId: basePageId, cells });
    },
    [updateRowMutation, basePageId],
  );

  if (!base || !row) return null;
  const canEdit = editable && (base.permissions?.canEdit ?? false);

  return (
    <BaseEditableProvider editable={canEdit}>
      <div className={classes.propertyList} data-row-page-properties>
        {base.properties
          .filter((p) => !p.isPrimary)
          .map((property) => (
            <PropertyRow
              key={property.id}
              property={property}
              row={row}
              pageId={base.id}
              autoFocusValue={property.id === newPropertyId}
              onAutoFocused={() => setNewPropertyId(null)}
              menuOpened={openMenuId === property.id}
              onMenuOpenChange={(nextOpened) =>
                setOpenMenuId(nextOpened ? property.id : null)
              }
              onMenuDirtyChange={() => {}}
              onUpdate={(propertyId, value) => {
                updateCells(row.id, { [propertyId]: value });
              }}
            />
          ))}
        {canEdit && (
          <CreatePropertyPopover
            pageId={base.id}
            properties={base.properties}
            onPropertyCreated={(p) => setNewPropertyId(p.id)}
            renderTarget={(open) => (
              <button
                type="button"
                className={classes.addPropertyRow}
                onClick={open}
              >
                <span className={classes.addPropertyLabel}>
                  <IconPlus size={15} />
                  {t("Add property")}
                </span>
              </button>
            )}
          />
        )}
      </div>
    </BaseEditableProvider>
  );
}
