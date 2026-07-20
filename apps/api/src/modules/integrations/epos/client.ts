import { env } from '@env';
import { createIntegrationClient } from '@lib/integrations';

export const eposClient = createIntegrationClient(env.MYID_API_BASE_URL, 'epos');
