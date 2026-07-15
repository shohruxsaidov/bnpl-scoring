import { env } from '@env';
import amqp, { Channel as connectionChanel, AmqpConnectionManager } from 'amqp-connection-manager';

const connection = amqp.connect([env.RABBIT_CONNECTION_URL]);
export const getConnectionChannel = () => {
  return connection;
};

export type Channel = connectionChanel;
export type ConnectionManager = AmqpConnectionManager;
