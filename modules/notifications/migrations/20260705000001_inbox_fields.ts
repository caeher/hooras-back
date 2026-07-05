import type { Knex } from 'knex';

export async function up(knex: Knex): Promise<void> {
  const hasRecipientStudentRef = await knex.schema.hasColumn('notifications', 'recipient_student_ref');
  if (!hasRecipientStudentRef) {
    await knex.schema.alterTable('notifications', (t) => {
      t.string('recipient_student_ref');
      t.string('title');
      t.text('body');
      t.timestamp('read_at');
      t.string('channel').notNullable().defaultTo('in_app');
    });
    await knex('notifications')
      .whereNull('recipient_student_ref')
      .update({ recipient_student_ref: knex.ref('recipient') });
  }
}

export async function down(knex: Knex): Promise<void> {
  if (await knex.schema.hasColumn('notifications', 'recipient_student_ref')) {
    await knex.schema.alterTable('notifications', (t) => {
      t.dropColumn('recipient_student_ref');
      t.dropColumn('title');
      t.dropColumn('body');
      t.dropColumn('read_at');
      t.dropColumn('channel');
    });
  }
}
