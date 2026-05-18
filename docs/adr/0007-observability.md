# ADR 0007: Observability Stack

**Status:** Accepted

## Stack

| Signal | Storage | Collection |
|---|---|---|
| Logs | Self-hosted Loki 3.3.2 | Grafana Alloy (Docker log scrape + OTLP) |
| Traces | Self-hosted Grafana Tempo 2.7 | Grafana Alloy (OTLP receiver → Tempo) |
| Metrics | Self-hosted Prometheus 3.1 | Grafana Alloy (app `/metrics` scrape → remote_write) |
| Dashboards | Self-hosted Grafana 11.4 | All three datasources wired with cross-signal links |
| Instrumentation | OpenTelemetry Node.js SDK | OTLP export to Alloy on port 4317 (gRPC) |

## Priority instrumentation targets

Three places where latency or failure directly impacts business outcomes and is invisible in a flat log line:

1. **Scoring job latency** — time from Deal creation to Score assignment, segmented into KATM API wait vs. internal compute.
2. **KATM API** — call success rate and p99 latency. External dependency the platform cannot control; degradation must be detected before it fails Deals silently.
3. **Payment webhook processing** — Payme and Click webhook round-trip time and error rate. SLA breaches here block installment recording.

## Decisions

**Grafana as the single observability pane.** Logs (Loki), traces (Tempo), and metrics (Prometheus) are all queried from one Grafana instance already in the Compose stack. The three datasources are cross-linked: a log line links to its trace, a trace links to its logs, a metrics spike links to a filtered log view. Separate dashboarding tools (Datadog, Grafana Cloud, Kibana) rejected — data-residency requirement means no SaaS, and running two UI tools doubles operator burden.

**Grafana Tempo over Jaeger for traces.** Tempo is native to the Grafana stack: Alloy has a first-class `otelcol.exporter.otlp` component that writes directly to Tempo, and Grafana's trace viewer links trace spans to Loki log lines by `traceId` out of the box. Jaeger rejected: it requires a separate UI and a separate Alloy exporter configuration, with no built-in Loki correlation.

**Prometheus over Mimir for metrics.** Mimir is a distributed system designed for multi-tenant, long-retention, high-cardinality metrics at scale. This platform runs on a single host. A standalone Prometheus container with 15-day retention covers weekly trend visibility and alerting without the operational complexity of Mimir's object-storage backend. Mimir can be adopted later if retention or cardinality requirements grow.

**Grafana Alloy as the single collection agent.** Alloy is already in the stack. It serves three roles without adding another process: (1) receives OTLP from the Node.js app over gRPC port 4317, fans traces to Tempo and logs to Loki; (2) scrapes Docker container logs via the Docker socket (existing); (3) scrapes the app's `/metrics` Prometheus endpoint and ships to Prometheus via remote write. Running separate agents (OTel Collector + Promtail + node_exporter) rejected — Alloy consolidates all three with one config file.

**OpenTelemetry Node.js SDK for instrumentation.** The SDK auto-instruments Fastify (HTTP spans), pg (database spans), and outbound HTTP calls (KATM, Payme, Click) with no manual span creation needed for the priority targets. The OTLP exporter sends to Alloy — vendor-neutral, so the backend (Tempo) can be swapped without changing application code. Fastify-specific tracing libraries (e.g., `@autotelic/fastify-opentelemetry`) rejected: vendor-coupled and require manual propagation setup.

**100% head-based sampling.** Every Deal and Score is a business event with audit and dispute implications. Dropping traces to reduce storage cost is unacceptable at this scale — Tempo with 7-day retention on local storage fits on a single host. Tail-based sampling (drop only successful, fast requests) adds a tail-sampling processor between Alloy and Tempo; rejected in v1 as premature complexity. Revisit when trace volume exceeds disk budget.

**Self-hosted, no logs or traces leave the host.** Credit bureau data (KATM responses), scoring inputs, and payment webhook payloads appear in traces and logs. Data-residency is a hard requirement. All five observability containers (Alloy, Loki, Tempo, Prometheus, Grafana) run in the same Compose stack as the application.

## Retention

| Signal | Retention | Rationale |
|---|---|---|
| Logs (Loki) | 30 days | Covers a billing cycle for dispute investigation |
| Traces (Tempo) | 7 days | Covers post-release observation window; traces are large |
| Metrics (Prometheus) | 15 days | Covers two weekly comparison windows for trend alerts |

## Alloy data flow

```
Node.js app
  └─ OTLP gRPC → Alloy :4317
                  ├─ traces  → otelcol.exporter.otlp  → Tempo  :4317
                  ├─ logs    → otelcol.exporter.loki   → Loki   :3100
                  └─ metrics → prometheus.remote_write → Prometheus :9090

Docker socket → loki.source.docker → Loki :3100  (container stderr/stdout)
nginx volume  → loki.source.file   → Loki :3100  (access + error logs)
```

## Grafana cross-signal correlation

- **Trace → Logs:** Tempo datasource configured with a derived field on `traceId` that links to a Loki query `{job="scoring"} |= "${__value.raw}"`.
- **Log → Trace:** Loki datasource configured with a derived field on log lines containing `traceId=` that opens the matching Tempo trace.
- **Metrics → Logs:** Dashboard panels use Grafana's "Explore logs" link with a time range and label filter matching the panel's service label.
