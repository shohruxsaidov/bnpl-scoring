import { Channel } from './../../../../../../node_modules/.pnpm/amqp-connection-manager@5.0.0_amqplib@2.0.1/node_modules/amqp-connection-manager/dist/types/ChannelWrapper.d';
import { getConnectionChannel } from '@lib/rabbit-queue/connection';
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

  const queue = 'merchant-portal@deal_created';
  const connection = getConnectionChannel();
  const wrapper = connection.createChannel({
    setup(ch: Channel) {
      return ch.assertExchange(queue, 'direct', {
        durable: true,
      });
    },
  });
  await wrapper.publish(queue, '', Buffer.from(JSON.stringify(data)));
};
