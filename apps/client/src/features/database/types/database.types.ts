import { IPage } from "@/features/page/types/page.types.ts";

export type DatabasePropertyType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multi_select"
  | "checkbox"
  | "url"
  | "relation";

export interface IDatabase {
  id: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date;
}

export interface IDatabaseProperty {
  id: string;
  databaseId: string;
  name: string;
  type: DatabasePropertyType;
  config: Record<string, any>;
  position: string;
  createdAt: Date;
  updatedAt: Date;
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

export interface IDatabaseInfoParams {
  databaseId: string;
}

export interface IDatabaseInfoResponse {
  database: IDatabase;
  page: IPage;
}

export interface IDatabaseListParams {
  spaceId: string;
}
