export interface CreateClientCommand {
  phone: string;
  pinfl: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: string;
  nationality: string;
  passportSerial: string | null;
  passportNumber: string | null;
  photoUrl: string | null;
  address: string | null;
  katmRegionCode: string | null;
  katmDistrictCode: string | null;
  docType: number | null;
  merchantId: number;
  branchId: number;
}
