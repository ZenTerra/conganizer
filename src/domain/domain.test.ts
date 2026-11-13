import { describe, expect, it } from 'vitest';
import type { Con, Hotel } from '../db/types';
import { conDays, daysUntil, formatRange, relativeDays } from './dates';
import { conDeadlines, nextDeadline } from './deadlines';
import { centsToInput, formatEuro, parseEuro } from './money';
import { statusSideEffects } from './status';
import { initials, linkify } from './text';

const con = (over: Partial<Con> = {}): Con => ({
  id: 'c1',
  updatedAt: 0,
  deleted: 0,
  name: 'DoKomi',
  startDate: '2027-05-29',
  endDate: '2027-05-30',
  status: 'interessant',
  feePaid: false,
  seriesId: 'c1',
  ...over,
});

const hotel = (over: Partial<Hotel> = {}): Hotel => ({
  id: 'h1',
  updatedAt: 0,
  deleted: 0,
  conId: 'c1',
  booked: true,
  ...over,
});

describe('dates', () => {
  it('erzeugt alle Con-Tage inklusive', () => {
    expect(conDays('2027-03-14', '2027-03-16')).toEqual(['2027-03-14', '2027-03-15', '2027-03-16']);
  });
  it('fällt bei Ende vor Start auf einen Tag zurück', () => {
    expect(conDays('2027-03-14', '2027-03-10')).toEqual(['2027-03-14']);
  });
  it('überspringt Monatsgrenzen und Zeitumstellung korrekt', () => {
    expect(conDays('2027-03-27', '2027-03-29')).toHaveLength(3);
    expect(conDays('2027-04-30', '2027-05-02')).toEqual(['2027-04-30', '2027-05-01', '2027-05-02']);
  });
  it('formatiert Zeiträume kompakt', () => {
    expect(formatRange('2027-03-14', '2027-03-16')).toBe('14.–16.03.2027');
    expect(formatRange('2027-04-30', '2027-05-02')).toBe('30.04.–02.05.2027');
    expect(formatRange('2027-12-30', '2028-01-01')).toBe('30.12.2027–01.01.2028');
    expect(formatRange('2027-03-14', '2027-03-14')).toBe('14.03.2027');
  });
  it('rechnet relative Tage', () => {
    expect(daysUntil('2027-01-10', '2027-01-01')).toBe(9);
    expect(relativeDays('2027-01-02', '2027-01-01')).toBe('morgen');
    expect(relativeDays('2026-12-30', '2027-01-01')).toBe('vor 2 Tagen');
  });
});

describe('money', () => {
  it('liest deutsche und englische Schreibweisen', () => {
    expect(parseEuro('12,50')).toBe(1250);
    expect(parseEuro('12.50')).toBe(1250);
    expect(parseEuro('1.234,56')).toBe(123456);
    expect(parseEuro('1.234.567')).toBe(123456700);
    expect(parseEuro('80 €')).toBe(8000);
    expect(parseEuro('0,3')).toBe(30);
  });
  it('lehnt Unsinn ab', () => {
    expect(parseEuro('')).toBeUndefined();
    expect(parseEuro('abc')).toBeUndefined();
    expect(parseEuro('1,2,3')).toBeUndefined();
  });
  it('formatiert', () => {
    expect(formatEuro(123456).replace(/\s/g, ' ')).toBe('1.234,56 €');
    expect(centsToInput(30)).toBe('0,30');
    expect(centsToInput(undefined)).toBe('');
  });
});

describe('deadlines', () => {
  it('zeigt Bewerbungsfenster nur im Status „Interessant“', () => {
    const c = con({ applicationOpens: '2027-01-10', applicationCloses: '2027-02-01' });
    expect(conDeadlines(c, []).map((d) => d.kind)).toEqual(['appOpens', 'appCloses']);
    expect(conDeadlines({ ...c, status: 'beworben' }, [])).toEqual([]);
  });
  it('zeigt Standgebühr nur unbezahlt und bei aktiven Cons', () => {
    const c = con({ status: 'angenommen', feeDue: '2027-03-01' });
    expect(conDeadlines(c, [])).toHaveLength(1);
    expect(conDeadlines({ ...c, feePaid: true }, [])).toHaveLength(0);
    expect(conDeadlines({ ...c, status: 'abgesagt' }, [])).toHaveLength(0);
  });
  it('zeigt Hotel-Storno nur für gebuchte Hotels – auch bei abgesagten Cons', () => {
    const c = con({ status: 'abgesagt' });
    const hotels = [hotel({ cancelDeadline: '2027-05-01', name: 'Motel' }), hotel({ id: 'h2', booked: false, cancelDeadline: '2027-04-01' })];
    const ds = conDeadlines(c, hotels);
    expect(ds).toHaveLength(1);
    expect(ds[0].label).toBe('Storno-Frist Motel');
  });
  it('liefert die nächste zukünftige Frist', () => {
    const c = con({ status: 'angenommen', feeDue: '2027-01-05' });
    const hotels = [hotel({ cancelDeadline: '2027-02-01' })];
    expect(nextDeadline(c, hotels, '2027-01-01')?.kind).toBe('feeDue');
    expect(nextDeadline(c, hotels, '2027-01-10')?.kind).toBe('hotelCancel');
    expect(nextDeadline(c, hotels, '2027-03-01')).toBeUndefined();
  });
});

describe('status', () => {
  it('setzt „Beworben am“ und „Zusage am“, wenn leer', () => {
    expect(statusSideEffects({}, 'beworben', '2027-01-01')).toEqual({ status: 'beworben', appliedAt: '2027-01-01' });
    expect(statusSideEffects({ appliedAt: '2026-12-01' }, 'angenommen', '2027-01-01')).toEqual({
      status: 'angenommen',
      acceptedAt: '2027-01-01',
    });
    expect(statusSideEffects({}, 'interessant', '2027-01-01')).toEqual({ status: 'interessant' });
  });
});

describe('text', () => {
  it('bildet Initialen', () => {
    expect(initials('DoKomi')).toBe('DO');
    expect(initials('Connichi Kassel')).toBe('CK');
    expect(initials('DoKomi 2027')).toBe('DO');
    expect(initials('2027')).toBe('20');
    expect(initials('  ')).toBe('?');
  });
  it('erkennt Links', () => {
    expect(linkify('https://dokomi.de')).toEqual({ text: 'dokomi.de', href: 'https://dokomi.de' });
    expect(linkify('info@con.de').href).toBe('mailto:info@con.de');
    expect(linkify('Discord: xyz').href).toBeUndefined();
  });
});
