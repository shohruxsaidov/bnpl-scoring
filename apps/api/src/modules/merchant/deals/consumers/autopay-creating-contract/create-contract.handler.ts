import { env } from '@env';
import { findUserById } from '../../../../auth/client/service/service.handler';
import { createClientHandler } from '../../../../integrations/autopay/commands/create-client/create-client.handler';
import { createContractHandler as autopayCreateContractHandler } from '../../../../integrations/autopay/commands/create-contract/create-contract.handler';
import { getDealById } from '../../queries/get-deal/get-deal.handler';

interface Payload {
  userId: number;
  dealId: string;
}
export const createContractHandler = async ({ userId, dealId }: Payload) => {
  const user = await findUserById(userId);
  const deal = await getDealById(dealId);
  const client = await createClientHandler({
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName || '',
    passportNumber: user.passportNumber || '',
    passportSeries: user.passportSeries || '',
    pinfl: user.pinfl,
  });

  const contract = await autopayCreateContractHandler({
    debt: deal!.totalPayable,
    loanId: deal!.id,
    merchantId: env.AUTO_PAY_MERCHANT_ID,
    pinfl: deal!.clientPinfl!,
  });
};
