import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('import_runs'))) {
    await knex.schema.createTable('import_runs', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('status').notNullable().defaultTo('queued');
      t.jsonb('request').defaultTo('{}');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('completed_at');
    });
  }

  if (!(await knex.schema.hasTable('import_results'))) {
    await knex.schema.createTable('import_results', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('run_id').references('id').inTable('import_runs');
      t.string('status').notNullable().defaultTo('pending_review');
      t.string('source_url').notNullable();
      t.jsonb('extracted_project').notNullable();
      t.decimal('extraction_confidence', 5, 2);
      t.jsonb('duplicate_project_ids').defaultTo('[]');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('import_results');
  await knex.schema.dropTableIfExists('import_runs');
}
