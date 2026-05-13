import 'dotenv/config'
import { buildApp } from './app.js'
import { connectDb } from './db.js'
import { attachSocket } from './socket/index.js'

async function start() {
  await connectDb(
    process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017',
    process.env['DB_NAME'] ?? 'runbook',
  )

  const app = buildApp({ logger: true })
  await app.ready()

  attachSocket(app, app.server)

  await app.listen({ port: Number(process.env['PORT'] ?? 3001), host: '0.0.0.0' })
}

start().catch((err) => {
  console.error(err)
  process.exit(1)
})
