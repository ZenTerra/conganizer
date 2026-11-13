import { format } from 'date-fns';
import type { Trip, TripCategory, TripKind } from '../db/types';

export const CATEGORY_META: Record<TripCategory, { label: string; short: string }> = {
  geschaeftlich: { label: 'geschäftlich', short: 'gesch.' },
  wohnung: { label: 'Wohnung–Arbeit', short: 'Wohn./Arb.' },
  privat: { label: 'privat', short: 'privat' },
};

export const KIND_LABEL: Record<TripKind, string> = {
  hin: 'Hinfahrt',
  rueck: 'Rückfahrt',
  pendel: 'Pendelfahrt',
  sonstig: 'Fahrt',
};

export const nowTime = (): string => format(new Date(), 'HH:mm');

/** Gefahrene km aus km-Stand; `undefined`, wenn unvollständig oder Ende < Start. */
export function kmFromOdo(start: number | undefined, end: number | undefined): number | undefined {
  if (start === undefined || end === undefined || end < start) return undefined;
  return end - start;
}

const sortKey = (t: Trip) => `${t.date} ${t.startTime ?? t.endTime ?? '99:99'}`;

/** Chronologisch (älteste zuerst); bei gleichem Zeitpunkt nach km-Stand. */
export function sortTrips(trips: Trip[], dir: 'asc' | 'desc' = 'asc'): Trip[] {
  const sorted = [...trips].sort(
    (a, b) => sortKey(a).localeCompare(sortKey(b)) || (a.odoStart ?? 0) - (b.odoStart ?? 0),
  );
  return dir === 'asc' ? sorted : sorted.reverse();
}

/** Eine Fahrt ist offen, wenn sie gestartet, aber nicht beendet wurde. */
export const isOpen = (t: Trip): boolean => !!t.startTime && t.odoEnd === undefined && !t.endTime;

export function openTrip(trips: Trip[]): Trip | undefined {
  return sortTrips(trips.filter(isOpen), 'desc')[0];
}

/** Letzter bekannter km-Stand (für die km-Kette des Autos). */
export function lastOdometer(trips: Trip[], excludeId?: string): number | undefined {
  let best: number | undefined;
  for (const t of sortTrips(trips.filter((x) => x.id !== excludeId))) {
    const value = t.odoEnd ?? t.odoStart;
    if (value !== undefined) best = value;
  }
  return best;
}

export const routeLabel = (t: Pick<Trip, 'from' | 'to'>): string =>
  [t.from, t.to].filter((s) => s.trim()).join(' → ') || '–';

export function kmTotals(trips: Trip[]): Record<TripCategory, number> {
  const totals: Record<TripCategory, number> = { geschaeftlich: 0, wohnung: 0, privat: 0 };
  for (const t of trips) totals[t.category] += t.km || 0;
  return totals;
}

export const formatKm = (km: number | undefined): string =>
  km === undefined ? '' : `${km.toLocaleString('de-DE', { maximumFractionDigits: 1 })} km`;
