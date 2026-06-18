import { eq } from 'drizzle-orm';
import { db } from '@db';
import { integrationLogs } from '@db/integration-logs';

export interface IntegrationLogDetail {
  id: string;
  integration: string;
  methodName: string;
  methodType: string;
  status: number | null;
  hasError: boolean;
  errorMessage: string | null;
  request: unknown;
  response: unknown;
  responseTimeInMs: number | null;
  requestTimestamp: string | null;
  responseTimestamp: string | null;
  createdAt: string;
}

export async function getIntegrationLog(id: string): Promise<IntegrationLogDetail | null> {
  const rows = await db.select().from(integrationLogs).where(eq(integrationLogs.id, id)).limit(1);

  const row = rows[0];
  if (!row) return null;

  return {
    id: row.id,
    integration: row.integration,
    methodName: row.methodName,
    methodType: row.methodType,
    status: row.status,
    hasError: row.errorMessage != null || (row.status != null && row.status >= 400),
    errorMessage: row.errorMessage,
    request: row.request,
    response: row.response,
    responseTimeInMs: row.responseTimeInMs,
    requestTimestamp: row.requestTimestamp?.toISOString() ?? null,
    responseTimestamp: row.responseTimestamp?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
  };
}
