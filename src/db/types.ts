/**
 * Datenmodell von ConGanizer.
 *
 * Alle synchronisierbaren Datensätze tragen `id`, `updatedAt` und `deleted`.
 * Löschen setzt nur `deleted = 1` (Tombstone), damit ein späterer Datei-Abgleich
 * zwischen Geräten Löschungen mit übertragen kann.
 *
 * Geldbeträge werden immer in **Cent** (Integer) gespeichert, Datumsangaben als
 * ISO-String `yyyy-MM-dd`.
 */

export interface Base {
  id: string;
  /** Millisekunden seit Epoch, gesetzt von der Repo-Schicht bei jeder Änderung. */
  updatedAt: number;
  /** 1 = gelöscht (Tombstone). Dexie kann keine Booleans indizieren. */
  deleted: 0 | 1;
}

/** Felder, die die Repo-Schicht selbst verwaltet. */
export type Managed = keyof Base;
export type NewRecord<T extends Base> = Omit<T, Managed>;

export type IsoDate = string;
export type Cents = number;

export const CON_STATUSES = [
  'interessant',
  'beworben',
  'warteliste',
  'angenommen',
  'abgelehnt',
  'abgesagt',
] as const;
export type ConStatus = (typeof CON_STATUSES)[number];

export type Reapply = 'ja' | 'nein' | 'vielleicht';

export interface Con extends Base {
  name: string;
  startDate: IsoDate;
  endDate: IsoDate;
  /** Abfahrt von zu Hause (für Verpflegungspauschale), Standard = startDate */
  departureDate?: IsoDate;
  /** Rückkehr nach Hause, Standard = endDate */
  returnDate?: IsoDate;

  status: ConStatus;
  appliedAt?: IsoDate;
  acceptedAt?: IsoDate;
  applicationOpens?: IsoDate;
  applicationCloses?: IsoDate;
  fee?: Cents;
  feeDue?: IsoDate;
  feePaid: boolean;

  venueName?: string;
  venueAddress?: string;
  hall?: string;
  booth?: string;
  tableSize?: string;
  power?: boolean;
  setupTimes?: string;
  teardownTimes?: string;
  contactName?: string;
  /** Freitext, eine Zeile pro Link/E-Mail */
  contactLinks?: string;
  notes?: string;

  coverImageId?: string;

  lessons?: string;
  rating?: number;
  reapply?: Reapply;

  /** Verknüpft Jahrgänge derselben Con (Duplizieren fürs nächste Jahr). */
  seriesId: string;
}

export interface Hotel extends Base {
  conId: string;
  booked: boolean;
  name?: string;
  address?: string;
  price?: Cents;
  checkIn?: IsoDate;
  checkOut?: IsoDate;
  bookingRef?: string;
  cancelDeadline?: IsoDate;
  notes?: string;
}

export type TripKind = 'hin' | 'rueck' | 'pendel' | 'sonstig';
/** Spalten „Gefahrene km“ im Fahrtenbuch: geschäftlich / Wohnung–Arbeit / privat */
export type TripCategory = 'geschaeftlich' | 'wohnung' | 'privat';
/** Uhrzeit `HH:mm` */
export type TimeOfDay = string;

export interface Trip extends Base {
  /** '' = Fahrt ohne Con */
  conId: string;
  date: IsoDate;
  startTime?: TimeOfDay;
  endTime?: TimeOfDay;
  from: string;
  to: string;
  purpose: string;
  /** km-Stand Fahrtbeginn / Fahrtende */
  odoStart?: number;
  odoEnd?: number;
  /** Gefahrene km (aus km-Stand berechnet oder von Hand) */
  km: number;
  kind: TripKind;
  category: TripCategory;
  /** Kosten/Ausgaben (z. B. Benzin, Öl) – nur zum Übertragen, zählt nicht als Kosten */
  costAmount?: Cents;
  costPurpose?: string;
  /** Ins Papier-Fahrtenbuch übertragen */
  transferred: boolean;
}

/** Zeilen im Kassenbericht: Ausgaben je Kategorie bzw. sonstige Einnahmen */
export type CashMovementType = 'wareneinkauf' | 'geschaeft' | 'privat' | 'sonstig' | 'einlage';

export interface CashMovement {
  id: string;
  type: CashMovementType;
  amount: Cents;
  note: string;
}

/** Anzahl pro Stückelung, Schlüssel = Wert in Cent (z. B. "2000" für 20 €). */
export type DenominationCount = Record<string, number>;

/** Ein Kassentag; ID deterministisch `${conId}_cash_${date}`. */
export interface CashDay extends Base {
  conId: string;
  date: IsoDate;
  /** Kassenbericht-Nr. (fortlaufend über alle Cons) */
  reportNo?: number;
  /** Kassenbestand des Vortages (Tag 1: Wechselgeld) */
  start?: Cents;
  /** Kassenbestand bei Geschäftsschluss */
  end?: Cents;
  /** SumUp-Kartenumsatz des Tages (nicht Teil des Kassenberichts) */
  card?: Cents;
  movements: CashMovement[];
  startCount?: DenominationCount;
  endCount?: DenominationCount;
  /** In den Papier-Kassenbericht übertragen */
  transferred: boolean;
}

export interface Expense extends Base {
  conId: string;
  label: string;
  amount: Cents;
}

export interface PackItem extends Base {
  conId: string;
  category: string;
  label: string;
  checked: boolean;
  order: number;
}

export type ChecklistSection = 'vor' | 'tag' | 'nach';
/** Punkte, die sich automatisch aus den Daten abhaken. */
export type ChecklistAuto = 'feePaid' | 'hotelBooked' | 'packDone';

export interface ChecklistItem extends Base {
  conId: string;
  section: ChecklistSection;
  /** Nur bei section = 'tag': der Con-Tag */
  date?: IsoDate;
  label: string;
  checked: boolean;
  auto?: ChecklistAuto;
  order: number;
}

export type ImageKind = 'cover' | 'ref';

export interface ConImage extends Base {
  conId: string;
  kind: ImageKind;
  blob: Blob;
  thumb: Blob;
  caption?: string;
  width: number;
  height: number;
}

/** Key-Value-Einstellungen; `id` ist der Schlüssel. */
export interface Setting extends Base {
  value: unknown;
}

/** Lokaler Sicherungsstand vor einem Import (wird nicht synchronisiert). */
export interface Snapshot {
  id: string;
  createdAt: number;
  data: string;
}

export interface PackTemplateItem {
  category: string;
  label: string;
}

export interface ChecklistTemplateItem {
  section: ChecklistSection;
  label: string;
  auto?: ChecklistAuto;
}

export interface AppSettings {
  homeAddress: string;
  /** Kilometerpauschale in Cent pro km */
  kmRate: Cents;
  /** Verpflegungspauschale An-/Abreisetag bzw. eintägig (> 8 h) */
  mealRatePartial: Cents;
  /** Verpflegungspauschale voller Tag (24 h) */
  mealRateFull: Cents;
  lastBackupAt: number | null;
  packTemplate: PackTemplateItem[];
  checklistTemplate: ChecklistTemplateItem[];
}
