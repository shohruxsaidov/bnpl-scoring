import { env } from '@env';
import amqp, { type Channel } from 'amqplib';

export const getConnection = async () => {
  const connection = await amqp.connect(env.RABBIT_CONNECTION_URL);
  const channel = await connection.createChannel();
  return channel;
};

export const closeConnection = async (channel: Channel) => {
  await channel.close();
};
