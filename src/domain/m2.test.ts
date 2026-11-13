import { describe, expect, it } from 'vitest';
import type { CashMovement, Trip } from '../db/types';
import { moveInGroup } from '../features/settings/TemplateEditor';
import { businessCashCosts, carryOverStart, cashReport, countTotal, nextReportNo } from './cash';
import { isAutoDone, isItemDone } from './checklistAuto';
import { isOpen, kmFromOdo, kmTotals, lastOdometer, openTrip, routeLabel, sortTrips } from './trips';

const mv = (type: CashMovement['type'], amount: number): CashMovement => ({ id: type + amount, type, amount, note: '' });

describe('Kassenbericht', () => {
  it('rechnet wie das Formular (Avery 305)', () => {
    // Vortag 150 €, Endbestand 612,50 €; Essen 18 €, Parken 6 €, Klebeband 4,50 €, Einlage 50 €
    const r = cashReport({
      start: 15000,
      end: 61250,
      movements: [mv('privat', 1800), mv('geschaeft', 600), mv('wareneinkauf', 450), mv('sonstig', 0), mv('einlage', 5000)],
    });
    expect(r.ausgaben).toBe(2850);
    expect(r.summe).toBe(64100); // 612,50 + 28,50
    expect(r.kasseneingang).toBe(49100); // − 150
    expect(r.tageslosung).toBe(44100); // − 50 Einlage
    expect(r.complete).toBe(true);
    expect(businessCashCosts(r)).toBe(1050); // ohne Privatentnahme
  });

  it('ist unvollständig ohne Start- oder Endbestand', () => {
    expect(cashReport({ start: 100, movements: [] }).complete).toBe(false);
  });

  it('überträgt den Endbestand auf den Folgetag, solange dieser nicht von Hand geändert wurde', () => {
    expect(carryOverStart(undefined, undefined, 50000)).toBe(50000);
    expect(carryOverStart(50000, 50000, 52000)).toBe(52000); // folgte bisher dem Übertrag
    expect(carryOverStart(20000, 50000, 52000)).toBe(20000); // von Hand gesetzt → bleibt
    expect(carryOverStart(50000, 50000, undefined)).toBeUndefined();
  });

  it('vergibt fortlaufende Nummern', () => {
    expect(nextReportNo([])).toBe(1);
    expect(nextReportNo([{ reportNo: 12 }, { reportNo: undefined }, { reportNo: 7 }])).toBe(13);
  });

  it('summiert die Zählhilfe', () => {
    expect(countTotal({ '2000': 5, '1000': 8, '200': 12, '50': 3 })).toBe(10000 + 8000 + 2400 + 150);
    expect(countTotal(undefined)).toBe(0);
  });
});

const trip = (over: Partial<Trip>): Trip => ({
  id: Math.random().toString(36),
  updatedAt: 0,
  deleted: 0,
  conId: 'c1',
  date: '2027-05-28',
  from: 'Zuhause',
  to: 'Hotel',
  purpose: '',
  km: 0,
  kind: 'sonstig',
  category: 'geschaeftlich',
  transferred: false,
  ...over,
});

describe('Fahrten', () => {
  it('rechnet km aus dem km-Stand', () => {
    expect(kmFromOdo(45210, 45498)).toBe(288);
    expect(kmFromOdo(45210, undefined)).toBeUndefined();
    expect(kmFromOdo(45498, 45210)).toBeUndefined();
  });

  it('führt die km-Kette über Cons hinweg fort', () => {
    const trips = [
      trip({ conId: 'a', date: '2027-03-01', startTime: '08:00', odoStart: 1000, odoEnd: 1200 }),
      trip({ conId: 'b', date: '2027-05-28', startTime: '09:00', odoStart: 1500, odoEnd: 1800 }),
      trip({ conId: '', date: '2027-04-10', startTime: '10:00', odoStart: 1300, odoEnd: 1350 }),
    ];
    expect(lastOdometer(trips)).toBe(1800);
    expect(lastOdometer(trips, trips[1].id)).toBe(1350);
  });

  it('erkennt offene Fahrten', () => {
    const open = trip({ startTime: '08:00', odoStart: 100 });
    const closed = trip({ startTime: '08:00', endTime: '10:00', odoStart: 100, odoEnd: 300 });
    expect(isOpen(open)).toBe(true);
    expect(isOpen(closed)).toBe(false);
    expect(openTrip([closed, open])?.id).toBe(open.id);
  });

  it('summiert km je Spalte', () => {
    const totals = kmTotals([
      trip({ km: 288 }),
      trip({ km: 12, category: 'privat' }),
      trip({ km: 288 }),
    ]);
    expect(totals).toEqual({ geschaeftlich: 576, wohnung: 0, privat: 12 });
  });

  it('sortiert chronologisch und beschriftet Routen', () => {
    const a = trip({ date: '2027-05-30', startTime: '17:00' });
    const b = trip({ date: '2027-05-28', startTime: '09:00' });
    expect(sortTrips([a, b]).map((t) => t.id)).toEqual([b.id, a.id]);
    expect(routeLabel({ from: 'Zuhause', to: 'Motel One' })).toBe('Zuhause → Motel One');
    expect(routeLabel({ from: '', to: '' })).toBe('–');
  });
});

describe('Checkliste automatisch', () => {
  const ctx = { con: { feePaid: false }, hotels: [{ booked: true }], packItems: [{ checked: true }, { checked: false }] };
  it('wertet die Regeln aus', () => {
    expect(isAutoDone('feePaid', ctx)).toBe(false);
    expect(isAutoDone('hotelBooked', ctx)).toBe(true);
    expect(isAutoDone('packDone', ctx)).toBe(false);
    expect(isAutoDone('packDone', { ...ctx, packItems: [] })).toBe(false);
    expect(isAutoDone(undefined, ctx)).toBe(false);
  });
  it('manuelles Häkchen oder Automatik zählt', () => {
    expect(isItemDone({ checked: true, auto: 'feePaid' }, ctx)).toBe(true);
    expect(isItemDone({ checked: false, auto: 'hotelBooked' }, ctx)).toBe(true);
  });
});

describe('Vorlagen sortieren', () => {
  it('verschiebt nur innerhalb der Gruppe', () => {
    const list = [
      { g: 'a', v: 1 },
      { g: 'b', v: 2 },
      { g: 'a', v: 3 },
    ];
    expect(moveInGroup(list, 2, -1, (x) => x.g).map((x) => x.v)).toEqual([3, 2, 1]);
    expect(moveInGroup(list, 0, -1, (x) => x.g)).toBe(list);
    expect(moveInGroup(list, 1, 1, (x) => x.g)).toBe(list);
  });
});
