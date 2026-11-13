/**
 * Repo-Schicht: der einzige Weg, Daten zu schreiben.
 * Setzt `updatedAt` und `deleted` konsequent, damit der Datei-Abgleich
 * (Merge pro Datensatz) zuverlässig funktioniert.
 */
import type { Table } from 'dexie';
import { CHILD_TABLES, db } from './db';
import { DEFAULT_SETTINGS } from './templates';
import { conDays } from '../domain/dates';
import { nextYearDraft } from '../domain/duplicate';
import type {
  AppSettings,
  Base,
  CashDay,
  ChecklistItem,
  Con,
  NewRecord,
  PackItem,
} from './types';

export const newId = (): string => crypto.randomUUID();
const now = (): number => Date.now();

export function alive<T extends Base>(rows: T[]): T[] {
  return rows.filter((r) => !r.deleted);
}

export async function createRecord<T extends Base>(
  table: Table<T, string>,
  data: NewRecord<T>,
  id: string = newId(),
): Promise<T> {
  const record = { ...data, id, updatedAt: now(), deleted: 0 } as T;
  await table.add(record);
  return record;
}

export async function updateRecord<T extends Base>(
  table: Table<T, string>,
  id: string,
  changes: Partial<NewRecord<T>>,
): Promise<void> {
  await db.transaction('rw', table, async () => {
    const current = await table.get(id);
    if (!current || current.deleted) return;
    await table.put({ ...current, ...changes, id, updatedAt: now(), deleted: 0 } as T);
  });
}

export async function deleteRecord<T extends Base>(table: Table<T, string>, id: string): Promise<void> {
  await db.transaction('rw', table, async () => {
    const current = await table.get(id);
    if (!current || current.deleted) return;
    const tombstone = { ...current, deleted: 1, updatedAt: now() } as unknown as Record<string, unknown>;
    // Bilddaten nicht als Tombstone mitschleppen
    if (table.name === 'images') {
      tombstone.blob = new Blob([]);
      tombstone.thumb = new Blob([]);
    }
    await table.put(tombstone as unknown as T);
  });
}

export async function listByCon<T extends Base & { conId: string }>(
  table: Table<T, string>,
  conId: string,
): Promise<T[]> {
  return alive(await table.where('conId').equals(conId).toArray());
}

// ---------------------------------------------------------------- Einstellungen

export async function getSettings(): Promise<AppSettings> {
  const rows = alive(await db.settings.toArray());
  const result: AppSettings = { ...DEFAULT_SETTINGS };
  for (const row of rows) {
    if (row.id in result) (result as unknown as Record<string, unknown>)[row.id] = row.value;
  }
  return result;
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  await db.settings.put({ id: key, value, updatedAt: now(), deleted: 0 });
}

// ---------------------------------------------------------------- Cons

export type ConInput = Omit<NewRecord<Con>, 'seriesId'> & { seriesId?: string };

/** Legt eine Con an und kopiert Pack- und Checklisten-Vorlage hinein. */
export async function createCon(input: ConInput): Promise<Con> {
  const settings = await getSettings();
  return db.transaction('rw', [db.cons, db.packItems, db.checklistItems, db.settings], async () => {
    const id = newId();
    const con = await createRecord(db.cons, { ...input, seriesId: input.seriesId ?? id }, id);
    await seedConLists(con.id, settings);
    return con;
  });
}

/** Packliste und die Abschnitte „Vor“/„Nach“ der Checkliste aus den Vorlagen. */
export async function seedConLists(conId: string, settings: AppSettings): Promise<void> {
  const ts = now();
  const packItems: PackItem[] = settings.packTemplate.map((t, i) => ({
    id: newId(),
    updatedAt: ts,
    deleted: 0,
    conId,
    category: t.category,
    label: t.label,
    checked: false,
    order: i,
  }));
  const checklist: ChecklistItem[] = settings.checklistTemplate
    .filter((t) => t.section !== 'tag')
    .map((t, i) => ({
      id: newId(),
      updatedAt: ts,
      deleted: 0,
      conId,
      section: t.section,
      label: t.label,
      auto: t.auto,
      checked: false,
      order: i,
    }));
  await db.packItems.bulkAdd(packItems);
  await db.checklistItems.bulkAdd(checklist);
}

