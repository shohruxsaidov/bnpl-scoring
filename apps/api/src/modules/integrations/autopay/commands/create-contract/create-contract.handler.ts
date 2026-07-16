import { HTTPError } from 'ky';
import { db } from '@db';
import { logIntegration } from '../../../log';
import { autoPayClient } from '../../service/shared';

interface Payload {
  pinfl: string;
  merchantId: string;
  loanId: string;
  debt: number; // in so'm 100000(100min so'm)
}

export const createContractHandler = async ({ merchantId, loanId, debt, pinfl }: Payload) => {
  const client = autoPayClient();
  const body = {
    method: 'contract.create',
    params: {
      contracts: [
        {
          pinfl,
          merchant_id: merchantId,
          loan_id: loanId,
          debt: +debt * 100, // sends in tiyin
        },
      ],
    },
  };

  const requestTimestamp = new Date();
  try {
    const res = await client('/api/v1/partners', {
      method: 'post',
      json: body,
    });
    const data = await res.json().catch(() => null);

    logIntegration(db, {
      integration: 'autopay',
      methodName: 'contract.create',
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
      methodName: 'contract.create',
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
