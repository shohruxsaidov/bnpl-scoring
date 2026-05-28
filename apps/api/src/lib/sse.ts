import type { ServerResponse } from 'node:http'

const connections = new Map<string, Set<ServerResponse>>()

export function sseSubscribe(
  actorType: string,
  actorId: string,
  res: ServerResponse,
): () => void {
  const key = `${actorType}:${actorId}`
  if (!connections.has(key)) connections.set(key, new Set())
  connections.get(key)!.add(res)
  return () => connections.get(key)?.delete(res)
}

export function ssePush(
  actorType: string,
  actorId: string,
  eventType: string,
  data: unknown,
): void {
  const key = `${actorType}:${actorId}`
  const subs = connections.get(key)
  if (!subs?.size) return
  const payload = `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of subs) {
    try {
      res.write(payload)
    } catch {
      subs.delete(res)
    }
  }
}
