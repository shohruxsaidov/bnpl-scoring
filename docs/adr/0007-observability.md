# ADR-0007: Observability — Loki + Tempo + OpenTelemetry

## Status
Accepted

## Context
The API needs structured log aggregation and distributed tracing to debug integration failures (KATM, PlumGate, MXIK) and diagnose latency across the Deal Wizard flow. Both Loki and Tempo are self-hosted on `83.222.7.142`.

## Decisions

### Logs → Loki via pino-loki
The API ships logs directly to Loki using the `pino-loki` Pino transport (no agent required). Enabled only when `LOKI_URL` is set in the environment. In development, pino-pretty is used instead. In production without `LOKI_URL`, the logger falls back to stdout JSON.

Labels attached to every log stream: `app` (= `OTEL_SERVICE_NAME`) and `env` (`production`). Logs are batched in 5-second intervals.

### Metrics → Prometheus via OTLP HTTP
The `PeriodicExportingMetricReader` pushes metrics every 15 seconds to `OTEL_METRICS_ENDPOINT` (expected: `http://83.222.7.142:19090/v1/metrics`) using OTLP HTTP. Enabled only when `OTEL_METRICS_ENDPOINT` is set. Prometheus must have the OTLP receiver enabled (`--enable-feature=otlp-write-receiver`). Metrics include HTTP request counts and durations captured automatically by `instrumentation-http`.

Prometheus scraping was rejected: the API is not publicly reachable from the Prometheus host, so push is the only viable direction.

### Traces → Tempo via OTLP HTTP
The OpenTelemetry Node.js SDK is initialized in `src/tracing.ts` before any application modules load. Enabled only when `OTEL_TRACES_ENDPOINT` is set. The exporter sends spans to `OTEL_TRACES_ENDPOINT` (expected: `http://83.222.7.142:32000/v1/traces`) using OTLP HTTP (JSON over HTTP/1.1).

gRPC was rejected: no meaningful throughput advantage at current scale; OTLP HTTP is curl-debuggable.

### Instrumentation scope
Three auto-instrumentations are registered:
- `@opentelemetry/instrumentation-http` — all inbound HTTP requests
- `@opentelemetry/instrumentation-fastify` — Fastify route-level spans
- `@opentelemetry/instrumentation-undici` — outbound `fetch`/`ky` calls (KATM, PlumGate, MXIK, MyID)

PostgreSQL query spans are not available: the project uses the `postgres` (postgres.js) driver, which has no official OTel instrumentation. If query-level tracing is needed in the future, consider switching to `pg` + `@opentelemetry/instrumentation-pg`.

### Log–trace correlation
A Pino `mixin` reads the active OTel span context on every log call and injects `traceId` and `spanId` as top-level log fields. In Grafana, this allows jumping from a Loki log line directly to the corresponding Tempo trace.

### Env vars
| Variable | Purpose | Default |
|---|---|---|
| `LOKI_URL` | Loki base URL (no path) | unset → disabled |
| `OTEL_TRACES_ENDPOINT` | OTLP HTTP endpoint for traces | unset → disabled |
| `OTEL_METRICS_ENDPOINT` | OTLP HTTP endpoint for metrics | unset → disabled |
| `OTEL_SERVICE_NAME` | Service name tag on logs, traces, and metrics | `scoring-api` |

Both observability features are opt-in via env vars so the API runs normally in development without any external dependencies.
