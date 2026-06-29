import { IDatabaseProperty } from "@/features/database/types/database.types.ts";

// The row's page Title is not a database property (it lives on the page, like
// titleWidth on the view config), so filtering by it uses this sentinel as the
// filter condition's propertyId. The server special-cases the same id to compare
// against pages.title. Keep in sync with the server constant in filter-ops.ts.
export const TITLE_FILTER_ID = "__title__";

export function isTitleFilterId(propertyId: string): boolean {
  return propertyId === TITLE_FILTER_ID;
}

// A synthetic text "property" representing the Title, used only to drive the
// filter builder's property dropdown / operator list / value widget through the
// normal text path. Never persisted or shown as a grid column.
export function titleFilterProperty(name: string): IDatabaseProperty {
  return {
    id: TITLE_FILTER_ID,
    databaseId: "",
    name,
    type: "text",
    config: {},
    position: "",
    createdAt: new Date(0),
    updatedAt: new Date(0),
    deletedAt: null,
  };
}
