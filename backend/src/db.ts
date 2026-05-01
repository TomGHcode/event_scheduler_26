import { Kysely, PostgresDialect, Generated, JSONColumnType } from 'kysely';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// 1. Tabulu saskarņu definīcijas saskaņā ar specifikāciju

export interface UsersTable {
  id: Generated<number>;
  username: string;
  password_hash: string;
  discord_id: string | null;
  role: string;
  timezone: string;
  settings_json: JSONColumnType<any>; // [cite: 40]
}

export interface AvailabilityTablesTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  is_active: boolean; // [cite: 41]
}

export interface IntervalsTable {
  id: Generated<number>;
  table_id: number;
  // Laiks glabājas kā minūtes no nedēļas sākuma (0 - 10079) [cite: 36]
  start_minute: number; // [cite: 37]
  end_minute: number; // [cite: 38]
  status_level: 'Pieejams' | 'Varbut' | 'Nav pieejams'; // Atbilstoši specifikācijai [cite: 18, 42]
}

export interface EventTablesTable {
  id: Generated<number>;
  owner_id: number;
  invite_key: string;
  name: string;
  description: string | null; // [cite: 43]
}

export interface EventParticipantsTable {
  id: Generated<number>;
  event_table_id: number;
  user_id: number;
  availability_table_id: number | null; // Null, ja nav izvēlēta [cite: 23, 44]
  role_type: 'Owner' | 'Helper' | 'User' | 'Administrator'; // [cite: 25, 26, 27, 28, 44]
  is_private: boolean; // [cite: 44]
}

export interface PlannedEventsTable {
  id: Generated<number>;
  event_table_id: number;
  start_time: Date; // UTC [cite: 45]
  end_time: Date; // UTC [cite: 45]
  metadata: JSONColumnType<any> | null; // [cite: 45]
}

// 2. Apkopojam visu galvenajā Database saskarnē
export interface Database {
  users: UsersTable;
  availability_tables: AvailabilityTablesTable;
  intervals: IntervalsTable;
  event_tables: EventTablesTable;
  event_participants: EventParticipantsTable;
  planned_events: PlannedEventsTable;
}

// 3. Inicializējam Kysely instanci
const dialect = new PostgresDialect({
  pool: new Pool({
    connectionString: process.env.DATABASE_URL || 'postgres://admin:secretpassword@localhost:5432/event_scheduler',
  }),
});

export const db = new Kysely<Database>({
  dialect,
});