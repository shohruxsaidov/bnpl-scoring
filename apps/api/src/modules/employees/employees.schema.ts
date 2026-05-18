import { Type } from "@sinclair/typebox";

export const EmployeeSchema = Type.Object({
  id: Type.String(),
  tenantId: Type.String(),
  fullName: Type.String(),
  phone: Type.String(),
  email: Type.Union([Type.String(), Type.Null()]),
  active: Type.Boolean(),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

export const CreateEmployeeBody = Type.Object({
  fullName: Type.String({ minLength: 1 }),
  phone: Type.String({ minLength: 1 }),
  email: Type.Optional(Type.String({ format: "email" })),
  password: Type.String({ minLength: 6 }),
  roleIds: Type.Array(Type.String()),
});
