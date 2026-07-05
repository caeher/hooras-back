import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('projects'))) {
    await knex.schema.createTable('projects', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('title').notNullable();
      t.text('description').notNullable();
      t.string('organization_name').notNullable();
      t.string('location');
      t.string('modality');
      t.jsonb('categories').defaultTo('[]');
      t.integer('capacity');
      t.date('starts_at');
      t.date('ends_at');
      t.date('application_deadline');
      t.boolean('public_safe').defaultTo(false);
      t.string('status').notNullable().defaultTo('draft');
      t.string('source_type').notNullable().defaultTo('college_created');
      t.string('source_url');
      t.decimal('extraction_confidence', 5, 2);
      t.timestamps(true, true);
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('projects');
}
