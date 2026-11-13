import { beforeEach, describe, expect, it } from 'vitest';
import { parseIso } from '../domain/dates';
import { NEXT_YEAR_DAYS, nextYearName, shiftIso } from '../domain/duplicate';
import { db } from './db';
import { createCon, createRecord, duplicateConForNextYear, listByCon, updateRecord } from './repo';

describe('nächster Jahrgang – Hilfsfunktionen', () => {
  it('zählt die Jahreszahl im Namen hoch', () => {
    expect(nextYearName('DoKomi 2027')).toBe('DoKomi 2028');
    expect(nextYearName('Connichi')).toBe('Connichi');
    expect(nextYearName('Con 2026/2027')).toBe('Con 2026/2028');
    expect(nextYearName('Halle 12')).toBe('Halle 12');
  });
  it('verschiebt um 52 Wochen und behält den Wochentag', () => {
    const next = shiftIso('2027-05-29', NEXT_YEAR_DAYS)!;
    expect(next).toBe('2028-05-27');
    expect(parseIso(next).getDay()).toBe(parseIso('2027-05-29').getDay());
    expect(shiftIso(undefined, 364)).toBeUndefined();
  });
});

describe('duplicateConForNextYear', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((t) => t.clear()));
  });

  it('übernimmt Stammdaten, setzt Status zurück und verknüpft die Jahrgänge', async () => {
    const con = await createCon({
      name: 'DoKomi 2027',
      startDate: '2027-05-29',
      endDate: '2027-05-30',
      status: 'angenommen',
      appliedAt: '2026-11-01',
      fee: 18000,
      feePaid: true,
      venueName: 'Messe Düsseldorf',
      booth: 'A12',
      rating: 5,
      lessons: 'Mehr Sticker mitnehmen',
    });
    await createRecord(db.hotels, { conId: con.id, booked: true, name: 'Motel One', address: 'Immermannstr. 54', price: 28990 });
    await updateRecord(db.packItems, (await listByCon(db.packItems, con.id))[0].id, { checked: true });

    const next = await duplicateConForNextYear(con.id);
    expect(next.name).toBe('DoKomi 2028');
    expect(next.seriesId).toBe(con.seriesId);
    expect(next.status).toBe('interessant');
    expect(next.appliedAt).toBeUndefined();
    expect(next.feePaid).toBe(false);
    expect(next.fee).toBe(18000);
    expect(next.venueName).toBe('Messe Düsseldorf');
    expect(next.booth).toBeUndefined();
    expect(next.rating).toBeUndefined();
    expect(next.lessons).toBeUndefined();

    const hotels = await listByCon(db.hotels, next.id);
    expect(hotels).toHaveLength(1);
    expect(hotels[0]).toMatchObject({ booked: false, name: 'Motel One', address: 'Immermannstr. 54' });
    expect(hotels[0].price).toBeUndefined();

    const pack = await listByCon(db.packItems, next.id);
    expect(pack.length).toBeGreaterThan(0);
    expect(pack.every((p) => !p.checked)).toBe(true);
  });
});
