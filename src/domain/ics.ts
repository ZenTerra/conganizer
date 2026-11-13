import type { Deadline } from './deadlines';

const pad = (s: string) => s.replace(/-/g, '');

/** Text nach RFC 5545 escapen */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

/** Zeilen > 75 Oktette falten (vereinfachend nach Zeichen) */
const fold = (line: string) => {
  const out: string[] = [];
  let rest = line;
  while (rest.length > 74) {
    out.push(rest.slice(0, 74));
    rest = ' ' + rest.slice(74);
  }
  out.push(rest);
  return out.join('\r\n');
};

function nextDay(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + 1));
  return dt.toISOString().slice(0, 10);
}

/**
 * Ganztägige Kalendereinträge für Fristen, jeweils mit Erinnerung am Vortag um 9 Uhr.
 * Die UID ist pro Con + Fristart stabil, damit ein erneuter Import den Termin aktualisiert.
 */
export function deadlinesToIcs(deadlines: Deadline[], now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//ConGanizer//Fristen//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  for (const d of deadlines) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${d.conId}-${d.kind}-${pad(d.date)}@conganizer`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${pad(d.date)}`,
      `DTEND;VALUE=DATE:${pad(nextDay(d.date))}`,
      `SUMMARY:${esc(`${d.label} – ${d.conName}`)}`,
      'TRANSP:TRANSPARENT',
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(`${d.label} – ${d.conName}`)}`,
      'TRIGGER:-PT15H',
      'END:VALARM',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
