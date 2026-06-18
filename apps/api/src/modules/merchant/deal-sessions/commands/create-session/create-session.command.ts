export interface CreateSessionCommand {
  merchantId: number;
  branchId: number;
  agentId: number;
  userId?: number;
}
