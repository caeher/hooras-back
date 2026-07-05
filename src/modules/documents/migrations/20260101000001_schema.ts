import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('document_requirements'))) {
    await knex.schema.createTable('document_requirements', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('key').notNullable().unique();
      t.string('label').notNullable();
      t.boolean('required').notNullable().defaultTo(true);
      t.jsonb('applies_to').defaultTo('{}');
      t.jsonb('allowed_file_types').defaultTo('[]');
      t.integer('max_file_size_mb');
      t.boolean('requires_approval').defaultTo(true);
      t.string('template_id');
    });
  }

  if (!(await knex.schema.hasTable('document_uploads'))) {
    await knex.schema.createTable('document_uploads', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.uuid('document_requirement_id').references('id').inTable('document_requirements');
      t.string('owner_ref').notNullable();
      t.string('file_name').notNullable();
      t.string('storage_ref').notNullable();
      t.uuid('assignment_id').references('id').inTable('assignments');
      t.string('status').notNullable().defaultTo('pending');
      t.text('rejection_reason');
      t.timestamp('uploaded_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('document_uploads');
  await knex.schema.dropTableIfExists('document_requirements');
}
