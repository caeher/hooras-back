import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('project_applications'))) {
    await knex.schema.createTable('project_applications', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('project_id').notNullable().references('id').inTable('projects');
      t.string('student_ref').notNullable();
      t.string('status').notNullable().defaultTo('submitted');
      t.text('motivation');
      t.text('rejection_reason');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('project_applications');
}
