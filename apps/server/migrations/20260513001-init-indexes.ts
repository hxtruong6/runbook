import { Db } from 'mongodb'

export async function up(db: Db): Promise<void> {
  await db.collection('memberships').createIndex({ userId: 1, teamId: 1 }, { unique: true })
  await db.collection('memberships').createIndex({ teamId: 1 })
  await db.collection('scenarios').createIndex({ teamId: 1 })
  await db.collection('scenarios').createIndex({ projectId: 1 })
  await db.collection('projects').createIndex({ teamId: 1 })
  await db.collection('users').createIndex({ email: 1 }, { unique: true })
  await db.collection('teams').createIndex({ slug: 1 }, { unique: true })
}

export async function down(db: Db): Promise<void> {
  await db.collection('memberships').dropIndexes()
  await db.collection('scenarios').dropIndexes()
  await db.collection('projects').dropIndexes()
  await db.collection('users').dropIndex('email_1')
  await db.collection('teams').dropIndex('slug_1')
}
