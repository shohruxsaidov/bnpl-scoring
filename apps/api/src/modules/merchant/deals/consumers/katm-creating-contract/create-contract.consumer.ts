import { ConnectionManager, Channel } from '@lib/rabbit-queue/connection';
import { createContractHandler } from './create-contract.handler';

export const createContractConsume = (connection: ConnectionManager) => {
  const queue = 'merchant-portal@katm_contract_creating';
  const wrapper = connection.createChannel({
    json: true,
    setup(ch: Channel) {
      return ch.assertQueue(queue);
    },
  });
  wrapper.consume(queue, async (msg) => {
    const content = JSON.parse(msg.content.toString()) as any;
    await createContractHandler({
      dealId: content.deal.id,
    });
    wrapper.ack(msg);
  });
};
