/**
 * Export des Fahrtenbuchs in der Spaltenreihenfolge des Papier-Fahrtenbuchs
 * (ohne „Name Fahrer/in“).
 */
import type { Trip } from '../db/types';
import { formatDate } from './dates';
import { isOpen, kmTotals, sortTrips } from './trips';

export const TRIP_COLUMNS = [
  'Datum',
  'Fahrzeit von',
  'Fahrzeit bis',
  'Reiseroute und Ziel',
  'Zweck der Fahrt',
  'km-Stand Beginn',
  'km geschäftl.',
  'km Wohn./Arbeit',
  'km privat',
  'km-Stand Ende',
  'Kosten EUR',
  'Verwendungszweck',
] as const;

const num = (n: number | undefined) => (n === undefined ? '' : n.toLocaleString('de-DE', { maximumFractionDigits: 1 }));
const eur = (c: number | undefined) => (c ? (c / 100).toFixed(2).replace('.', ',') : '');

/** Eine Zeile pro abgeschlossener Fahrt; `arrow` ersetzt „→“ (PDF-Standardschrift kennt es nicht). */
export function tripRows(trips: Trip[], arrow = '→'): string[][] {
  return sortTrips(trips.filter((t) => !isOpen(t))).map((t) => [
    formatDate(t.date),
    t.startTime ?? '',
    t.endTime ?? '',
    [t.from, t.to].filter((s) => s.trim()).join(` ${arrow} `),
    t.purpose,
    num(t.odoStart),
    t.category === 'geschaeftlich' ? num(t.km) : '',
    t.category === 'wohnung' ? num(t.km) : '',
    t.category === 'privat' ? num(t.km) : '',
    num(t.odoEnd),
    eur(t.costAmount),
    t.costPurpose ?? '',
  ]);
}

const BOM = String.fromCharCode(0xfeff);
const csvCell = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** CSV mit Semikolon und BOM – öffnet sich in Excel/Numbers direkt richtig. */
export function tripsToCsv(trips: Trip[]): string {
  const lines = [TRIP_COLUMNS as readonly string[], ...tripRows(trips)].map((r) => r.map(csvCell).join(';'));
  return BOM + lines.join('\r\n') + '\r\n';
}

/** Die PDF-Standardschrift kann nur Latin-1 – alles andere ersetzen. */
const PDF_MAP: Record<string, string> = {
  '–': '-',
  '—': '-',
  '→': '-',
  '€': 'EUR',
  '„': '"',
  '“': '"',
  '”': '"',
  '‘': "'",
  '’': "'",
};
export const latin1 = (s: string): string =>
  Array.from(s)
    .map((ch) => PDF_MAP[ch] ?? (ch.charCodeAt(0) <= 0xff ? ch : '?'))
    .join('');

/** PDF (A4 quer) – jsPDF wird erst bei Bedarf geladen. */
export async function tripsToPdf(trips: Trip[], title: string, kmRate: number): Promise<Blob> {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.setFontSize(14);
  doc.text(latin1(`Fahrtenbuch - ${title}`), 14, 15);
  const totals = kmTotals(trips.filter((t) => !isOpen(t)));
  doc.setFontSize(9);
  doc.text(
    `Gefahrene km: geschäftlich ${num(totals.geschaeftlich)} · Wohnung-Arbeit ${num(totals.wohnung)} · privat ${num(totals.privat)}` +
      ` · Kilometerpauschale geschäftlich: ${eur(Math.round(totals.geschaeftlich * kmRate))} EUR`,
    14,
    21,
  );
  autoTable(doc, {
    startY: 25,
    head: [TRIP_COLUMNS as unknown as string[]],
    body: tripRows(trips, '-').map((r) => r.map(latin1)),
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: [36, 67, 75] },
    columnStyles: {
      5: { halign: 'right' },
      6: { halign: 'right' },
      7: { halign: 'right' },
      8: { halign: 'right' },
      9: { halign: 'right' },
      10: { halign: 'right' },
    },
  });
  return doc.output('blob');
}
