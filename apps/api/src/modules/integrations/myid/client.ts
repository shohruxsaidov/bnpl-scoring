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

const MYID_TOKEN_KEY = 'myid:client_token';

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
}

export interface MyidSessionResult {
  sessionId: string;
  redirectUrl: string | null;
}

function myidClient() {
  if (!env.MYID_WEB_BASE_URL) throw new Error('MYID_WEB_BASE_URL is not configured');
  return createIntegrationClient(env.MYID_WEB_BASE_URL, 'myid');
}

/** Obtain a server-to-server access token via client_credentials, cached in Redis. */
async function getClientToken(): Promise<string> {
  const cached = await redis.get(MYID_TOKEN_KEY).catch(() => null);
  if (cached) return cached;

  const reqBody = {
    client_id: env.MYID_WEB_CLIENT_ID!,
    client_secret: env.MYID_WEB_CLIENT_SECRET!,
    grant_type: 'client_credentials',
  };

  const requestTimestamp = new Date();
  try {
    const data = await myidClient()
      .post('api/v1/oauth2/access-token', {
        body: new URLSearchParams(reqBody),
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
export async function createMyidSession(
  pinfl: string,
  ipAddress: string,
  redirectUri?: string,
): Promise<MyidSessionResult> {
  const birthDate = parsePinflBirthDate(pinfl);
  const token = await getClientToken();

  const reqBody = {
    client_id: env.MYID_WEB_CLIENT_ID,
    external_id: randomUUID(),
    pinfl,
    birth_date: birthDate,
    ip_address: ipAddress,
    max_retries: 3,
  };

  const requestTimestamp = new Date();
  try {
    const data = await myidClient()
      .post('api/v1/web/sessions', {
        headers: { Authorization: `Bearer ${token}` },
        json: reqBody,
      })
      .json<{ session_id: string; url: string }>();

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
    const redirectUrl = redirectUri
      ? `${env.MYID_WEB_IFRAME_URL}?session_id=${data.session_id}&pinfl=${pinfl}&birth_date=${birthDate}&theme=dark&redirect_uri=${redirectUri}`
      : null;

    return {
      sessionId: data.session_id,
      redirectUrl,
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
export async function exchangeMyidCode(code: string): Promise<MyidUserData> {
  const token = await getClientToken();
  const client = myidClient();

  const tokenReqBody = {
    grant_type: 'authorization_code',
    code,
    client_id: env.MYID_WEB_CLIENT_ID!,
    client_secret: env.MYID_WEB_CLIENT_SECRET!,
  };

  let access_token: string;
  const tokenRequestTimestamp = new Date();
  try {
    const tokenData = await client
      .post('api/v1/oauth2//access-token', {
        headers: { Authorization: `Bearer ${token}` },
        body: new URLSearchParams(tokenReqBody),
      })
      .json<{ access_token: string }>();

    logIntegration(db, {
      integration: 'myid',
      methodName: 'exchange_code',
      methodType: 'POST',
      request: tokenReqBody,
      response: tokenData,
      status: 200,
      errorMessage: null,
      requestTimestamp: tokenRequestTimestamp,
      responseTimestamp: new Date(),
    });

    access_token = tokenData.access_token;
  } catch (err) {
    logIntegration(db, {
      integration: 'myid',
      methodName: 'exchange_code',
      methodType: 'POST',
      request: tokenReqBody,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp: tokenRequestTimestamp,
      responseTimestamp: new Date(),
    });
    return handleHttpError(err, 'myid.token');
  }

  const meRequestTimestamp = new Date();
  try {
    const me = await client
      .get('api/v1/users/me', {
        headers: { Authorization: `Bearer ${access_token}` },
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
              region_id?: number | string | null;
              district?: string | null;
              district_id?: number | string | null;
              address?: string | null;
            } | null;
          } | null;
        };
      }>();

    logIntegration(db, {
      integration: 'myid',
      methodName: 'get_user',
      methodType: 'GET',
      request: null,
      response: me,
      status: 200,
      errorMessage: null,
      requestTimestamp: meRequestTimestamp,
      responseTimestamp: new Date(),
    });

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
      reg?.address ?? [reg?.region, reg?.district].filter(Boolean).join(', ') ?? null;
    const regionCode = reg?.region_id != null ? String(reg.region_id).padStart(2, '0') : null;
    const districtCode = reg?.district_id != null ? String(reg.district_id).padStart(3, '0') : null;

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
    };
  } catch (err) {
    logIntegration(db, {
      integration: 'myid',
      methodName: 'get_user',
      methodType: 'GET',
      request: null,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp: meRequestTimestamp,
      responseTimestamp: new Date(),
    });
    return handleHttpError(err, 'myid.me');
  }
}
