import type { Con, ConStatus, IsoDate } from '../db/types';

export interface StatusMeta {
  label: string;
  color: string;
  /** Con wird auf der Übersicht ausgegraut */
  inactive: boolean;
}

export const STATUS_META: Record<ConStatus, StatusMeta> = {
  interessant: { label: 'Interessant', color: 'var(--status-interessant)', inactive: false },
  beworben: { label: 'Beworben', color: 'var(--status-beworben)', inactive: false },
  warteliste: { label: 'Warteliste', color: 'var(--status-warteliste)', inactive: false },
  angenommen: { label: 'Angenommen', color: 'var(--status-angenommen)', inactive: false },
  abgelehnt: { label: 'Abgelehnt', color: 'var(--status-abgelehnt)', inactive: true },
  abgesagt: { label: 'Abgesagt', color: 'var(--status-abgesagt)', inactive: true },
};

/**
 * Felder, die beim Statuswechsel automatisch mitgesetzt werden:
 * „Beworben am“ bzw. „Zugesagt am“ = heute, falls noch leer.
 */
export function statusSideEffects(
  con: Pick<Con, 'appliedAt' | 'acceptedAt'>,
  next: ConStatus,
  today: IsoDate,
): Partial<Pick<Con, 'status' | 'appliedAt' | 'acceptedAt'>> {
  const changes: Partial<Pick<Con, 'status' | 'appliedAt' | 'acceptedAt'>> = { status: next };
  if (next !== 'interessant' && next !== 'abgesagt' && !con.appliedAt) changes.appliedAt = today;
  if (next === 'angenommen' && !con.acceptedAt) changes.acceptedAt = today;
  return changes;
}
