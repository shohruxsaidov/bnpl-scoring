import { getConnectionChannel, Channel } from '@lib/rabbit-queue/connection';
import { createContractConsume as createContractAutoPay } from './autopay-creating-contract/create-contract.consumer';
import { createContractConsume as createContractKatm } from './katm-creating-contract/create-contract.consumer';

export const startConsuming = async () => {
  const connection = getConnectionChannel();
  createContractAutoPay(connection);
  createContractKatm(connection);
};
