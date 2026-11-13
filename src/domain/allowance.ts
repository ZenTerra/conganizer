import type { AppSettings, Cents, Con, IsoDate } from '../db/types';
import { conDays, isValidIso } from './dates';

export type AllowanceDayType = 'anreise' | 'voll' | 'abreise' | 'eintaegig';

export interface AllowanceDay {
  date: IsoDate;
  type: AllowanceDayType;
  amount: Cents;
}

export interface Allowance {
  days: AllowanceDay[];
  total: Cents;
  partialDays: number;
  fullDays: number;
  /** Letzter Reisetag – Datum für die Ausgabe in Accountable */
  lastDay: IsoDate | undefined;
}

export const ALLOWANCE_LABEL: Record<AllowanceDayType, string> = {
  anreise: 'Anreisetag',
  voll: 'voller Tag (24 h)',
  abreise: 'Abreisetag',
  eintaegig: 'eintägig (> 8 h)',
};

/** Reisezeitraum: Abfahrt/Rückkehr, sonst erster/letzter Con-Tag. */
export function travelRange(con: Pick<Con, 'startDate' | 'endDate' | 'departureDate' | 'returnDate'>): [IsoDate, IsoDate] {
  const from = isValidIso(con.departureDate) ? con.departureDate : con.startDate;
  const to = isValidIso(con.returnDate) ? con.returnDate : con.endDate;
  return [from, to < from ? from : to];
}

/**
 * Verpflegungspauschale: An- und Abreisetag je Teilbetrag, Tage dazwischen voller Satz,
 * eintägige Reise (Annahme: > 8 h abwesend) Teilbetrag.
 */
export function mealAllowance(
  con: Pick<Con, 'startDate' | 'endDate' | 'departureDate' | 'returnDate'>,
  rates: Pick<AppSettings, 'mealRatePartial' | 'mealRateFull'>,
): Allowance {
  const [from, to] = travelRange(con);
  const dates = conDays(from, to);
  const days: AllowanceDay[] = dates.map((date, i) => {
    if (dates.length === 1) return { date, type: 'eintaegig', amount: rates.mealRatePartial };
    if (i === 0) return { date, type: 'anreise', amount: rates.mealRatePartial };
    if (i === dates.length - 1) return { date, type: 'abreise', amount: rates.mealRatePartial };
    return { date, type: 'voll', amount: rates.mealRateFull };
  });
  return {
    days,
    total: days.reduce((s, d) => s + d.amount, 0),
    partialDays: days.filter((d) => d.type !== 'voll').length,
    fullDays: days.filter((d) => d.type === 'voll').length,
    lastDay: dates[dates.length - 1],
  };
}
