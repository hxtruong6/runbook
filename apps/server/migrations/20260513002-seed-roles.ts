import { Db } from 'mongodb'

// Documents the role hierarchy in the DB for future reference.
// Roles: owner > admin > member (enforced in app code, not DB constraints)
export async function up(db: Db): Promise<void> {
  await db.collection('_meta').insertOne({
    key: 'roles',
    values: ['owner', 'admin', 'member'],
    createdAt: new Date(),
  })
}

export async function down(db: Db): Promise<void> {
  await db.collection('_meta').deleteOne({ key: 'roles' })
}
