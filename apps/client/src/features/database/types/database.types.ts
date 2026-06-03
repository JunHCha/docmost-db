import { IPage } from "@/features/page/types/page.types.ts";

export type PropertyType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url"
  | "relation";

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

export interface IListRowsParams {
  databaseId: string;
}

export interface ICreateRowParams {
  databaseId: string;
  title?: string;
  icon?: string;
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
