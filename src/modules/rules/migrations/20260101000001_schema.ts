import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('requirement_rules'))) {
    await knex.schema.createTable('requirement_rules', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('name').notNullable();
      t.jsonb('scope').defaultTo('{}');
      t.decimal('required_hours', 10, 2).notNullable();
      t.jsonb('category_hours').defaultTo('{}');
      t.decimal('minimum_progress_percentage', 5, 2);
      t.jsonb('required_academic_statuses').defaultTo('[]');
      t.jsonb('required_course_codes').defaultTo('[]');
      t.jsonb('calendar_duration');
      t.boolean('active').defaultTo(true);
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }

  if (!(await knex.schema.hasTable('requirement_evaluations'))) {
    await knex.schema.createTable('requirement_evaluations', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('student_ref').notNullable();
      t.string('status').notNullable();
      t.decimal('required_hours', 10, 2);
      t.jsonb('result').notNullable();
      t.timestamp('evaluated_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('requirement_evaluations');
  await knex.schema.dropTableIfExists('requirement_rules');
}
