import { env } from '@env';
import { callKatm, security } from '../../service/shared';
import { RegisterContractCommand } from './register-contract.command';

export const registerContractHandler = async ({
  claimId,
  contractId,
  startDate,
  endDate,
  amount,
}: RegisterContractCommand) => {
  const data = await callKatm<Record<string, unknown>>('v1/contract/registration', {
    security: security(),
    data: {
      pCode: env.KATM_CODE,
      pClaimId: claimId,
      pContractId: contractId,
      pStartDate: startDate,
      pEndDate: endDate,
      pCreditAmount: +amount * 100,
      pCurrency: 860, // 860 uz currency
    },
  });

  console.log(data);
  return { success: true };
};
