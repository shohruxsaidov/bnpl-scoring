import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { env } from "./env.js";

const hasTraces = Boolean(env.OTEL_TRACES_ENDPOINT);
const hasMetrics = Boolean(env.OTEL_METRICS_ENDPOINT);

if (hasTraces || hasMetrics) {
  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    ...(hasTraces && {
      traceExporter: new OTLPTraceExporter({ url: env.OTEL_TRACES_ENDPOINT }),
    }),
    ...(hasMetrics && {
      metricReader: new PeriodicExportingMetricReader({
        exporter: new OTLPMetricExporter({ url: env.OTEL_METRICS_ENDPOINT }),
        exportIntervalMillis: 15_000,
      }),
    }),
    instrumentations: [
      new HttpInstrumentation(),
      new FastifyInstrumentation(),
      new UndiciInstrumentation(),
    ],
  });

  sdk.start();
  process.on("SIGTERM", () => sdk.shutdown());
}
