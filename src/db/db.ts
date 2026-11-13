import Dexie, { type Table } from 'dexie';
import type {
  CashDay,
  ChecklistItem,
  Con,
  ConImage,
  Expense,
  Hotel,
  PackItem,
  Setting,
  Snapshot,
  Trip,
} from './types';

export class ConGanizerDB extends Dexie {
  cons!: Table<Con, string>;
  hotels!: Table<Hotel, string>;
  trips!: Table<Trip, string>;
  cashDays!: Table<CashDay, string>;
  expenses!: Table<Expense, string>;
  packItems!: Table<PackItem, string>;
  checklistItems!: Table<ChecklistItem, string>;
  images!: Table<ConImage, string>;
  settings!: Table<Setting, string>;
  snapshots!: Table<Snapshot, string>;

  constructor(name = 'conganizer') {
    super(name);
    this.version(1).stores({
      cons: 'id, startDate, status, seriesId, updatedAt',
      hotels: 'id, conId, updatedAt',
      trips: 'id, conId, date, updatedAt',
      cashDays: 'id, conId, date, updatedAt',
      expenses: 'id, conId, updatedAt',
      packItems: 'id, conId, updatedAt',
      checklistItems: 'id, conId, updatedAt',
      images: 'id, conId, updatedAt',
      settings: 'id, updatedAt',
      snapshots: 'id, createdAt',
    });
  }
}

export const db = new ConGanizerDB();

/** Tabellen, die zu einer Con gehören (für kaskadierendes Löschen, Export, Duplizieren). */
export const CHILD_TABLES = [
  'hotels',
  'trips',
  'cashDays',
  'expenses',
  'packItems',
  'checklistItems',
  'images',
] as const;
export type ChildTableName = (typeof CHILD_TABLES)[number];

/** Alle synchronisierbaren Tabellen. */
export const SYNC_TABLES = ['cons', ...CHILD_TABLES, 'settings'] as const;
export type SyncTableName = (typeof SYNC_TABLES)[number];

/** Bittet den Browser, die Daten nicht automatisch zu löschen. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    if (navigator.storage?.persist) return await navigator.storage.persist();
  } catch {
    /* ignorieren */
  }
  return false;
}
