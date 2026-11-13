import type { ChecklistItem, Con } from '../db/types';

export const BACKUP_INTERVAL_DAYS = 7;
const DAY = 24 * 60 * 60 * 1000;

export type BackupReminder =
  | { reason: 'never' }
  | { reason: 'stale'; days: number }
  | { reason: 'conDone'; conName: string };

/**
 * Wann soll das Backup-Banner erscheinen?
 * - es gibt Daten, aber noch nie ein Backup
 * - letztes Backup älter als 7 Tage
 * - eine Con wurde seit dem letzten Backup abgeschlossen (alle „Nach der Con“-Punkte abgehakt)
 */
export function backupReminder(
  lastBackupAt: number | null,
  now: number,
  cons: Pick<Con, 'id' | 'name'>[],
  checklist: Pick<ChecklistItem, 'conId' | 'section' | 'checked' | 'updatedAt' | 'deleted'>[],
): BackupReminder | null {
  if (cons.length === 0) return null;
  if (lastBackupAt === null || lastBackupAt === undefined) return { reason: 'never' };

  for (const con of cons) {
    const after = checklist.filter((i) => i.conId === con.id && i.section === 'nach' && !i.deleted);
    if (after.length > 0 && after.every((i) => i.checked)) {
      const doneAt = Math.max(...after.map((i) => i.updatedAt));
      if (doneAt > lastBackupAt) return { reason: 'conDone', conName: con.name };
    }
  }

  const days = Math.floor((now - lastBackupAt) / DAY);
  return days >= BACKUP_INTERVAL_DAYS ? { reason: 'stale', days } : null;
}