/** Löscht eine Con samt allen zugehörigen Datensätzen (als Tombstones). */
export async function deleteCon(conId: string): Promise<void> {
  const tables = [db.cons, ...CHILD_TABLES.map((t) => db[t])];
  await db.transaction('rw', tables, async () => {
    for (const name of CHILD_TABLES) {
      const table = db[name] as unknown as Table<Base & { conId: string }, string>;
      const rows = alive(await table.where('conId').equals(conId).toArray());
      for (const row of rows) await deleteRecord(table, row.id);
    }
    await deleteRecord(db.cons, conId);
  });
}

// ---------------------------------------------------------------- Tage mit deterministischer ID

export const cashDayId = (conId: string, date: string): string => `${conId}_cash_${date}`;
export const dailyItemId = (conId: string, date: string, index: number): string => `${conId}_tag_${date}_${index}`;

/**
 * Fügt nur Datensätze hinzu, deren ID noch nicht existiert. Auch Tombstones zählen als
 * vorhanden – gelöschte Tage/Punkte werden also nicht wiederbelebt.
 */
export async function addMissing<T extends Base>(table: Table<T, string>, records: T[]): Promise<number> {
  if (records.length === 0) return 0;
  return db.transaction('rw', table, async () => {
    const existing = await table.bulkGet(records.map((r) => r.id));
    const missing = records.filter((_, i) => !existing[i]);
    if (missing.length) await table.bulkAdd(missing);
    return missing.length;
  });
}

/** Legt für jeden Con-Tag einen (leeren) Kassentag an, falls noch keiner existiert. */
export async function ensureCashDays(con: Pick<Con, 'id' | 'startDate' | 'endDate'>): Promise<number> {
  const ts = now();
  const days: CashDay[] = conDays(con.startDate, con.endDate).map((date) => ({
    id: cashDayId(con.id, date),
    updatedAt: ts,
    deleted: 0,
    conId: con.id,
    date,
    movements: [],
    transferred: false,
  }));
  return addMissing(db.cashDays, days);
}

/** Legt die Tagespunkte der Checkliste für jeden Con-Tag aus der Vorlage an. */
export async function ensureDailyChecklist(
  con: Pick<Con, 'id' | 'startDate' | 'endDate'>,
  settings: Pick<AppSettings, 'checklistTemplate'>,
): Promise<number> {
  const ts = now();
  const template = settings.checklistTemplate.filter((t) => t.section === 'tag');
  const items: ChecklistItem[] = conDays(con.startDate, con.endDate).flatMap((date) =>
    template.map((t, i) => ({
      id: dailyItemId(con.id, date, i),
      updatedAt: ts,
      deleted: 0 as const,
      conId: con.id,
      section: 'tag' as const,
      date,
      label: t.label,
      auto: t.auto,
      checked: false,
      order: i,
    })),
  );
  return addMissing(db.checklistItems, items);
}

// ---------------------------------------------------------------- Nächster Jahrgang

/**
 * Legt den nächsten Jahrgang einer Con an (frische Pack-/Checkliste aus den Vorlagen),
 * übernimmt Titelbild und Hotels (als „nicht gebucht“, ohne Preis/Termine).
 */
export async function duplicateConForNextYear(conId: string): Promise<Con> {
  const con = await db.cons.get(conId);
  if (!con || con.deleted) throw new Error('Con nicht gefunden');
  const created = await createCon(nextYearDraft(con));
  await db.transaction('rw', [db.cons, db.images, db.hotels], async () => {
    if (con.coverImageId) {
      const img = await db.images.get(con.coverImageId);
      if (img && !img.deleted) {
        const { id: _i, updatedAt: _u, deleted: _d, ...rest } = img;
        const copy = await createRecord(db.images, { ...rest, conId: created.id, createdAt: Date.now() });
        await updateRecord(db.cons, created.id, { coverImageId: copy.id });
      }
    }
    for (const h of alive(await db.hotels.where('conId').equals(conId).toArray())) {
      if (!h.name && !h.address) continue;
      await createRecord(db.hotels, { conId: created.id, booked: false, name: h.name, address: h.address, notes: h.notes });
    }
  });
  return created;
}
