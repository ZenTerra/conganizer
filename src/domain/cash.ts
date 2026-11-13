/**
 * Kassenbericht nach Vorlage Avery Zweckform 305 (ohne Vorsteuer – Kleinunternehmer).
 *
 *   Kassenbestand bei Geschäftsschluss
 * + Ausgaben im Laufe des Tages (Wareneinkäufe, Geschäftsausgaben, Privatentnahmen, Sonstige)
 * = Summe
 * − Kassenbestand des Vortages
 * = Kasseneingang
 * − sonstige Einnahmen (Privateinlagen)
 * = Einnahmen (Tageslosung)
 */
import type { CashDay, CashMovementType, Cents, DenominationCount } from '../db/types';

export interface MovementMeta {
  label: string;
  hint: string;
  direction: 'out' | 'in';
}

export const MOVEMENT_TYPES: CashMovementType[] = ['privat', 'geschaeft', 'wareneinkauf', 'sonstig', 'einlage'];

export const MOVEMENT_META: Record<CashMovementType, MovementMeta> = {
  wareneinkauf: { label: 'Wareneinkauf', hint: 'Wareneinkäufe & Warennebenkosten', direction: 'out' },
  geschaeft: { label: 'Geschäftsausgabe', hint: 'z. B. Parken, Material, Klebeband', direction: 'out' },
  privat: { label: 'Privatentnahme', hint: 'z. B. Essen, Getränke', direction: 'out' },
  sonstig: { label: 'Sonstige Ausgabe', hint: 'alles andere, was rausgeht', direction: 'out' },
  einlage: { label: 'Privateinlage / sonst. Einnahme', hint: 'Geld, das in die Kasse gelegt wird', direction: 'in' },
};

export interface CashReport {
  vortag: Cents;
  endbestand: Cents;
  wareneinkauf: Cents;
  geschaeft: Cents;
  privat: Cents;
  sonstig: Cents;
  ausgaben: Cents;
  summe: Cents;
  kasseneingang: Cents;
  einlagen: Cents;
  tageslosung: Cents;
  /** Start- und Endbestand sind eingetragen */
  complete: boolean;
}

export function cashReport(day: Pick<CashDay, 'start' | 'end' | 'movements'>): CashReport {
  const sum = (type: CashMovementType) =>
    day.movements.filter((m) => m.type === type).reduce((s, m) => s + m.amount, 0);
  const wareneinkauf = sum('wareneinkauf');
  const geschaeft = sum('geschaeft');
  const privat = sum('privat');
  const sonstig = sum('sonstig');
  const einlagen = sum('einlage');
  const vortag = day.start ?? 0;
  const endbestand = day.end ?? 0;
  const ausgaben = wareneinkauf + geschaeft + privat + sonstig;
  const summe = endbestand + ausgaben;
  const kasseneingang = summe - vortag;
  return {
    vortag,
    endbestand,
    wareneinkauf,
    geschaeft,
    privat,
    sonstig,
    ausgaben,
    summe,
    kasseneingang,
    einlagen,
    tageslosung: kasseneingang - einlagen,
    complete: day.start !== undefined && day.end !== undefined,
  };
}

/** Ausgaben aus der Kasse, die als Kosten der Con zählen (ohne Privatentnahmen). */
export const businessCashCosts = (r: CashReport): Cents => r.wareneinkauf + r.geschaeft + r.sonstig;

/**
 * Übertrag auf den Folgetag: Der Startbestand von Tag N+1 folgt dem Endbestand von Tag N,
 * solange er leer ist oder noch dem alten Übertrag entspricht (also nicht von Hand geändert wurde).
 */
export function carryOverStart(
  nextStart: Cents | undefined,
  oldPrevEnd: Cents | undefined,
  newPrevEnd: Cents | undefined,
): Cents | undefined {
  return nextStart === undefined || nextStart === oldPrevEnd ? newPrevEnd : nextStart;
}

/** Nächste Kassenbericht-Nr.: höchste vergebene + 1 (mindestens 1). */
export function nextReportNo(days: Pick<CashDay, 'reportNo'>[]): number {
  return days.reduce((max, d) => Math.max(max, d.reportNo ?? 0), 0) + 1;
}

/** Stückelungen in Cent für die Zählhilfe */
export const DENOMINATIONS: Cents[] = [50000, 20000, 10000, 5000, 2000, 1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];

export const denominationLabel = (c: Cents): string => (c >= 100 ? `${c / 100} €` : `${c} ct`);

export function countTotal(count: DenominationCount | undefined): Cents {
  if (!count) return 0;
  return DENOMINATIONS.reduce((s, d) => s + d * (count[String(d)] ?? 0), 0);
}
