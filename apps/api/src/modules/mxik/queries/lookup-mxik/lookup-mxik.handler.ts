import { eq, sql } from 'drizzle-orm'
import { db } from '@db'
import { mxikCache } from '@db/schema'
import { env } from '../../../../env'
import { createIntegrationClient, handleHttpError, IntegrationError } from '../../../../lib/integrations'
import { logIntegration } from '../../../integrations/log'

interface MxikApiResponse {
  mxikCode: string
  mxikName: string | null
  label: number
  brandName: string | null
  groupName: string | null
  className: string | null
  packages: unknown[] | null
}

export interface MxikEntry {
  mxikCode: string
  mxikName: string | null
  label: number
  brandName: string | null
  groupName: string | null
  className: string | null
  packages: unknown[] | null
}

function mxikClient() {
  return createIntegrationClient(env.MXIK_API_URL, 'mxik')
}

export async function lookupMxik(code: string): Promise<MxikEntry> {
  const [cached] = await db
    .select()
    .from(mxikCache)
    .where(eq(mxikCache.mxikCode, code))
    .limit(1)

  if (cached) {
    return {
      mxikCode: cached.mxikCode,
      mxikName: cached.mxikName,
      label: cached.label ?? 0,
      brandName: cached.brandName,
      groupName: cached.groupName,
      className: cached.className,
      packages: cached.packages as unknown[] | null,
    }
  }

  const reqParams = { mxikCode: code, lang: 'uz_cyrl' }

  const requestTimestamp = new Date()
  try {
    const data = await mxikClient()
      .get('data/by-mxik', { searchParams: reqParams })
      .json<MxikApiResponse>()

    logIntegration(db, {
      integration: 'mxik',
      methodName: 'lookup',
      methodType: 'GET',
      request: reqParams,
      response: data,
      status: 200,
      errorMessage: null,
      requestTimestamp,
      responseTimestamp: new Date(),
    })

    const entry = {
      mxikCode: data.mxikCode,
      mxikName: data.mxikName,
      label: data.label,
      brandName: data.brandName,
      groupName: data.groupName,
      className: data.className,
      packages: data.packages,
    }

    await db
      .insert(mxikCache)
      .values({
        mxikCode: entry.mxikCode,
        mxikName: entry.mxikName,
        label: entry.label,
        brandName: entry.brandName,
        groupName: entry.groupName,
        className: entry.className,
        packages: entry.packages as never,
        rawResponse: data as never,
      })
      .onConflictDoUpdate({
        target: mxikCache.mxikCode,
        set: {
          mxikName: entry.mxikName,
          label: entry.label,
          brandName: entry.brandName,
          groupName: entry.groupName,
          className: entry.className,
          packages: entry.packages as never,
          rawResponse: data as never,
          cachedAt: sql`now()`,
        },
      })

    return entry
  } catch (err) {
    logIntegration(db, {
      integration: 'mxik',
      methodName: 'lookup',
      methodType: 'GET',
      request: reqParams,
      response: null,
      status: err instanceof IntegrationError ? err.statusCode : null,
      errorMessage: err instanceof Error ? err.message : String(err),
      requestTimestamp,
      responseTimestamp: new Date(),
    })
    return handleHttpError(err, 'mxik.lookup')
  }
}
