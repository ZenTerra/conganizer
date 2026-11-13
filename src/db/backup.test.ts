import { beforeEach, describe, expect, it } from 'vitest';
import { mergeRecords } from '../domain/merge';
import { backupReminder } from '../domain/reminder';
import { exportBackupJson, importBackup, parseBackup, restoreSnapshot } from './backup';
import { db } from './db';
import { alive, createCon, createRecord, deleteRecord, getSettings, setSetting, updateRecord } from './repo';
import type { Base } from './types';

const rec = (id: string, updatedAt: number, deleted: 0 | 1 = 0, extra: object = {}) => ({ id, updatedAt, deleted, ...extra }) as Base;

describe('mergeRecords', () => {
  it('neuere Version gewinnt, ältere wird ignoriert', () => {
    const local = [rec('a', 10, 0, { v: 'lokal' }), rec('b', 50, 0, { v: 'lokal' })];
    const incoming = [rec('a', 20, 0, { v: 'fremd' }), rec('b', 40, 0, { v: 'fremd' }), rec('c', 5, 0, { v: 'neu' })];
    const { toPut, stats } = mergeRecords(local, incoming);
    expect(toPut.map((r) => r.id).sort()).toEqual(['a', 'c']);
    expect(stats).toEqual({ added: 1, updated: 1, deleted: 0, unchanged: 1 });
  });
  it('überträgt Löschungen, wenn sie neuer sind', () => {
    const { toPut, stats } = mergeRecords([rec('a', 10)], [rec('a', 11, 1)]);
    expect(toPut[0].deleted).toBe(1);
    expect(stats.deleted).toBe(1);
  });
  it('eine neuere lokale Änderung schlägt eine ältere Löschung', () => {
    expect(mergeRecords([rec('a', 30)], [rec('a', 20, 1)]).toPut).toHaveLength(0);
  });
  it('bei Gleichstand bleibt der lokale Stand', () => {
    expect(mergeRecords([rec('a', 10, 0, { v: 1 })], [rec('a', 10, 0, { v: 2 })]).toPut).toHaveLength(0);
  });
});

