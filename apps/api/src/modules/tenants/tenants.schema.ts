import { Type } from "@sinclair/typebox";

export const TenantSchema = Type.Object({
  id: Type.String(),
  name: Type.String(),
  slug: Type.String(),
  active: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

export const CreateTenantBody = Type.Object({
  name: Type.String({ minLength: 1 }),
  slug: Type.String({ minLength: 1 }),
});

export const TenantListResponse = Type.Object({
  data: Type.Array(TenantSchema),
  total: Type.Number(),
  page: Type.Number(),
  pageSize: Type.Number(),
});
