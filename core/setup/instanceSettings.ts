import db from '../../database';
import type { InstanceSettingsJson } from '../../platform/types';

export function parseInstanceSettings(value: unknown): InstanceSettingsJson {
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

export async function getInstanceRow() {
  let row = await db('instance_settings').first();
  if (!row) {
    [row] = await db('instance_settings')
      .insert({
        college_name: '',
        settings: JSON.stringify({
          setupCompleted: false,
          setupCompletedAt: null,
          activeConnectors: {},
          locale: 'es-SV',
          timezone: 'America/El_Salvador',
        }),
      })
      .returning('*');
  }
  return row;
}

export async function getInstanceSettings(): Promise<InstanceSettingsJson> {
  const row = await getInstanceRow();
  return parseInstanceSettings(row.settings);
}

export async function updateInstanceSettings(
  patch: Partial<InstanceSettingsJson>,
): Promise<InstanceSettingsJson> {
  const row = await getInstanceRow();
  const current = parseInstanceSettings(row.settings);
  const merged = {
    ...current,
    ...patch,
    activeConnectors: {
      ...current.activeConnectors,
      ...patch.activeConnectors,
    },
  };
  await db('instance_settings')
    .where({ id: row.id })
    .update({
      settings: JSON.stringify(merged),
      updated_at: new Date(),
    });
  return merged;
}
