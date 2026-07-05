import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('certificates'))) {
    await knex.schema.createTable('certificates', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('student_ref').notNullable();
      t.uuid('assignment_id').references('id').inTable('assignments');
      t.string('status').notNullable().defaultTo('generated');
      t.uuid('document_id').references('id').inTable('document_uploads');
      t.string('verification_code').notNullable().unique();
      t.timestamp('generated_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('certificates');
}
