import { env } from '@env';
import { findUserById } from '../../../../auth/client/service/service.handler';
import { createClientHandler } from '../../../../integrations/autopay/commands/create-client/create-client.handler';
import { createContractHandler as autopayCreateContractHandler } from '../../../../integrations/autopay/commands/create-contract/create-contract.handler';
import { getDealById } from '../../queries/get-deal/get-deal.handler';
import { db } from '../../../../../db/index';
import { deals } from '@db/deals';
import { users } from '@db/users';
import { eq } from 'drizzle-orm';

interface Payload {
  dealId: string;
}
export const createContractHandler = async ({ dealId }: Payload) => {
  const [deal] = await db.select().from(deals).innerJoin(users, eq(users.id, deals.userId));
  const user = deal.users;
  const client = await createClientHandler({
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName || '',
    passportNumber: user.passportNumber || '',
    passportSeries: user.passportSeries || '',
    pinfl: user.pinfl,
  });

  const contract = await autopayCreateContractHandler({
    debt: deal!.deals.totalPayable!,
    loanId: deal!.deals.id,
    merchantId: env.AUTO_PAY_MERCHANT_ID,
    pinfl: user!.pinfl!,
  });
};
