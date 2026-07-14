import { env } from '@env';
import ky from 'ky';

export const autoPayClient = () => {
  const integration = 'autopay';
  if (!env.AUTO_PAY_BASE_URL) throw new Error('AUTO_PAY_BASE_URL is not configured');
  const baseUrl = env.AUTO_PAY_BASE_URL;
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return ky.create({
    baseUrl: base,
    timeout: 60_000,
    retry: 0,
    headers: {
      Authorization: `Bearer ${env.AUTO_PAY_TOKEN}`,
      'Content-Type': 'application/json',
    },
    hooks: {
      beforeError: [
        ({ error }) => {
          error.message = `[${integration}] ${error.message}`;
          return error;
        },
      ],
    },
  });
};
