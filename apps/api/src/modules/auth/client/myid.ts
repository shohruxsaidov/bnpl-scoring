import { randomUUID } from 'node:crypto';
import type Redis from 'ioredis';
import type { Db } from '../../../db/index';
import { env } from '../../../env';
import {
  createIntegrationClient,
  handleHttpError,
  IntegrationError,
} from '../../../lib/integrations';
import { logIntegration } from '../../integrations/log';
import { parsePinflBirthDate, parsePinflGender } from './pinfl';

const MYID_TOKEN_KEY = 'myid:client_token';

export interface MyidUserData {
  pinfl: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: 'male' | 'female';
  nationality: string;
  passportSerial: string | null;
  passportNumber: string | null;
  photoUrl: string | null;
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
async function getClientToken(db: Db, redis: Redis): Promise<string> {
  const cached = await redis.get(MYID_TOKEN_KEY).catch(() => null);
  if (cached) return cached;

  const reqBody = {
    client_id: env.MYID_WEB_CLIENT_ID!,
    client_secret: env.MYID_WEB_CLIENT_SECRET!,
    grant_type: 'client_credentials',
  };

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
    });
    return handleHttpError(err, 'myid.clientToken');
  }
}

/** Create a MyID WebSDK session for the given PINFL. */
export async function createMyidSession(
  db: Db,
  redis: Redis,
  pinfl: string,
  ipAddress: string,
  redirectUri: string,
): Promise<MyidSessionResult> {
  const birthDate = parsePinflBirthDate(pinfl);
  const token = await getClientToken(db, redis);

  const reqBody = {
    client_id: env.MYID_WEB_CLIENT_ID,
    external_id: randomUUID(),
    pinfl,
    birth_date: birthDate,
    ip_address: ipAddress,
    max_retries: 3,
  };

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
    });

    const redirectUrl = `${env.MYID_WEB_IFRAME_URL}?session_id=${data.session_id}&pinfl=${pinfl}&birth_date=${birthDate}&theme=dark&redirect_uri=${redirectUri}`;

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
    });
    return handleHttpError(err, 'myid.createSession');
  }
}

/** Exchange an OAuth2 code for MyID user data. */
export async function exchangeMyidCode(db: Db, redis: Redis, code: string): Promise<MyidUserData> {
  const token = await getClientToken(db, redis);
  const client = myidClient();

  const tokenReqBody = {
    grant_type: 'authorization_code',
    code,
    client_id: env.MYID_WEB_CLIENT_ID!,
    client_secret: env.MYID_WEB_CLIENT_SECRET!,
  };

  let access_token: string;
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
    });
    return handleHttpError(err, 'myid.token');
  }

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
          };
          doc_data: {
            pass_data: string | null;
          };
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
    });

    const { common_data, doc_data } = me.profile;
    const passData = doc_data.pass_data ?? '';
    const passportSerial = passData.slice(0, 2) || null;
    const passportNumber = passData.slice(2) || null;

    // MyID returns DD.MM.YYYY — convert to ISO YYYY-MM-DD for Postgres
    const [day, month, year] = common_data.birth_date.split('.');
    const birthDate = `${year}-${month}-${day}`;

    return {
      pinfl: common_data.pinfl,
      firstName: common_data.first_name,
      lastName: common_data.last_name,
      birthDate,
      gender: common_data.gender === '2' ? 'female' : 'male',
      nationality: common_data.nationality ?? 'UZB',
      passportSerial,
      passportNumber,
      photoUrl: null,
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
    });
    return handleHttpError(err, 'myid.me');
  }
}

export function buildMockUser(pinfl: string): MyidUserData {
  return {
    pinfl,
    firstName: 'Test',
    lastName: 'User',
    birthDate: parsePinflBirthDate(pinfl),
    gender: parsePinflGender(pinfl),
    nationality: 'UZB',
    passportSerial: 'AA',
    passportNumber: '1234567',
    photoUrl: null,
  };
}
