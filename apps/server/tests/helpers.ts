import { MongoMemoryServer } from 'mongodb-memory-server'
import { Db } from 'mongodb'
import { connectDb, closeDb } from '../src/db.js'
import { buildApp } from '../src/app.js'

let mongod: MongoMemoryServer

export async function startTestDb(): Promise<Db> {
  mongod = await MongoMemoryServer.create()
  const uri = mongod.getUri()
  process.env['MONGODB_URI'] = uri
  process.env['DB_NAME'] = 'runbook-test'
  process.env['JWT_SECRET'] = 'test-secret'
  return connectDb(uri, 'runbook-test')
}

export async function stopTestDb(): Promise<void> {
  await closeDb()
  await mongod?.stop()
}

export { buildApp }
