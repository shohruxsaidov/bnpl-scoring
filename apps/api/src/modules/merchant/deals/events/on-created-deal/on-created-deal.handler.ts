import { getConnection } from '@lib/rabbit-queue/connection';
import { DealInferSelect } from '@db/deals';
import { findUserById } from '../../../../auth/client/service/service.handler';
import { getDealById } from '../../queries/get-deal/get-deal.handler';

interface Payload {
  userId: number;
  dealId: string;
}

export const onCreatedDealHandler = async ({ userId, dealId }: Payload) => {
  const user = await findUserById(userId);
  const deal = await getDealById(dealId);
  const data = {
    client: {
      firstName: user.firstName,
      lastName: user.lastName,
      middleName: user.middleName,
      passportSeries: user.passportSeries,
      passportNumber: user.passportNumber,
    },
    deal: {
      id: deal?.id,
      amount: deal?.amount,
    },
  };

  const queue = 'deal.created';
  const channel = await getConnection();

  await channel.assertQueue(queue, {
    durable: true,
  });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(data)));
  await channel.close();
};
