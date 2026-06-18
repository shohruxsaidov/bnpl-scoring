import {
  and,
  asc,
  count,
  desc,
  eq,
  gte,
  isNotNull,
  isNull,
  lt,
  lte,
  or,
  type SQL,
} from 'drizzle-orm';
import { db } from '@db';
import { integrationLogs } from '@db/integration-logs';
import type { ListIntegrationLogsParams } from './list-integration-logs.query';

export type { ListIntegrationLogsParams };

export interface IntegrationLogListItem {
  id: string;
  integration: string;
  methodName: string;
  methodType: string;
  status: number | null;
  hasError: boolean;
  responseTimeInMs: number | null;
  requestTimestamp: string | null;
  responseTimestamp: string | null;
}

// A call is an error if the client recorded a failure or the upstream
// answered with a 4xx/5xx; everything else (including null status with no
// error message) counts as success.
function errorCondition(): SQL {
  return or(isNotNull(integrationLogs.errorMessage), gte(integrationLogs.status, 400))!;
}

function successCondition(): SQL {
  return and(
    isNull(integrationLogs.errorMessage),
    or(isNull(integrationLogs.status), lt(integrationLogs.status, 400)),
  )!;
}

export async function listIntegrationLogs(
  params: ListIntegrationLogsParams,
): Promise<{ logs: IntegrationLogListItem[]; total: number }> {
  const conditions: SQL[] = [];
  if (params.from) conditions.push(gte(integrationLogs.requestTimestamp, params.from));
  if (params.to) conditions.push(lte(integrationLogs.requestTimestamp, params.to));
  if (params.integration) conditions.push(eq(integrationLogs.integration, params.integration));
  if (params.result === 'error') conditions.push(errorCondition());
  if (params.result === 'success') conditions.push(successCondition());

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [rows, totals] = await Promise.all([
    db
      .select({
        id: integrationLogs.id,
        integration: integrationLogs.integration,
        methodName: integrationLogs.methodName,
        methodType: integrationLogs.methodType,
        status: integrationLogs.status,
        errorMessage: integrationLogs.errorMessage,
        responseTimeInMs: integrationLogs.responseTimeInMs,
        requestTimestamp: integrationLogs.requestTimestamp,
        responseTimestamp: integrationLogs.responseTimestamp,
      })
      .from(integrationLogs)
      .where(where)
      .orderBy(desc(integrationLogs.requestTimestamp), desc(integrationLogs.createdAt))
      .limit(params.limit)
      .offset(params.offset),
    db.select({ total: count() }).from(integrationLogs).where(where),
  ]);

  return {
    logs: rows.map((row) => ({
      id: row.id,
      integration: row.integration,
      methodName: row.methodName,
      methodType: row.methodType,
      status: row.status,
      hasError: row.errorMessage != null || (row.status != null && row.status >= 400),
      responseTimeInMs: row.responseTimeInMs,
      requestTimestamp: row.requestTimestamp?.toISOString() ?? null,
      responseTimestamp: row.responseTimestamp?.toISOString() ?? null,
    })),
    total: totals[0]?.total ?? 0,
  };
}

export async function listIntegrationNames(): Promise<string[]> {
  const rows = await db
    .selectDistinct({ integration: integrationLogs.integration })
    .from(integrationLogs)
    .orderBy(asc(integrationLogs.integration));
  return rows.map((row) => row.integration);
}
