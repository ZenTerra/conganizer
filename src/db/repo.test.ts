import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import {
  alive,
  cashDayId,
  createCon,
  createRecord,
  dailyItemId,
  deleteCon,
  deleteRecord,
  ensureCashDays,
  ensureDailyChecklist,
  getSettings,
  listByCon,
  setSetting,
  updateRecord,
} from './repo';
import { DEFAULT_CHECKLIST_TEMPLATE, DEFAULT_PACK_TEMPLATE } from './templates';

const baseCon = {
  name: 'Test-Con',
  startDate: '2027-03-14',
  endDate: '2027-03-16',
  status: 'interessant' as const,
  feePaid: false,
};

beforeEach(async () => {
  await Promise.all(db.tables.map((t) => t.clear()));
});

describe('repo', () => {
  it('legt eine Con mit Packliste und Checkliste (ohne Tagespunkte) an', async () => {
    const con = await createCon(baseCon);
    expect(con.seriesId).toBe(con.id);
    expect(con.deleted).toBe(0);

    const pack = await listByCon(db.packItems, con.id);
    expect(pack).toHaveLength(DEFAULT_PACK_TEMPLATE.length);

    const checklist = await listByCon(db.checklistItems, con.id);
    expect(checklist).toHaveLength(DEFAULT_CHECKLIST_TEMPLATE.filter((t) => t.section !== 'tag').length);
    expect(checklist.some((c) => c.section === 'tag')).toBe(false);
  });

  it('aktualisiert updatedAt bei Änderungen', async () => {
    const con = await createCon(baseCon);
    await new Promise((r) => setTimeout(r, 5));
    await updateRecord(db.cons, con.id, { name: 'Neu' });
    const after = await db.cons.get(con.id);
    expect(after?.name).toBe('Neu');
    expect(after!.updatedAt).toBeGreaterThan(con.updatedAt);
  });

  it('löscht eine Con samt Kindern als Tombstones', async () => {
    const con = await createCon(baseCon);
    await createRecord(db.hotels, { conId: con.id, booked: true, name: 'Hotel' });
    await deleteCon(con.id);

    expect((await db.cons.get(con.id))?.deleted).toBe(1);
    expect(await listByCon(db.hotels, con.id)).toHaveLength(0);
    expect(await listByCon(db.packItems, con.id)).toHaveLength(0);
    // Tombstones bleiben für den Abgleich erhalten
    expect((await db.hotels.toArray()).every((h) => h.deleted === 1)).toBe(true);
    expect(alive(await db.cons.toArray())).toHaveLength(0);
  });

  it('ignoriert Updates auf gelöschte Datensätze', async () => {
    const con = await createCon(baseCon);
    await deleteCon(con.id);
    await updateRecord(db.cons, con.id, { name: 'Zombie' });
    expect((await db.cons.get(con.id))?.name).toBe('Test-Con');
  });

  it('legt Kassentage und Tagespunkte idempotent an und belebt Gelöschtes nicht wieder', async () => {
    const con = await createCon(baseCon); // 3 Tage
    const settings = await getSettings();
    const dailyPerDay = settings.checklistTemplate.filter((t) => t.section === 'tag').length;

    expect(await ensureCashDays(con)).toBe(3);
    expect(await ensureCashDays(con)).toBe(0);
    expect(await listByCon(db.cashDays, con.id)).toHaveLength(3);

    expect(await ensureDailyChecklist(con, settings)).toBe(3 * dailyPerDay);
    expect(await ensureDailyChecklist(con, settings)).toBe(0);

    const firstDaily = dailyItemId(con.id, '2027-03-14', 0);
    await deleteRecord(db.checklistItems, firstDaily);
    await ensureDailyChecklist(con, settings);
    expect((await db.checklistItems.get(firstDaily))?.deleted).toBe(1);

    await deleteRecord(db.cashDays, cashDayId(con.id, '2027-03-15'));
    await ensureCashDays(con);
    expect(await listByCon(db.cashDays, con.id)).toHaveLength(2);
  });

  it('liefert Standard-Einstellungen und überschreibt gespeicherte Werte', async () => {
    expect((await getSettings()).kmRate).toBe(30);
    await setSetting('kmRate', 35);
    await setSetting('homeAddress', 'Musterweg 1');
    const s = await getSettings();
    expect(s.kmRate).toBe(35);
    expect(s.homeAddress).toBe('Musterweg 1');
    expect(s.mealRateFull).toBe(2800);
  });
});
