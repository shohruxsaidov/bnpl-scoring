import type { Db } from "../../db";
import { integrationLogs } from "./db/schema";

const REDACTED = "[REDACTED]";
const SENSITIVE_KEYS = new Set([
  "client_secret",
  "access_token",
  "password",
  "token",
]);
const PINFL_RE = /^\d{14}$/;

function maskPinfl(val: string): string {
  return val.slice(0, 4) + "****" + val.slice(8);
}

function redact(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) return payload;
  if (Array.isArray(payload)) return payload.map(redact);
  return Object.fromEntries(
    Object.entries(payload as Record<string, unknown>).map(([k, v]) => {
      if (SENSITIVE_KEYS.has(k)) return [k, REDACTED];
      if (typeof v === "string" && PINFL_RE.test(v)) return [k, maskPinfl(v)];
      if (typeof v === "object") return [k, redact(v)];
      return [k, v];
    }),
  );
}

export interface IntegrationLogEntry {
  integration: string;
  methodName: string;
  methodType: string;
  request: unknown;
  response: unknown;
  status: number | null;
  errorMessage: string | null;
  /** When the request left the service. */
  requestTimestamp: Date;
  /** When the response (or error) was received. */
  responseTimestamp: Date;
}

export function logIntegration(db: Db, entry: IntegrationLogEntry): void {
  db.insert(integrationLogs)
    .values({
      integration: entry.integration,
      methodName: entry.methodName,
      methodType: entry.methodType,
      request: redact(entry.request) as Record<string, unknown>,
      response: redact(entry.response) as Record<string, unknown>,
      status: entry.status,
      errorMessage: entry.errorMessage,
      requestTimestamp: entry.requestTimestamp,
      responseTimestamp: entry.responseTimestamp,
      responseTimeInMs:
        entry.responseTimestamp.getTime() - entry.requestTimestamp.getTime(),
    })
    .catch(() => {
      // fire-and-forget: log write failures must never surface to the caller
    });
}
