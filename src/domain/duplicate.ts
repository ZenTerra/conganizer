import { addDays } from 'date-fns';
import type { Con, IsoDate, NewRecord } from '../db/types';
import { isValidIso, parseIso, toIso } from './dates';

/** 52 Wochen – Cons finden meist am gleichen Wochenende statt, der Wochentag bleibt gleich. */
export const NEXT_YEAR_DAYS = 364;

export const shiftIso = (iso: IsoDate | undefined, days: number): IsoDate | undefined =>
  isValidIso(iso) ? toIso(addDays(parseIso(iso), days)) : undefined;

/** „DoKomi 2027“ → „DoKomi 2028“; ohne Jahreszahl bleibt der Name gleich. */
export function nextYearName(name: string): string {
  const matches = [...name.matchAll(/\b(19|20)\d{2}\b/g)];
  if (matches.length === 0) return name;
  const last = matches[matches.length - 1];
  const year = Number(last[0]) + 1;
  return name.slice(0, last.index) + year + name.slice(last.index! + 4);
}

/**
 * Daten für den nächsten Jahrgang: Name/Ort/Logistik/Kontakt übernehmen, Termine um 52 Wochen
 * verschieben (als Schätzung), Status, Zahlungen, Bewertung und Nachbereitung zurücksetzen.
 */
export function nextYearDraft(con: Con): Omit<NewRecord<Con>, 'coverImageId'> {
  const s = (d: IsoDate | undefined) => shiftIso(d, NEXT_YEAR_DAYS);
  return {
    name: nextYearName(con.name),
    startDate: s(con.startDate) ?? con.startDate,
    endDate: s(con.endDate) ?? con.endDate,
    departureDate: s(con.departureDate),
    returnDate: s(con.returnDate),
    status: 'interessant',
    applicationOpens: s(con.applicationOpens),
    applicationCloses: s(con.applicationCloses),
    fee: con.fee,
    feePaid: false,
    venueName: con.venueName,
    venueAddress: con.venueAddress,
    hall: con.hall,
    tableSize: con.tableSize,
    power: con.power,
    setupTimes: con.setupTimes,
    teardownTimes: con.teardownTimes,
    contactName: con.contactName,
    contactLinks: con.contactLinks,
    notes: con.notes,
    seriesId: con.seriesId,
  };
}
