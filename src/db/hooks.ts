import { useLiveQuery } from 'dexie-react-hooks';
import type { Table } from 'dexie';
import { db } from './db';
import { alive, getSettings, listByCon } from './repo';
import type { AppSettings, Base, Con } from './types';

export function useCons(): Con[] | undefined {
  return useLiveQuery(async () => alive(await db.cons.toArray()), []);
}

/** `null` = nicht gefunden/gelöscht, `undefined` = lädt noch. */
export function useCon(id: string | undefined): Con | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const con = await db.cons.get(id);
    return con && !con.deleted ? con : null;
  }, [id]);
}

export function useConRecords<T extends Base & { conId: string }>(
  table: Table<T, string>,
  conId: string | undefined,
): T[] | undefined {
  return useLiveQuery(async () => (conId ? listByCon(table, conId) : []), [table, conId]);
}

export function useSettings(): AppSettings | undefined {
  return useLiveQuery(() => getSettings(), []);
}