describe('Backup Export/Import', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  const baseCon = { name: 'DoKomi 2027', startDate: '2027-05-29', endDate: '2027-05-30', status: 'beworben' as const, feePaid: false };

  it('Export → leere DB → Import stellt alles inkl. Bilder wieder her', async () => {
    const con = await createCon(baseCon);
    await createRecord(db.images, {
      conId: con.id,
      kind: 'ref',
      blob: new Blob([new Uint8Array([1, 2, 3, 250])], { type: 'image/jpeg' }),
      thumb: new Blob([new Uint8Array([9])], { type: 'image/jpeg' }),
      width: 2,
      height: 2,
    });
    await setSetting('homeAddress', 'Musterweg 1');
    await setSetting('lastBackupAt', 12345);
    const json = await exportBackupJson();
    expect(parseBackup(json).tables.settings?.some((s) => s.id === 'lastBackupAt')).toBe(false);

    await Promise.all(db.tables.map((t) => t.clear()));
    const result = await importBackup(json);
    expect(result.stats.added).toBeGreaterThan(30); // Con + Pack- und Checklistenpunkte + Bild + Einstellung
    expect((await db.cons.get(con.id))?.name).toBe('DoKomi 2027');
    const img = (await db.images.toArray())[0];
    expect(img.blob).toBeInstanceOf(Blob);
    expect(Array.from(new Uint8Array(await img.blob.arrayBuffer()))).toEqual([1, 2, 3, 250]);
    expect((await getSettings()).homeAddress).toBe('Musterweg 1');
    expect((await getSettings()).lastBackupAt).toBeNull(); // gerätespezifisch, nicht übertragen
  });

  it('führt Änderungen von zwei Geräten zusammen', async () => {
    const con = await createCon(baseCon);
    const hotel = await createRecord(db.hotels, { conId: con.id, booked: false, name: 'Motel' });
    const fromOtherDevice = await exportBackupJson();

    // Gerät B (simuliert): Hotel gebucht – neuer
    const other = parseBackup(fromOtherDevice);
    other.tables.hotels = other.tables.hotels!.map((h) => ({ ...h, booked: true, updatedAt: Date.now() + 1000 }));

    // Gerät A: Con umbenannt, eine Fahrt neu
    await new Promise((r) => setTimeout(r, 5));
    await updateRecord(db.cons, con.id, { name: 'DoKomi 2027 (umbenannt)' });
    await createRecord(db.trips, {
      conId: con.id, date: '2027-05-28', from: 'A', to: 'B', purpose: '', km: 10, kind: 'hin', category: 'geschaeftlich', transferred: false,
    });

    const result = await importBackup(JSON.stringify(other));
    expect(result.stats.updated).toBe(1); // nur das Hotel
    expect((await db.hotels.get(hotel.id))?.booked).toBe(true);
    expect((await db.cons.get(con.id))?.name).toBe('DoKomi 2027 (umbenannt)'); // lokale, neuere Änderung bleibt
    expect(alive(await db.trips.toArray())).toHaveLength(1); // lokale Fahrt bleibt
  });

  it('legt vor dem Import einen Snapshot an, der sich wiederherstellen lässt', async () => {
    const con = await createCon(baseCon);
    const snapshotSource = await exportBackupJson();
    const other = parseBackup(snapshotSource);
    other.tables.cons = other.tables.cons!.map((c) => ({ ...c, deleted: 1, updatedAt: Date.now() + 1000 }));
    await importBackup(JSON.stringify(other));
    expect((await db.cons.get(con.id))?.deleted).toBe(1);

    const [snap] = await db.snapshots.toArray();
    await restoreSnapshot(snap.id);
    expect((await db.cons.get(con.id))?.deleted).toBe(0);
  });

  it('lehnt fremde Dateien ab', () => {
    expect(() => parseBackup('kein json')).toThrow();
    expect(() => parseBackup('{"app":"etwas"}')).toThrow(/keine ConGanizer/);
    expect(() => parseBackup('{"app":"conganizer","version":99,"tables":{}}')).toThrow(/neueren/);
  });

  it('Tombstones gelöschter Datensätze werden mit exportiert', async () => {
    const con = await createCon(baseCon);
    const h = await createRecord(db.hotels, { conId: con.id, booked: true });
    await deleteRecord(db.hotels, h.id);
    const f = parseBackup(await exportBackupJson());
    expect(f.tables.hotels?.find((x) => x.id === h.id)?.deleted).toBe(1);
  });
});

describe('Backup-Erinnerung', () => {
  const DAY = 86_400_000;
  const cons = [{ id: 'c', name: 'DoKomi' }];
  it('ohne Daten keine Erinnerung, ohne Backup „nie“', () => {
    expect(backupReminder(null, 0, [], [])).toBeNull();
    expect(backupReminder(null, 0, cons, [])).toEqual({ reason: 'never' });
  });
  it('nach 7 Tagen', () => {
    expect(backupReminder(0, 6 * DAY, cons, [])).toBeNull();
    expect(backupReminder(0, 9 * DAY, cons, [])).toEqual({ reason: 'stale', days: 9 });
  });
  it('nach abgeschlossener Con', () => {
    const items = [
      { conId: 'c', section: 'nach' as const, checked: true, updatedAt: 5 * DAY, deleted: 0 as const },
      { conId: 'c', section: 'nach' as const, checked: true, updatedAt: 4 * DAY, deleted: 0 as const },
    ];
    expect(backupReminder(3 * DAY, 5 * DAY, cons, items)).toEqual({ reason: 'conDone', conName: 'DoKomi' });
    expect(backupReminder(6 * DAY, 6 * DAY, cons, items)).toBeNull();
    expect(backupReminder(3 * DAY, 5 * DAY, cons, [{ ...items[0], checked: false }, items[1]])).toBeNull();
  });
});
