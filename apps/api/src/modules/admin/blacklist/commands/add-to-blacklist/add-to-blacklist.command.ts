export interface AddBlacklistEntryInput {
  type: string;
  value: string;
  reason: string | null;
  addedByAdminId: number;
}
