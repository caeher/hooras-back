import db from '../../../database';

export interface HourLogEvidence {
  id: string;
  fileName: string;
  storageRef: string;
}

export interface HourLogDto {
  id: string;
  assignmentId: string;
  date: string;
  startTime?: string;
  endTime?: string;
  durationHours: number;
  category: string;
  description: string;
  evidenceIds: string[];
  status: string;
  rejectionReason?: string;
  createdAt: string;
  evidence?: HourLogEvidence[];
}

export function mapHourLogRow(row: Record<string, unknown>): HourLogDto {
  const evidenceIds =
    typeof row.evidence_ids === 'string'
      ? (JSON.parse(row.evidence_ids) as string[])
      : ((row.evidence_ids as string[] | undefined) ?? []);

  return {
    id: row.id as string,
    assignmentId: row.assignment_id as string,
    date: row.date as string,
    startTime: row.start_time as string | undefined,
    endTime: row.end_time as string | undefined,
    durationHours: Number(row.duration_hours),
    category: row.category as string,
    description: row.description as string,
    evidenceIds,
    status: row.status as string,
    rejectionReason: row.rejection_reason as string | undefined,
    createdAt: (row.created_at as Date)?.toISOString?.() ?? (row.created_at as string),
  };
}

export async function enrichHourLogsWithEvidence(logs: HourLogDto[]): Promise<HourLogDto[]> {
  const evidenceIds = [...new Set(logs.flatMap((log) => log.evidenceIds))];
  if (!evidenceIds.length) {
    return logs.map((log) => ({ ...log, evidence: [] }));
  }

  const evidenceRows = await db('evidence').whereIn('id', evidenceIds);
  const evidenceById = new Map<string, HourLogEvidence>(
    evidenceRows.map((row) => [
      row.id as string,
      {
        id: row.id as string,
        fileName: row.file_name as string,
        storageRef: row.storage_ref as string,
      },
    ]),
  );

  return logs.map((log) => ({
    ...log,
    evidence: log.evidenceIds
      .map((id) => evidenceById.get(id))
      .filter((item): item is HourLogEvidence => Boolean(item)),
  }));
}
