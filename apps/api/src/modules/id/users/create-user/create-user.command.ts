export interface CreateUserCommand {
  phone: string; // 998990000000
  pinfl: string;
  firstName: string;
  lastName: string;
  middleName: string;
  birthDate: string; // 2020-10-25
  gender: number;
  nationality: string;
  passportSerial: string;
  passportNumber: string;
  verifiedAt?: number;
  address: string;
  regionCode: string;
  districtCode: string;
  docType: number;
}
