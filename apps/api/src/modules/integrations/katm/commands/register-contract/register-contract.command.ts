export interface RegisterContractCommand {
  claimId: string;
  contractId: string;
  startDate: Date;
  endDate: Date;
  amount: string; // in so'm
}
