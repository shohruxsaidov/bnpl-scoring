import { dealSessions } from '@db/deal-sessions';
import { db } from '../../../../../db/index';
import { getScoring } from '../../../../admin/scorings/queries/get-scoring/get-scoring.handler';
import { RegisterContractCommand } from '../../../../integrations/katm/commands/register-contract/register-contract.command';
import { registerContractHandler } from '../../../../integrations/katm/commands/register-contract/register-contract.handler';
import { getDealById } from '../../queries/get-deal/get-deal.handler';
import { eq } from 'drizzle-orm';
import { deals } from '@db/deals';
import { dealPaymentSchedules } from '@db/deal-payment-schedules';

export const createContractHandler = async ({ dealId }: { dealId: string }) => {
  getDealById;
  const [row] = await db
    .select()
    .from(deals)
    .innerJoin(dealSessions, eq(dealSessions.id, deals.dealSessionId))
    .innerJoin(dealPaymentSchedules, eq(dealPaymentSchedules.dealId, deals.id))
    .where(eq(deals.id, dealId));
  // const contract = registerContractHandler({
  //   amount: row.amount,
  //   claimId: session.katmClaimId,
  //   contractId: row.id,
  //   endDate
  // })
  console.log(row);
};
