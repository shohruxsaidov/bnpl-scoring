import { randomUUID } from "node:crypto";
import { env } from "../../../env";
import {
  createIntegrationClient,
  handleHttpError,
} from "../../../lib/integrations";
import { parsePinflBirthDate, parsePinflGender } from "./pinfl";

export interface MyidUserData {
  pinfl: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  gender: "male" | "female";
  nationality: string;
  passportSerial: string | null;
  passportNumber: string | null;
  photoUrl: string | null;
}

export interface MyidSessionResult {
  sessionId: string;
  iframeUrl: string | null;
  mock: boolean;
}

function myidClient() {
  if (!env.MYID_WEB_BASE_URL)
    throw new Error("MYID_WEB_BASE_URL is not configured");
  return createIntegrationClient(env.MYID_WEB_BASE_URL, "myid");
}

/** Obtain a short-lived server-to-server access token via client_credentials. */
async function getClientToken(): Promise<string> {
  try {
    const data = await myidClient()
      .post("api/v1/oauth2/access-token", {
        body: new URLSearchParams({
          client_id: env.MYID_WEB_CLIENT_ID!,
          client_secret: env.MYID_WEB_CLIENT_SECRET!,
          grant_type: "client_credentials",
        }),
      })
      .json<{ access_token: string }>();
    return data.access_token;
  } catch (err) {
    return handleHttpError(err, "myid.clientToken");
  }
}

/** Create a MyID WebSDK session for the given PINFL. */
export async function createMyidSession(
  pinfl: string,
  ipAddress: string,
): Promise<MyidSessionResult> {
  const birthDate = parsePinflBirthDate(pinfl);
  const token = await getClientToken();

  try {
    const data = await myidClient()
      .post("api/v1/web/sessions", {
        headers: { Authorization: `Bearer ${token}` },
        json: {
          client_id: env.MYID_WEB_CLIENT_ID,
          external_id: randomUUID(),
          pinfl,
          birth_date: birthDate,
          ip_address: ipAddress,
          max_retries: 3,
        },
      })
      .json<{ session_id: string; url: string }>();

    return {
      sessionId: data.session_id,
      iframeUrl: `${env.MYID_WEB_IFRAME_URL}?session_id=${data.session_id}&pinfl=${pinfl}&birth_date=${birthDate}`,
      mock: false,
    };
  } catch (err) {
    return handleHttpError(err, "myid.createSession");
  }
}

/** Exchange an OAuth2 code for MyID user data. */
export async function exchangeMyidCode(
  code: string,
  pinfl: string,
): Promise<MyidUserData> {
  const token = await getClientToken();
  const client = myidClient();

  let access_token: string;
  try {
    const tokenData = await client
      .post("api/v1/oauth2/token", {
        headers: { Authorization: `Bearer ${token}` },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code,
          client_id: env.MYID_WEB_CLIENT_ID!,
        }),
      })
      .json<{ access_token: string }>();
    access_token = tokenData.access_token;
  } catch (err) {
    return handleHttpError(err, "myid.token");
  }

  try {
    const me = await client
      .get("api/v1/users/me", {
        headers: { Authorization: `Bearer ${access_token}` },
      })
      .json<{
        pinfl: string;
        first_name: string;
        last_name: string;
        birth_date: string;
        gender: string;
        nationality: string;
        doc_serial: string | null;
        doc_number: string | null;
        photo: string | null;
      }>();

    return {
      pinfl: me.pinfl,
      firstName: me.first_name,
      lastName: me.last_name,
      birthDate: me.birth_date,
      gender: me.gender === "female" ? "female" : "male",
      nationality: me.nationality ?? "UZB",
      passportSerial: me.doc_serial,
      passportNumber: me.doc_number,
      photoUrl: me.photo,
    };
  } catch (err) {
    return handleHttpError(err, "myid.me");
  }
}

export function buildMockUser(pinfl: string): MyidUserData {
  return {
    pinfl,
    firstName: "Test",
    lastName: "User",
    birthDate: parsePinflBirthDate(pinfl),
    gender: parsePinflGender(pinfl),
    nationality: "UZB",
    passportSerial: "AA",
    passportNumber: "1234567",
    photoUrl: null,
  };
}
