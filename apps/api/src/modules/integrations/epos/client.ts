import { env } from '@env';
import { createIntegrationClient } from '@lib/integrations';

export const eposClient = createIntegrationClient(env.EPOS_API_URL, 'epos');
