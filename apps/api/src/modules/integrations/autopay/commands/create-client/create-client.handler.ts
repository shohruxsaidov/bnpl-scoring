import { HTTPError } from 'ky';
import { db } from '@db';
import { logIntegration } from '../../../log';
import { autoPayClient } from '../../service/shared';

interface Payload {
  pinfl: string;
  firstName: string;
  lastName: string;
  middleName: string;
  passportSeries: string;
  passportNumber: string;
}

export const createClientHandler = async ({
  firstName,
  lastName,
  middleName,
  passportSeries,
  passportNumber,
  pinfl,
}: Payload) => {
  const client = autoPayClient();
  const body = {
    method: 'client.create',
    params: {
      clients: [
        {
          pinfl,
          passport: `${passportSeries}${passportNumber}`,
          first_name: firstName,
          last_name: lastName,
          middle_name: middleName,
        },
      ],
    },
  };

  const requestTimestamp = new Date();
  try {
    const res = await client('/api/v1/partners', {
      method: 'POST',
      json: body,
    });
    const data = await res.json().catch(() => null);

    logIntegration(db, {
      integration: 'autopay',
      methodName: 'client.create',
      methodType: 'POST',
      request: body,
      response: data,
      status: res.status,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    });

    return data;
  } catch (err) {
    const body_ = err instanceof HTTPError ? await err.response.text().catch(() => null) : null;
    logIntegration(db, {
      integration: 'autopay',
      methodName: 'client.create',
      methodType: 'POST',
      request: body,
      response: body_,
      status: err instanceof HTTPError ? err.response.status : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp,
      responseTimestamp: new Date(),
    });
    throw err;
  }
};
