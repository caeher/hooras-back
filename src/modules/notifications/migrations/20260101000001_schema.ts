import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  if (!(await knex.schema.hasTable('notifications'))) {
    await knex.schema.createTable('notifications', (t) => {
      t.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
      t.string('provider_key').notNullable();
      t.string('event_type').notNullable();
      t.string('recipient').notNullable();
      t.string('status').notNullable().defaultTo('queued');
      t.jsonb('payload').defaultTo('{}');
      t.string('external_message_id');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists('notifications');
}
