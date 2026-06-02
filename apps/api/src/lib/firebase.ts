import admin, { type messaging as MessagingNamespace } from 'firebase-admin'
import { env } from '../env.js'

const firebaseApp = admin.initializeApp({
  credential: admin.credential.cert({
    projectId: env.FIREBASE_PROJECT_ID,
    clientEmail: env.FIREBASE_CLIENT_EMAIL,
    // Env vars encode newlines as \n literals; restore them.
    privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
})

export const messaging: MessagingNamespace.Messaging = admin.messaging(firebaseApp)
