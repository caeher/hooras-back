import type { Knex } from 'knex';

interface InstanceSettingsJson {
  setupCompleted?: boolean;
  setupCompletedAt?: string | null;
  activeConnectors?: {
    auth?: string;
    student_data?: string;
  };
  locale?: string;
  timezone?: string;
  demoMode?: boolean;
}

function parseSettings(value: unknown): InstanceSettingsJson {
  if (value == null || value === '') return {};
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as InstanceSettingsJson;
    } catch {
      return {};
    }
  }
  return value as InstanceSettingsJson;
}

export async function up(knex: Knex): Promise<void> {
  const moduleCountRow = await knex('installed_modules').count('* as count').first();
  const hasModules = Number(moduleCountRow?.count ?? 0) > 0;

  const authConnector = hasModules
    ? await knex('installed_modules')
        .where({ module_type: 'auth_connector', enabled: true })
        .first()
    : null;
  const studentConnector = hasModules
    ? await knex('installed_modules')
        .where({ module_type: 'student_data_connector', enabled: true })
        .first()
    : null;

  const existing = await knex('instance_settings').first();

  const baseSettings: InstanceSettingsJson = {
    setupCompleted: hasModules,
    setupCompletedAt: hasModules ? new Date().toISOString() : null,
    activeConnectors: {
      auth: authConnector?.module_key as string | undefined,
      student_data: studentConnector?.module_key as string | undefined,
    },
    locale: 'es-SV',
    timezone: 'America/El_Salvador',
  };

  if (!existing) {
    await knex('instance_settings').insert({
      college_name: hasModules ? 'Universidad Demo El Salvador' : '',
      settings: JSON.stringify(baseSettings),
    });
    return;
  }

  const current = parseSettings(existing.settings);
  const merged: InstanceSettingsJson = {
    ...baseSettings,
    ...current,
    activeConnectors: {
      ...baseSettings.activeConnectors,
      ...current.activeConnectors,
    },
  };

  if (hasModules && !current.setupCompleted) {
    merged.setupCompleted = true;
    merged.setupCompletedAt = new Date().toISOString();
  }

  if (current.setupCompleted === undefined) {
    merged.setupCompleted = hasModules;
  }

  await knex('instance_settings')
    .where({ id: existing.id })
    .update({
      settings: JSON.stringify(merged),
      updated_at: new Date(),
    });
}

export async function down(knex: Knex): Promise<void> {
  const row = await knex('instance_settings').first();
  if (!row) return;

  const settings = parseSettings(row.settings);
  const { setupCompleted, setupCompletedAt, activeConnectors, ...rest } = settings;
  await knex('instance_settings')
    .where({ id: row.id })
    .update({
      settings: JSON.stringify(rest),
      updated_at: new Date(),
    });
}
