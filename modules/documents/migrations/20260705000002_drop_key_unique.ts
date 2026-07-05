import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  await knex.raw('ALTER TABLE document_requirements DROP CONSTRAINT IF EXISTS document_requirements_key_unique');
  await knex.raw('CREATE UNIQUE INDEX IF NOT EXISTS document_requirements_key_active_unique ON document_requirements (key) WHERE active = true');
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw('DROP INDEX IF EXISTS document_requirements_key_active_unique');
  // Re-adding the strict unique constraint. Note: this might fail if duplicate keys currently exist among inactive rows.
  await knex.raw('ALTER TABLE document_requirements ADD CONSTRAINT document_requirements_key_unique UNIQUE (key)');
}
