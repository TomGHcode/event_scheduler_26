import { Kysely, PostgresDialect, Generated, JSONColumnType } from 'kysely';
import { Pool } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

// 1. Tabulu saskarņu definīcijas
export interface UsersTable {
  id: Generated<number>;
  username: string;
  password_hash: string;
  discord_id: string | null;
  role: string;
  timezone: string;
  settings_json: JSONColumnType<any>;
}

export interface AvailabilityTablesTable {
  id: Generated<number>;
  user_id: number;
  name: string;
  is_active: boolean;
}

export interface IntervalsTable {
  id: Generated<number>;
  table_id: number;
  // Laiks glabājas kā minūtes no nedēļas sākuma (0 - 10079)
  start_minute: number;
  end_minute: number;
  status_level: 'Pieejams' | 'Varbut' | 'Nav pieejams'; // Statusa līmeņi tabulās
}

export interface EventTablesTable {
  id: Generated<number>;
  owner_id: number;
  invite_key: string;
  name: string;
  description: string | null;
}

export interface EventParticipantsTable {
  id: Generated<number>;
  event_table_id: number;
  user_id: number;
  availability_table_id: number | null; // Null, ja nav izvēlēta
  role_type: 'Owner' | 'Helper' | 'User' | 'Administrator'; // Lomas
  is_private: boolean; // Lietotājiem kas vēlas palikt anonīmi
}

export interface PlannedEventsTable {
  id: Generated<number>;
  event_table_id: number;
  start_time: Date; // UTC
  end_time: Date; // UTC
  metadata: JSONColumnType<any> | null;
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
    connectionString: process.env.DATABASE_URL || 'postgres://admin:secretpassword@localhost:5432/event_scheduler', // Uzmanību!: DEVELOPMENT ENVIRONMENT ONLY REMOVE IN PRODUCTION
  }),
});

export const db = new Kysely<Database>({
  dialect,
});