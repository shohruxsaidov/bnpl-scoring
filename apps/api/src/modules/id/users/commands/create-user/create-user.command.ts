export interface CreateUserCommand {
  phone: string; // 998990000000
  pinfl: string;
  firstName: string;
  lastName: string;
  middleName: string;
  birthDate: string; // 2020-10-25
  gender: number;
  nationality: string;
  passportSeries: string;
  passportNumber: string;
  verifiedAt?: Date;
  address?: string;
  regionCode: string | null;
  districtCode: string | null;
  docType: number;
  citizenShipId: string; // for uzbekistan 182
  permanentRegistration?: unknown; // for permanent registration
  temporaryRegistration?: unknown; // for temporary registration
  photoId?: string;
}
