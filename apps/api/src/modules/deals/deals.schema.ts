import { Type } from "@sinclair/typebox";

export const DealHeaderSchema = Type.Object({
  id: Type.String(),
  tenantId: Type.String(),
  clientId: Type.String(),
  agentId: Type.String(),
  tariffId: Type.String(),
  status: Type.String(),
  principal: Type.Number(),
  totalPayable: Type.Number(),
  katmConsentId: Type.Union([Type.String(), Type.Null()]),
  createdAt: Type.String(),
  updatedAt: Type.String(),
  deletedAt: Type.Union([Type.String(), Type.Null()]),
});

export const CreateDealBody = Type.Object({
  clientId: Type.String(),
  tariffId: Type.String(),
  principal: Type.Number({ minimum: 0 }),
});

export const ScheduleRowSchema = Type.Object({
  sequence: Type.Number(),
  dueDate: Type.String(),
  amount: Type.Number(),
  paid: Type.Boolean(),
});
