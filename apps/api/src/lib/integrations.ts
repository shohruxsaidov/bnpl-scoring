import ky, { HTTPError } from "ky";

export class IntegrationError extends Error {
  constructor(
    public readonly integration: string,
    public readonly statusCode: number,
    public readonly body: unknown,
  ) {
    super(`${integration}: HTTP ${statusCode}`);
    this.name = "IntegrationError";
  }
}

async function handleHttpError(err: unknown, integration: string): Promise<never> {
  if (err instanceof HTTPError) {
    let body: unknown;
    try {
      body = await err.response.json();
    } catch {
      body = await err.response.text().catch(() => null);
    }
    throw new IntegrationError(integration, err.response.status, body);
  }
  throw err;
}

export function createIntegrationClient(baseUrl: string, integration: string) {
  const base = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return ky.create({
    baseUrl: base,
    timeout: 15_000,
    retry: 0,
    hooks: {
      beforeError: [
        ({ error }) => {
          error.message = `[${integration}] ${error.message}`;
          return error;
        },
      ],
    },
  });
}

export { handleHttpError };
