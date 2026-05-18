import { Type } from "@sinclair/typebox";

export const ClientSchema = Type.Object({
  id: Type.String(),
  tenantId: Type.String(),
  fullName: Type.String(),
  phone: Type.String(),
  passportSerial: Type.Union([Type.String(), Type.Null()]),
  pinfl: Type.Union([Type.String(), Type.Null()]),
  birthDate: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

export const CreateClientBody = Type.Object({
  fullName: Type.String({ minLength: 1 }),
  phone: Type.String({ minLength: 1 }),
  passportSerial: Type.Optional(Type.String()),
  pinfl: Type.Optional(Type.String()),
  birthDate: Type.Optional(Type.String()),
});
