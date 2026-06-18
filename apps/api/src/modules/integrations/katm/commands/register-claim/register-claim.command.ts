export interface RegisterClaimCommand {
  claimId: string;
  agreementId: string;
  agreementDate: Date;
  pinfl: string;
  docSeries: string;
  docNumber: string;
  docType: number;
  regionCode: string;
  districtCode: string;
  address: string;
  phone: string;
  amount: number;
}
