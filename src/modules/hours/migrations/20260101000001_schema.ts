import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('evidence'))) {
    await knex.schema.createTable('evidence', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('owner_ref').notNullable();
      t.string('file_name').notNullable();
      t.string('storage_ref').notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('hour_logs'))) {
    await knex.schema.createTable('hour_logs', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('assignment_id').notNullable().references('id').inTable('assignments');
      t.date('date').notNullable();
      t.string('start_time');
      t.string('end_time');
      t.decimal('duration_hours', 10, 2).notNullable();
      t.string('category').notNullable();
      t.text('description').notNullable();
      t.jsonb('evidence_ids').defaultTo('[]');
      t.string('status').notNullable().defaultTo('pending');
      t.text('rejection_reason');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('hour_logs');
  await knex.schema.dropTableIfExists('evidence');
}
