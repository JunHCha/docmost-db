import { IPage } from "@/features/page/types/page.types.ts";

export interface IDatabase {
  id: string;
  pageId: string;
  spaceId: string;
  workspaceId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
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
