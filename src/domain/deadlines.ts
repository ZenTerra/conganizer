import type { Con, Hotel, IsoDate } from '../db/types';
import { todayIso } from './dates';

export type DeadlineKind = 'appOpens' | 'appCloses' | 'feeDue' | 'hotelCancel';

export interface Deadline {
  conId: string;
  conName: string;
  date: IsoDate;
  kind: DeadlineKind;
  label: string;
}

/** Alle relevanten Fristen einer Con – unabhängig davon, ob sie schon vorbei sind. */
export function conDeadlines(con: Con, hotels: Hotel[]): Deadline[] {
  const out: Deadline[] = [];
  const add = (date: IsoDate | undefined, kind: DeadlineKind, label: string) => {
    if (date) out.push({ conId: con.id, conName: con.name, date, kind, label });
  };
  const inactive = con.status === 'abgelehnt' || con.status === 'abgesagt';

  if (con.status === 'interessant') {
    add(con.applicationOpens, 'appOpens', 'Bewerbung öffnet');
    add(con.applicationCloses, 'appCloses', 'Bewerbungsschluss');
  }
  if (!con.feePaid && !inactive) add(con.feeDue, 'feeDue', 'Standgebühr fällig');
  // Hotel-Storno ist auch (gerade!) bei abgesagten Cons relevant
  for (const h of hotels) {
    if (h.booked && h.conId === con.id) {
      add(h.cancelDeadline, 'hotelCancel', h.name ? `Storno-Frist ${h.name}` : 'Storno-Frist Hotel');
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export function upcoming(deadlines: Deadline[], today: IsoDate = todayIso()): Deadline[] {
  return deadlines.filter((d) => d.date >= today).sort((a, b) => a.date.localeCompare(b.date));
}

export function nextDeadline(con: Con, hotels: Hotel[], today: IsoDate = todayIso()): Deadline | undefined {
  return upcoming(conDeadlines(con, hotels), today)[0];
}
