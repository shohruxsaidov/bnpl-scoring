import { categories } from './../../../../../db/categories';
import { ConnectionManager, Channel } from '@lib/rabbit-queue/connection';
import { createContractHandler } from './create-contract.handler';
import amqp from 'amqplib';
import { env } from '@env';

export const createContractConsume = async (connection: ConnectionManager) => {
  const queue = 'merchant-portal@autopay_contract_creating';
  // const c = await amqp.connect(env.RABBIT_CONNECTION_URL);
  // const channel = await c.createChannel();
  // await channel.assertQueue(queue, {
  //   durable: true,
  // });
  // channel.consume(queue, (message) => {
  //   console.log(message);
  // });

  const wrapper = connection.createChannel();

  wrapper.consume(queue, async (msg) => {
    const content = JSON.parse(msg.content.toString()) as any;
    await createContractHandler({
      userId: content.client.id,
      dealId: content.deal.id,
    });
    wrapper.ack(msg);
  });
};
