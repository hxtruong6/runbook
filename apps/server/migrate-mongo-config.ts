import 'dotenv/config'

const config = {
  mongodb: {
    url: process.env['MONGODB_URI'] ?? 'mongodb://localhost:27017',
    databaseName: process.env['DB_NAME'] ?? 'runbook',
  },
  migrationsDir: 'migrations',
  changelogCollectionName: '_migrations',
  migrationFileExtension: '.ts',
  useFileHash: false,
  moduleSystem: 'esm',
}

export default config
