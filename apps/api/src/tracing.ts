import { NodeSDK } from "@opentelemetry/sdk-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { HttpInstrumentation } from "@opentelemetry/instrumentation-http";
import { FastifyInstrumentation } from "@opentelemetry/instrumentation-fastify";
import { UndiciInstrumentation } from "@opentelemetry/instrumentation-undici";
import { env } from "./env.js";

if (env.OTEL_TRACES_ENDPOINT) {
  const sdk = new NodeSDK({
    serviceName: env.OTEL_SERVICE_NAME,
    traceExporter: new OTLPTraceExporter({ url: env.OTEL_TRACES_ENDPOINT }),
    instrumentations: [
      new HttpInstrumentation(),
      new FastifyInstrumentation(),
      new UndiciInstrumentation(),
    ],
  });

  sdk.start();
  process.on("SIGTERM", () => sdk.shutdown());
}
