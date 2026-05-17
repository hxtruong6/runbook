import { Db } from 'mongodb'

export async function up(db: Db): Promise<void> {
  // Ensure the collection exists
  const collections = await db.listCollections({ name: 'shares' }).toArray()
  if (collections.length === 0) {
    await db.createCollection('shares')
  }

  // TTL index — MongoDB automatically removes documents when expiresAt passes
  await db.collection('shares').createIndex(
    { expiresAt: 1 },
    { expireAfterSeconds: 0, name: 'shares_ttl' }
  )

  // Unique index on slug for fast lookups and slug uniqueness guarantee
  await db.collection('shares').createIndex(
    { slug: 1 },
    { unique: true, name: 'shares_slug_unique' }
  )
}

export async function down(db: Db): Promise<void> {
  await db.collection('shares').dropIndex('shares_ttl')
  await db.collection('shares').dropIndex('shares_slug_unique')
}
