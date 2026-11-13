import { differenceInCalendarDays, eachDayOfInterval, format, isValid, parseISO } from 'date-fns';
import { de } from 'date-fns/locale';
import type { IsoDate } from '../db/types';

export const toIso = (d: Date): IsoDate => format(d, 'yyyy-MM-dd');
export const todayIso = (): IsoDate => toIso(new Date());

/** Datum-Strings `yyyy-MM-dd` werden als lokale Mitternacht interpretiert. */
export const parseIso = (iso: IsoDate): Date => parseISO(iso);

export const isValidIso = (iso: string | undefined): iso is IsoDate =>
  !!iso && /^\d{4}-\d{2}-\d{2}$/.test(iso) && isValid(parseISO(iso));

export const formatDate = (iso: IsoDate | undefined): string =>
  isValidIso(iso) ? format(parseIso(iso), 'dd.MM.yyyy') : '';

/** „Sa, 14.03.“ */
export const formatWeekdayDate = (iso: IsoDate): string =>
  isValidIso(iso) ? format(parseIso(iso), 'EEEEEE, dd.MM.', { locale: de }) : '';

/** „14.–16.03.2026“, „30.04.–02.05.2026“, „28.12.2026–02.01.2027“ oder ein einzelnes Datum. */
export function formatRange(start: IsoDate, end: IsoDate): string {
  if (!isValidIso(start)) return '';
  if (!isValidIso(end) || end === start) return formatDate(start);
  const s = parseIso(start);
  const e = parseIso(end);
  if (s.getFullYear() !== e.getFullYear()) return `${format(s, 'dd.MM.yyyy')}–${format(e, 'dd.MM.yyyy')}`;
  if (s.getMonth() !== e.getMonth()) return `${format(s, 'dd.MM.')}–${format(e, 'dd.MM.yyyy')}`;
  return `${format(s, 'dd.')}–${format(e, 'dd.MM.yyyy')}`;
}

/** Alle Kalendertage von start bis end (inklusive), höchstens 31. */
export function conDays(start: IsoDate, end: IsoDate): IsoDate[] {
  if (!isValidIso(start)) return [];
  if (!isValidIso(end) || end < start) return [start];
  return eachDayOfInterval({ start: parseIso(start), end: parseIso(end) })
    .slice(0, 31)
    .map(toIso);
}

export const daysUntil = (iso: IsoDate, today: IsoDate = todayIso()): number =>
  differenceInCalendarDays(parseIso(iso), parseIso(today));

/** „heute“, „morgen“, „in 5 Tagen“, „vor 2 Tagen“ */
export function relativeDays(iso: IsoDate, today: IsoDate = todayIso()): string {
  const n = daysUntil(iso, today);
  if (n === 0) return 'heute';
  if (n === 1) return 'morgen';
  if (n === -1) return 'gestern';
  return n > 0 ? `in ${n} Tagen` : `vor ${-n} Tagen`;
}
