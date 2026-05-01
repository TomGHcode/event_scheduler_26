import { Kysely, sql } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  // 1. Users tabula
  await db.schema
    .createTable('users')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('username', 'varchar', (col) => col.notNull().unique())
    .addColumn('password_hash', 'varchar', (col) => col.notNull())
    .addColumn('discord_id', 'varchar')
    .addColumn('role', 'varchar', (col) => col.notNull().defaultTo('User'))
    .addColumn('timezone', 'varchar', (col) => col.notNull().defaultTo('UTC'))
    .addColumn('settings_json', 'jsonb', (col) => col.defaultTo('{}'))
    .execute();

  // 2. Availability_Tables tabula
  await db.schema
    .createTable('availability_tables')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('user_id', 'integer', (col) => col.references('users.id').onDelete('cascade').notNull())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(true).notNull())
    .execute();

  // 3. Intervals tabula
  await db.schema
    .createTable('intervals')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('table_id', 'integer', (col) => col.references('availability_tables.id').onDelete('cascade').notNull())
    .addColumn('start_minute', 'integer', (col) => col.notNull())
    .addColumn('end_minute', 'integer', (col) => col.notNull())
    .addColumn('status_level', 'varchar', (col) => col.notNull())
    .execute();

  // 4. Event_Tables tabula
  await db.schema
    .createTable('event_tables')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('owner_id', 'integer', (col) => col.references('users.id').onDelete('cascade').notNull())
    .addColumn('invite_key', 'varchar', (col) => col.notNull().unique())
    .addColumn('name', 'varchar', (col) => col.notNull())
    .addColumn('description', 'text')
    .execute();

  // 5. Event_Participants tabula
  await db.schema
    .createTable('event_participants')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('event_table_id', 'integer', (col) => col.references('event_tables.id').onDelete('cascade').notNull())
    .addColumn('user_id', 'integer', (col) => col.references('users.id').onDelete('cascade').notNull())
    .addColumn('availability_table_id', 'integer', (col) => col.references('availability_tables.id').onDelete('set null'))
    .addColumn('role_type', 'varchar', (col) => col.notNull().defaultTo('User'))
    .addColumn('is_private', 'boolean', (col) => col.defaultTo(false).notNull())
    .execute();

  // 6. Planned_Events tabula
  await db.schema
    .createTable('planned_events')
    .addColumn('id', 'serial', (col) => col.primaryKey())
    .addColumn('event_table_id', 'integer', (col) => col.references('event_tables.id').onDelete('cascade').notNull())
    .addColumn('start_time', 'timestamp', (col) => col.notNull())
    .addColumn('end_time', 'timestamp', (col) => col.notNull())
    .addColumn('metadata', 'jsonb')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('planned_events').execute();
  await db.schema.dropTable('event_participants').execute();
  await db.schema.dropTable('event_tables').execute();
  await db.schema.dropTable('intervals').execute();
  await db.schema.dropTable('availability_tables').execute();
  await db.schema.dropTable('users').execute();
}