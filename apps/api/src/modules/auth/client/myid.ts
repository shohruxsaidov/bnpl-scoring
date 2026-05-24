import { env } from "../../../env";
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

/** Create a MyID WebSDK session for the given PINFL. */
export async function createMyidSession(
  pinfl: string,
): Promise<MyidSessionResult> {
  if (env.MYID_MOCK) {
    return { sessionId: `mock-${pinfl}`, iframeUrl: null, mock: true };
  }

  const birthDate = parsePinflBirthDate(pinfl);
  const credentials = Buffer.from(
    `${env.MYID_WEB_CLIENT_ID}:${env.MYID_WEB_CLIENT_SECRET}`,
  ).toString("base64");

  const res = await fetch(`${env.MYID_WEB_BASE_URL}/api/v1/web/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${credentials}`,
    },
    body: JSON.stringify({
      client_id: env.MYID_WEB_CLIENT_ID,
      pinfl,
      birth_date: birthDate,
    }),
  });

  if (!res.ok) {
    throw new Error(`myid_session_failed: ${res.status}`);
  }

  const data = (await res.json()) as { session_id: string; url: string };
  return {
    sessionId: data.session_id,
    iframeUrl: `${env.MYID_WEB_IFRAME_URL}?session_id=${data.session_id}`,
    mock: false,
  };
}

/** Exchange an OAuth2 code for MyID user data. */
export async function exchangeMyidCode(
  code: string,
  pinfl: string,
): Promise<MyidUserData> {
  if (env.MYID_MOCK) {
    return buildMockUser(pinfl);
  }

  const credentials = Buffer.from(
    `${env.MYID_WEB_CLIENT_ID}:${env.MYID_WEB_CLIENT_SECRET}`,
  ).toString("base64");

  const tokenRes = await fetch(`${env.MYID_WEB_BASE_URL}/api/v1/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${credentials}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      client_id: env.MYID_WEB_CLIENT_ID!,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`myid_token_failed: ${tokenRes.status}`);
  }

  const { access_token } = (await tokenRes.json()) as { access_token: string };

  const meRes = await fetch(`${env.MYID_WEB_BASE_URL}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${access_token}` },
  });

  if (!meRes.ok) {
    throw new Error(`myid_me_failed: ${meRes.status}`);
  }

  const me = (await meRes.json()) as {
    pinfl: string;
    first_name: string;
    last_name: string;
    birth_date: string;
    gender: string;
    nationality: string;
    doc_serial: string | null;
    doc_number: string | null;
    photo: string | null;
  };

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
}

function buildMockUser(pinfl: string): MyidUserData {
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
