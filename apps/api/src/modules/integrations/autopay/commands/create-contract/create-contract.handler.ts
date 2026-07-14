import { autoPayClient } from '../../service/shared';

interface Payload {
  pinfl: string;
  merchantId: string;
  loanId: string;
  debt: string; // in so'm 100000(100min so'm)
}

const assertOk = () => {};
export const createClientHandler = async ({ merchantId, loanId, debt, pinfl }: Payload) => {
  const client = autoPayClient();
  const body = {
    method: 'client.create',
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
  await client('/api/v1/partners', {
    json: body,
  });
};
