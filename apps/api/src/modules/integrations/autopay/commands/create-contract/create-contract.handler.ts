import { autoPayClient } from '../../service/shared';

interface Payload {
  pinfl: string;
  merchantId: string;
  loanId: string;
  debt: number; // in so'm 100000(100min so'm)
}

const assertOk = () => {};
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
  const result = await client('/api/v1/partners', {
    method: 'post',
    json: body,
  });

  console.log(`Result of creating contract`, result);
};
