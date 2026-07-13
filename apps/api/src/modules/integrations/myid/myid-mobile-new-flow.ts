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

const MYID_TOKEN_KEY = 'myid_mobile:client_token';

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
  if (!env.MYID_MOBILE_API_BASE_URL) throw new Error('MYID_MOBILE_API_BASE_URL is not configured');
  return createIntegrationClient(env.MYID_MOBILE_API_BASE_URL, 'myid.mobile');
}

/** Obtain a server-to-server access token via client_credentials, cached in Redis. */
async function getClientToken(): Promise<string> {
  const cached = await redis.get(MYID_TOKEN_KEY).catch(() => null);
  if (cached) return cached;

  const reqBody = {
    client_id: env.MYID_MOBILE_CLIENT_ID!,
    client_secret: env.MYID_MOBILE_CLIENT_SECRET!,
  };

  const requestTimestamp = new Date();
  try {
    const data = await myidMobileClient()
      .post('api/v1/auth/clients/access-token', {
        json: reqBody,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      .json<{ access_token: string; expires_in: number }>();

    redis.set(MYID_TOKEN_KEY, data.access_token, 'EX', data.expires_in - 60).catch(() => null);

    logIntegration(db, {
      integration: 'myid',
      methodName: 'client_token',
      methodType: 'POST',
      request: reqBody,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    return data.access_token;
  } catch (err) {
    console.error('Error obtaining MyID client token:', err);
    logIntegration(db, {
      integration: 'myid',
      methodName: 'client_token',
      methodType: 'POST',
      request: reqBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    return handleHttpError(err, 'myid.clientToken');
  }
}

/** Create a MyID WebSDK session for the given PINFL. */
export async function createMobileMyidSession(
  session: string | { passData: string; birthDate: string },
): Promise<MyidSessionResult> {
  let reqBody: Record<string, unknown> = {};
  if (typeof session === 'string') {
    reqBody = { session, birth_date: parsePinflBirthDate(session) };
  } else {
    reqBody = {
      pass_data: session.passData,
      birth_date: session.birthDate,
    };
  }
  const token = await getClientToken();

  const requestTimestamp = new Date();
  try {
    const data = await myidMobileClient()
      .post('api/v2/sdk/sessions', {
        headers: { Authorization: `Bearer ${token}` },
        json: reqBody,
      })
      .json<{ session_id: string }>();

    logIntegration(db, {
      integration: 'myid',
      methodName: 'create_session',
      methodType: 'POST',
      request: reqBody,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    // Native clients (mobile) drive the MyID SDK directly and have no browser
    // iframe to land on, so they omit redirectUri and get a null redirectUrl.

    return {
      sessionId: data.session_id,
    };
  } catch (err) {
    logIntegration(db, {
      integration: 'myid',
      methodName: 'create_session',
      methodType: 'POST',
      request: reqBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    return handleHttpError(err, 'myid.createSession');
  }
}

/** Exchange an OAuth2 code for MyID user data. */
export async function exchangeMobileMyidCode(code: string): Promise<MyidUserData> {
  const token = await getClientToken();
  const client = myidMobileClient();

  const tokenRequestTimestamp = new Date();
  try {
    const me = await client
      .get('api/v1/sdk/data?code=' + code, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .json<{
        data: {
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
        };
      }>();

    logIntegration(db, {
      integration: 'myid',
      methodName: 'exchange_code',
      methodType: 'POST',
      request: { code },
      response: me,
      status: 200,
      errorMessage: null,
      requestTimestamp: tokenRequestTimestamp,
      responseTimestamp: new Date(),
    });

    const { common_data, doc_data } = me.data.profile;
    const passData = doc_data.pass_data ?? '';
    const passportSerial = passData.slice(0, 2) || '';
    const passportNumber = passData.slice(2) || '';

    // MyID returns DD.MM.YYYY — convert to ISO YYYY-MM-DD for Postgres
    const [day, month, year] = common_data.birth_date.split('.');
    const birthDate = `${year}-${month}-${day}`;

    // KATM doc type: ID cards carry an 'AD' serial; everything else is a
    // biometric passport. Used only when MyID itself doesn't say.
    const docType = passportSerial ? (passportSerial.toUpperCase() === 'AD' ? 0 : 6) : null;

    const reg = me.data.profile.address?.permanent_registration;
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
      permanentRegistration: me.data.profile.address?.permanent_registration as any,
      temporaryRegistration: me.data.profile.address?.temporary_registration as any,
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
