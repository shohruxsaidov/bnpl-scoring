export interface RegisterClaimCommand {
  claimId: string;
  agreementId: string;
  agreementDate: Date;
  pinfl: string;
  passportSeries: string;
  passportNumber: string;
  passportType: number;
  regionCode: string;
  districtCode: string;
  address: string;
  phone: string;
  amount: number; // in format 300_000_00
}
