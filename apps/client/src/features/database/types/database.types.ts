import { IPage } from "@/features/page/types/page.types.ts";

export type PropertyType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url"
  | "relation"
  | "person"
  // Computed system columns (issue #128): read-only, values synthesized by the
  // server from each row page's metadata. Not user-creatable.
  | "created_by"
  | "created_time"
  | "last_edited_time";

const COMPUTED_PROPERTY_TYPES: readonly PropertyType[] = [
  "created_by",
  "created_time",
  "last_edited_time",
];

// Computed system columns are read-only and derived from page metadata; the UI
// hides them from type pickers and filters. Keep in sync with the server
// property-config.ts.
export function isComputedPropertyType(type: PropertyType): boolean {
  return COMPUTED_PROPERTY_TYPES.includes(type);
}

export interface IPropertyValue {
  type: PropertyType;
  value: any;
}

export interface IDatabase {
  id: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface IDatabaseListItem {
  id: string;
  pageId: string;
  title: string | null;
  icon: string | null;
}

export interface IListDatabasesParams {
  spaceId: string;
}

export interface IDatabaseProperty {
  id: string;
  databaseId: string;
  name: string;
  type: PropertyType;
  config: Record<string, unknown>;
  position: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

export interface IDatabasePropertyValue {
  id: string;
  pageId: string;
  propertyId: string;
  value: IPropertyValue;
  createdAt: Date;
  updatedAt: Date;
}

export interface IDatabaseRow {
  row: IPage;
  values: IDatabasePropertyValue[];
}

export interface ICreateDatabaseParams {
  spaceId: string;
  title?: string;
  icon?: string;
  parentPageId?: string;
}

export interface ICreateDatabaseResponse {
  database: IDatabase;
  page: IPage;
}

export interface IGetDatabaseInfoParams {
  pageId?: string;
  databaseId?: string;
}

export interface IDatabaseInfoResponse {
  // null when the addressed page is a plain document, not a database. The
  // server answers 200 with null rather than 404 (see database.service info).
  database: IDatabase | null;
  page: IPage | null;
}

export interface IListPropertiesParams {
  databaseId: string;
}

export interface ICreatePropertyParams {
  databaseId: string;
  name: string;
  type: PropertyType;
  config?: Record<string, unknown>;
}

export interface IUpdatePropertyParams {
  propertyId: string;
  name?: string;
  type?: PropertyType;
  config?: Record<string, unknown>;
}

export interface IReorderPropertyParams {
  propertyId: string;
  afterPropertyId?: string;
}

export interface IDeletePropertyParams {
  propertyId: string;
}

export interface IViewColumnConfig {
  propertyId: string;
  visible: boolean;
  width?: number;
}

// Filter operators — kept in sync with the server `filter-ops.ts` whitelist.
export type FilterOp =
  | "eq"
  | "neq"
  | "contains"
  | "not_contains"
  | "gt"
  | "lt"
  | "gte"
  | "lte"
  | "is_empty"
  | "is_not_empty";

export interface IFilterCondition {
  propertyId: string;
  op: FilterOp;
  // Raw comparison value (not the tagged {type,value}); omitted for empty ops.
  value?: unknown;
}

export interface ISortCondition {
  propertyId: string;
  direction: "asc" | "desc";
}

export interface IDatabaseViewConfig {
  columns?: IViewColumnConfig[];
  // Resizable width (px) of the leading Title column. The Title is not a
  // property, so its width is stored here rather than in `columns`.
  titleWidth?: number;
  filters?: IFilterCondition[];
  sorts?: ISortCondition[];
  // Board view: the select / multi_select property whose options become columns.
  groupByPropertyId?: string;
  // Calendar view: the single date property whose value anchors each row's bar
  // on the month grid. Auto-adopted from the first date column when unset.
  datePropertyId?: string;
  // Calendar view (optional): a second date property read as each bar's end.
  // When set (and not before the start), the bar spans start..end across the
  // grid; unset means every bar stays a single day at datePropertyId.
  endDatePropertyId?: string;
  // @deprecated Board cards now follow the view's visible columns; kept only so
  // older stored configs still type-check. No longer read or written by the UI.
  cardProperties?: string[];
  [key: string]: unknown;
}

export interface IDatabaseView {
  id: string;
  databaseId: string;
  name: string;
  type: string;
  config: IDatabaseViewConfig;
  isDefault: boolean;
  position: string;
  // The embed scope that owns this view (issue #39); null for the original
  // database's views.
  embedId: string | null;
  // The user that owns this personal view; null for shared views.
  ownerUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IListViewsParams {
  databaseId: string;
  embedId?: string;
  // Host page of an embed. Lets the server scope its save-time orphan cleanup
  // and seed embed views with a source_page_id. Omitted for the original DB.
  pageId?: string;
}

export interface ICreateViewParams {
  databaseId: string;
  name: string;
  type?: string;
  config?: IDatabaseViewConfig;
  embedId?: string;
  // Host page of an embed view; see IListViewsParams.pageId.
  pageId?: string;
  visibility?: "personal" | "shared";
}

export interface IUpdateViewParams {
  viewId: string;
  name?: string;
  config?: IDatabaseViewConfig;
}

export interface IViewIdParams {
  viewId: string;
}

export interface IListRowsParams {
  databaseId: string;
  filters?: IFilterCondition[];
  sorts?: ISortCondition[];
}

export interface IDeleteRowsParams {
  databaseId: string;
  pageIds: string[];
}

export interface ICreateRowParams {
  databaseId: string;
  title?: string;
  icon?: string;
  // When given, the server applies the template's propertyValues + content to
  // the new row atomically (issue #91). Mutually independent of title/icon.
  templateId?: string;
  // Tagged seed values keyed by propertyId, derived from the active view's
  // filters so a new row survives the filter (issue #103). Template values win
  // on conflict; the server only applies these to properties the template left
  // untouched.
  initialValues?: Record<string, IPropertyValue>;
}

export interface IDatabaseTemplate {
  id: string;
  databaseId: string;
  name: string;
  icon: string | null;
  // Preset property values keyed by propertyId, each a tagged IPropertyValue
  // (same shape setValue stores).
  propertyValues: Record<string, IPropertyValue> | null;
  // Prosemirror document JSON applied as the new row's body.
  content: Record<string, unknown> | null;
  position: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IListTemplatesParams {
  databaseId: string;
}

export interface ICreateTemplateParams {
  databaseId: string;
  name: string;
  icon?: string;
  propertyValues?: Record<string, IPropertyValue>;
  content?: Record<string, unknown>;
}

export interface IUpdateTemplateParams {
  templateId: string;
  name?: string;
  icon?: string;
  propertyValues?: Record<string, IPropertyValue>;
  content?: Record<string, unknown>;
}

export interface ITemplateIdParams {
  templateId: string;
}

export interface ISetValueParams {
  pageId: string;
  propertyId: string;
  value: IPropertyValue;
}

export interface IClearValueParams {
  pageId: string;
  propertyId: string;
}
