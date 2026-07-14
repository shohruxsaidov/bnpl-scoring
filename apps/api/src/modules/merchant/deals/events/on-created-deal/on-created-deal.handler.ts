import { getConnection } from '@lib/rabbit-queue/connection';
import { DealInferSelect } from '@db/deals';

export const onCreatedDealHandler = async (payload: DealInferSelect) => {
  const queue = 'deal.created';
  const channel = await getConnection();

  await channel.assertQueue(queue, {
    durable: true,
  });
  channel.sendToQueue(queue, Buffer.from(JSON.stringify(payload)));
  await channel.close();
};
