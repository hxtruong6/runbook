import { MongoClient, Db } from 'mongodb'

let client: MongoClient | undefined
let _db: Db | undefined

export async function connectDb(uri: string, dbName: string): Promise<Db> {
  if (client) await client.close()
  client = new MongoClient(uri)
  await client.connect()
  _db = client.db(dbName)
  return _db
}

export function getDb(): Db {
  if (!_db) throw new Error('DB not connected. Call connectDb first.')
  return _db
}

export async function closeDb(): Promise<void> {
  await client?.close()
  client = undefined
  _db = undefined
}
