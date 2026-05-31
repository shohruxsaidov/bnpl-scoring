import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import { env } from '../env'
import { broadcastPush } from '../modules/push/service'

const client = postgres(env.DATABASE_URL)
const db = drizzle(client)

await broadcastPush(db, {
  type: 'admin_message',
  params: {
    title: 'Test Push',
    body: 'Push notifications are working!',
  },
  id: 'test-' + Date.now(),
  read: false,
  createdAt: new Date().toISOString(),
})

console.log('Push sent.')
await client.end()
