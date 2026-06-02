import api from "@/lib/api-client";
import {
  ICreateDatabaseParams,
  ICreateDatabaseResponse,
} from "@/features/database/types/database.types.ts";

export async function createDatabase(
  data: ICreateDatabaseParams,
): Promise<ICreateDatabaseResponse> {
  const req = await api.post<ICreateDatabaseResponse>("/databases/create", data);
  return req.data;
}
