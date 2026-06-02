import api from "@/lib/api-client";
import {
  ICreateDatabaseParams,
  ICreateDatabaseResponse,
  IDatabase,
  IDatabaseInfoParams,
  IDatabaseInfoResponse,
  IDatabaseListParams,
} from "@/features/database/types/database.types.ts";

export async function createDatabase(
  data: ICreateDatabaseParams,
): Promise<ICreateDatabaseResponse> {
  const req = await api.post<ICreateDatabaseResponse>("/databases/create", data);
  return req.data;
}

export async function getDatabaseInfo(
  data: IDatabaseInfoParams,
): Promise<IDatabaseInfoResponse> {
  const req = await api.post<IDatabaseInfoResponse>("/databases/info", data);
  return req.data;
}

export async function getDatabaseList(
  data: IDatabaseListParams,
): Promise<IDatabase[]> {
  const req = await api.post<IDatabase[]>("/databases/list", data);
  return req.data;
}
