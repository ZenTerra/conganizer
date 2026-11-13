import { describe, expect, it } from 'vitest';
import type { CashDay, Hotel, Trip } from '../db/types';
import { mealAllowance, travelRange } from './allowance';
import { deadlinesToIcs } from './ics';
import { conProfit } from './profit';
import { safeName } from './share';
import { latin1, tripRows, tripsToCsv, tripsToPdf } from './tripExport';

const rates = { mealRatePartial: 1400, mealRateFull: 2800 };

describe('Verpflegungspauschale', () => {
  it('Fr–So: An- und Abreisetag je 14 €, Samstag 28 €', () => {
    const a = mealAllowance({ startDate: '2027-05-28', endDate: '2027-05-30' }, rates);
    expect(a.days.map((d) => d.type)).toEqual(['anreise', 'voll', 'abreise']);
    expect(a.total).toBe(5600);
    expect(a.lastDay).toBe('2027-05-30');
  });
  it('eintägig: 14 €', () => {
    const a = mealAllowance({ startDate: '2027-05-29', endDate: '2027-05-29' }, rates);
    expect(a.days).toHaveLength(1);
    expect(a.days[0].type).toBe('eintaegig');
    expect(a.total).toBe(1400);
  });
  it('zwei Tage: nur An- und Abreisetag', () => {
    expect(mealAllowance({ startDate: '2027-05-29', endDate: '2027-05-30' }, rates).total).toBe(2800);
  });
  it('nutzt Abfahrt/Rückkehr statt Con-Tagen', () => {
    const con = { startDate: '2027-05-29', endDate: '2027-05-30', departureDate: '2027-05-28', returnDate: '2027-05-31' };
    expect(travelRange(con)).toEqual(['2027-05-28', '2027-05-31']);
    expect(mealAllowance(con, rates).total).toBe(1400 + 2800 + 2800 + 1400);
  });
});

const day = (over: Partial<CashDay>): CashDay => ({
  id: 'd' + Math.random(),
  updatedAt: 0,
  deleted: 0,
  conId: 'c',
  date: '2027-05-29',
  movements: [],
  transferred: false,
  ...over,
});
const trip = (over: Partial<Trip>): Trip => ({
  id: 't' + Math.random(),
  updatedAt: 0,
  deleted: 0,
  conId: 'c',
  date: '2027-05-28',
  startTime: '08:00',
  endTime: '11:00',
  from: 'Zuhause',
  to: 'Motel One',
  purpose: 'Hinfahrt DoKomi',
  odoStart: 45210,
  odoEnd: 45498,
  km: 288,
  kind: 'hin',
  category: 'geschaeftlich',
  transferred: false,
  ...over,
});
const hotel = (over: Partial<Hotel>): Hotel => ({ id: 'h', updatedAt: 0, deleted: 0, conId: 'c', booked: true, ...over });

describe('Gewinn pro Con', () => {
  it('rechnet Umsatz minus geschäftliche Kosten, Privatentnahmen extra', () => {
    const p = conProfit({
      con: { fee: 18050 },
      cashDays: [
        day({
          start: 15000,
          end: 61250,
          card: 23000,
          movements: [
            { id: '1', type: 'privat', amount: 1800, note: 'Essen' },
            { id: '2', type: 'geschaeft', amount: 600, note: 'Parken' },
          ],
        }),
        day({ date: '2027-05-30', start: 61250 }), // unvollständig
      ],
      hotels: [hotel({ price: 28990 }), hotel({ id: 'h2', booked: false, price: 99900 })],
      trips: [trip({}), trip({ km: 288, kind: 'rueck' }), trip({ km: 20, category: 'privat' })],
      expenses: [{ id: 'e', updatedAt: 0, deleted: 0, conId: 'c', label: 'Badge', amount: 500 }],
      kmRate: 30,
    });
    expect(p.revenueCash).toBe(61250 + 2400 - 15000); // 486,50
    expect(p.revenueCard).toBe(23000);
    expect(p.hotels).toBe(28990); // nicht gebuchtes Hotel zählt nicht
    expect(p.km).toBe(576);
    expect(p.kmCost).toBe(17280);
    expect(p.cashBusiness).toBe(600);
    expect(p.privat).toBe(1800);
    expect(p.costs).toBe(18050 + 28990 + 17280 + 600 + 500);
    expect(p.profit).toBe(p.revenue - p.costs);
    expect(p.incompleteDays).toBe(1);
  });
});

describe('Kalender-Export', () => {
  it('erzeugt ganztägige Termine mit Erinnerung und stabiler UID', () => {
    const ics = deadlinesToIcs(
      [{ conId: 'c1', conName: 'DoKomi, 2027', date: '2027-01-31', kind: 'feeDue', label: 'Standgebühr fällig' }],
      new Date('2026-11-13T10:00:00Z'),
    );
    expect(ics).toContain('BEGIN:VCALENDAR');
    expect(ics).toContain('DTSTART;VALUE=DATE:20270131');
    expect(ics).toContain('DTEND;VALUE=DATE:20270201');
    expect(ics).toContain('UID:c1-feeDue-20270131@conganizer');
    expect(ics).toContain('DoKomi\\, 2027');
    expect(ics).toContain('TRIGGER:-PT15H');
    expect(ics.split('\r\n').every((l) => l.length <= 75)).toBe(true);
  });
});

describe('Fahrtenbuch-Export', () => {
  it('liefert Zeilen in Spaltenreihenfolge des Papierbuchs', () => {
    const [row] = tripRows([trip({})]);
    expect(row).toEqual([
      '28.05.2027',
      '08:00',
      '11:00',
      'Zuhause → Motel One',
      'Hinfahrt DoKomi',
      '45.210',
      '288',
      '',
      '',
      '45.498',
      '',
      '',
    ]);
  });
  it('lässt offene Fahrten weg und schreibt privat in die richtige Spalte', () => {
    const rows = tripRows([trip({ category: 'privat', km: 12 }), trip({ endTime: undefined, odoEnd: undefined })]);
    expect(rows).toHaveLength(1);
    expect(rows[0][6]).toBe('');
    expect(rows[0][8]).toBe('12');
  });
  it('CSV mit Semikolon, BOM und Quoting', () => {
    const csv = tripsToCsv([trip({ purpose: 'Hinfahrt; mit "Gepäck"', costAmount: 6543, costPurpose: 'Benzin' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"Hinfahrt; mit ""Gepäck"""');
    expect(csv).toContain(';65,43;Benzin');
  });
  it('erzeugt ein PDF', async () => {
    const blob = await tripsToPdf([trip({}), trip({ purpose: 'Rückfahrt – Köln → Zuhause' })], 'DoKomi 2027', 30);
    expect(blob.size).toBeGreaterThan(1000);
    const head = new TextDecoder().decode(await blob.slice(0, 5).arrayBuffer());
    expect(head).toBe('%PDF-');
  });
  it('macht Text PDF-tauglich', () => {
    expect(latin1('Zuhause → Hotel – 5 € „gut“ äöü 😀')).toBe('Zuhause - Hotel - 5 EUR "gut" äöü ?');
  });
});

describe('Dateinamen', () => {
  it('entfernt Umlaute und Sonderzeichen', () => {
    expect(safeName('Fahrtenbuch Köln/Düsseldorf 2027!')).toBe('Fahrtenbuch_Koln_Dusseldorf_2027');
  });
});
