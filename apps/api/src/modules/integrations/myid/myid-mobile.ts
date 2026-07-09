import { randomUUID } from 'node:crypto';
import { db } from '@db';
import { redis } from '@redis';
import { env } from '@env';
import {
  createIntegrationClient,
  handleHttpError,
  IntegrationError,
} from '../../../lib/integrations';
import { logIntegration } from '../log';
import { parsePinflBirthDate } from './pinfl';

export interface MyidUserData {
  pinfl: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  middleName: string | null;
  gender: string; //1 -> for male; 2 -> for female
  nationality: string;
  passportSerial: string;
  passportNumber: string;
  photoUrl: string | null;
  // KATM claim registration fields (ADR-0025) — registration address + doc
  // type. Region/district codes are best-effort mapped from MyID's catalog
  // ids; when absent the Agent enters them manually.
  address: string | null;
  regionCode: string | null; // KATM dict 016
  districtCode: string | null; // KATM dict 052
  docType: number | null; // 0 — ID card, 6 — biometric passport
  citizenShipId: string;
  permanentRegistration?: {
    region?: string | null;
    country_id_cbu: string;
    country_id?: string;
    region_id?: number | string | null;
    region_id_cbu: string;
    district?: string | null;
    district_id?: number | string | null;
    district_id_cbu?: string;
    address?: string | null;
  };
  temporaryRegistration?: {
    region?: string | null;
    country_id_cbu: string;
    country_id?: string;
    region_id?: number | string | null;
    region_id_cbu: string;
    district?: string | null;
    district_id?: number | string | null;
    district_id_cbu?: string;
    address?: string | null;
  };
}

export interface MyidSessionResult {
  sessionId: string;
}

function myidMobileClient() {
  if (!env.MYID_API_BASE_URL) throw new Error('MYID_API_BASE_URL is not configured');
  return createIntegrationClient(env.MYID_API_BASE_URL, 'myid');
}

/** Exchange an OAuth2 code for MyID user data. */
export async function exchangeMyidCode(code: string): Promise<MyidUserData> {
  const client = myidMobileClient();

  const reqBody = {
    grant_type: 'authorization_code',
    code,
    client_id: env.MYID_MOBILE_CLIENT_ID!,
    client_secret: env.MYID_MOBILE_CLIENT_SECRET!,
  };

  const tokenRequestTimestamp = new Date();
  try {
    const token = await client
      .post('api/v1/oauth2/access-token', {
        body: new URLSearchParams(reqBody),
      })
      .json<{
        access_token: string;
        expires_in: number;
        token_type: string;
        scope: string;
      }>();

    logIntegration(db, {
      integration: 'myid',
      methodName: 'exchange_code',
      methodType: 'POST',
      request: { code },
      response: token,
      status: 200,
      errorMessage: null,
      requestTimestamp: tokenRequestTimestamp,
      responseTimestamp: new Date(),
    });

    const me = await client
      .post('api/v1/users/me', {
        headers: { Authorization: `Bearer ${token.access_token}` },
      })
      .json<{
        profile: {
          common_data: {
            pinfl: string;
            first_name: string;
            last_name: string;
            middle_name: string | null;
            birth_date: string;
            gender: string;
            nationality: string | null;
            nationality_id: string | null;
            citizenship_id: string;
          };
          doc_data: {
            pass_data: string;
            doc_type_id?: number | string | null;
          };
          address?: {
            permanent_registration?: {
              region?: string | null;
              country_id_cbu: string;
              country_id?: string;
              region_id?: number | string | null;
              region_id_cbu: string;
              district?: string | null;
              district_id?: number | string | null;
              district_id_cbu?: string;
              address?: string | null;
            } | null;
            temporary_registration?: {
              region?: string | null;
              country_id_cbu: string;
              country_id?: string;
              region_id?: number | string | null;
              region_id_cbu: string;
              district?: string | null;
              district_id?: number | string | null;
              district_id_cbu?: string;
              address?: string | null;
            } | null;
          } | null;
        };
      }>();

    const { common_data, doc_data } = me.profile;
    const passData = doc_data.pass_data ?? '';
    const passportSerial = passData.slice(0, 2) || '';
    const passportNumber = passData.slice(2) || '';

    // MyID returns DD.MM.YYYY — convert to ISO YYYY-MM-DD for Postgres
    const [day, month, year] = common_data.birth_date.split('.');
    const birthDate = `${year}-${month}-${day}`;

    // KATM doc type: ID cards carry an 'AD' serial; everything else is a
    // biometric passport. Used only when MyID itself doesn't say.
    const docType = passportSerial ? (passportSerial.toUpperCase() === 'AD' ? 0 : 6) : null;

    const reg = me.profile.address?.permanent_registration;
    const addressText =
      reg?.address ?? [reg?.region, reg?.district, reg?.address].filter(Boolean).join(', ') ?? null;
    const regionCode = reg?.region_id != null ? String(reg.region_id_cbu).padStart(2, '0') : null;
    const districtCode =
      reg?.district_id != null ? String(reg.district_id_cbu).padStart(3, '0') : null;

    return {
      pinfl: common_data.pinfl,
      firstName: common_data.first_name,
      lastName: common_data.last_name,
      middleName: common_data.middle_name,
      birthDate,
      gender: common_data.gender,
      nationality: common_data.nationality!,
      passportSerial,
      passportNumber,
      photoUrl: null,
      address: addressText || null,
      regionCode,
      districtCode,
      docType,
      citizenShipId: common_data.citizenship_id,
      permanentRegistration: me.profile.address?.permanent_registration as any,
      temporaryRegistration: me.profile.address?.temporary_registration as any,
    };
  } catch (err) {
    const body = (err as { response?: { body?: any } }).response?.body ?? null;
    logIntegration(db, {
      integration: 'myid',
      methodName: 'exchange_code',
      methodType: 'POST',
      request: { code },
      response: body,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp: tokenRequestTimestamp,
      responseTimestamp: new Date(),
    });
    return handleHttpError(err, 'myid.token');
  }
}
