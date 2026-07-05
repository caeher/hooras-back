import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('assignments'))) {
    await knex.schema.createTable('assignments', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('project_id').notNullable().references('id').inTable('projects');
      t.string('student_ref').notNullable();
      t.string('supervisor_ref');
      t.string('status').notNullable().defaultTo('active');
      t.timestamps(true, true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('assignments');
}
