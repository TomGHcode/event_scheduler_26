import * as path from 'path';
import { Pool } from 'pg';
import { promises as fs } from 'fs';
import {
  Kysely,
  Migrator,
  PostgresDialect,
  FileMigrationProvider,
} from 'kysely';
import { Database } from './db';
import * as dotenv from 'dotenv';

dotenv.config();

async function migrateToLatest() {
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({
      pool: new Pool({
        // Pārliecināmies, ka izmantojam pareizo URL atkarībā no vides
        connectionString: process.env.DATABASE_URL || 'postgres://admin:secretpassword@localhost:5432/event_scheduler', // Uzmanību!: DEVELOPMENT ENVIRONMENT ONLY REMOVE IN PRODUCTION
      }),
    }),
  });

  const migrator = new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      // Norādām mapi, kurā atrodas mūsu migrācijas skripti
      migrationFolder: path.join(__dirname, 'migrations'),
    }),
  });

  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((it) => {
    if (it.status === 'Success') {
      console.log(`Migrācija "${it.migrationName}" izpildīta veiksmīgi!`);
    } else if (it.status === 'Error') {
      console.error(`Kļūda izpildot migrāciju "${it.migrationName}"`);
    }
  });

  if (error) {
    console.error('Neizdevās pabeigt datubāzes migrāciju:');
    console.error(error);
    process.exit(1);
  }

  await db.destroy();
}

migrateToLatest();