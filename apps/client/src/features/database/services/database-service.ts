import api from "@/lib/api-client";
import { IPage } from "@/features/page/types/page.types.ts";
import {
  ICreateDatabaseParams,
  ICreateDatabaseResponse,
  IClearValueParams,
  ICreatePropertyParams,
  ICreateRowParams,
  IDatabaseInfoResponse,
  IDatabaseProperty,
  IDatabasePropertyValue,
  IDatabaseRow,
  IDeletePropertyParams,
  IGetDatabaseInfoParams,
  IListPropertiesParams,
  IListRowsParams,
  IReorderPropertyParams,
  ISetValueParams,
  IUpdatePropertyParams,
} from "@/features/database/types/database.types.ts";

export async function createDatabase(
  data: ICreateDatabaseParams,
): Promise<ICreateDatabaseResponse> {
  const req = await api.post<ICreateDatabaseResponse>("/databases/create", data);
  return req.data;
}

export async function getDatabaseInfo(
  data: IGetDatabaseInfoParams,
): Promise<IDatabaseInfoResponse> {
  const req = await api.post<IDatabaseInfoResponse>("/databases/info", data);
  return req.data;
}

export async function listProperties(
  data: IListPropertiesParams,
): Promise<IDatabaseProperty[]> {
  const req = await api.post<IDatabaseProperty[]>(
    "/databases/properties/list",
    data,
  );
  return req.data;
}

export async function createProperty(
  data: ICreatePropertyParams,
): Promise<IDatabaseProperty> {
  const req = await api.post<IDatabaseProperty>(
    "/databases/properties/create",
    data,
  );
  return req.data;
}

export async function updateProperty(
  data: IUpdatePropertyParams,
): Promise<IDatabaseProperty> {
  const req = await api.post<IDatabaseProperty>(
    "/databases/properties/update",
    data,
  );
  return req.data;
}

export async function reorderProperty(
  data: IReorderPropertyParams,
): Promise<void> {
  await api.post<void>("/databases/properties/reorder", data);
}

export async function deleteProperty(
  data: IDeletePropertyParams,
): Promise<void> {
  await api.post<void>("/databases/properties/delete", data);
}

export async function listRows(
  data: IListRowsParams,
): Promise<IDatabaseRow[]> {
  const req = await api.post<IDatabaseRow[]>("/databases/rows/list", data);
  return req.data;
}

export async function createRow(data: ICreateRowParams): Promise<IPage> {
  const req = await api.post<IPage>("/databases/rows/create", data);
  return req.data;
}

export async function setValue(
  data: ISetValueParams,
): Promise<IDatabasePropertyValue> {
  const req = await api.post<IDatabasePropertyValue>(
    "/databases/values/set",
    data,
  );
  return req.data;
}

export async function clearValue(data: IClearValueParams): Promise<void> {
  await api.post<void>("/databases/values/clear", data);
}
