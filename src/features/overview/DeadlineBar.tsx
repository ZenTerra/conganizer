import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarPlus } from 'lucide-react';
import type { Con, Hotel, IsoDate } from '../../db/types';
import { daysUntil, formatWeekdayDate, relativeDays } from '../../domain/dates';
import { conDeadlines, upcoming, type Deadline } from '../../domain/deadlines';
import { deadlinesToIcs } from '../../domain/ics';
import { safeName, shareFile, textFile } from '../../domain/share';

/** Exportiert Fristen als .ics – Safari öffnet beim Download den „Zum Kalender hinzufügen“-Dialog. */
export async function exportDeadlines(deadlines: Deadline[], name: string): Promise<void> {
  const file = textFile(deadlinesToIcs(deadlines), `${safeName(name)}.ics`, 'text/calendar');
  await shareFile(file, { title: name, preferDownload: true });
}

const COLLAPSED = 4;

export function DeadlineBar({ cons, hotelsByCon, today }: { cons: Con[]; hotelsByCon: Map<string, Hotel[]>; today: IsoDate }) {
  const [expanded, setExpanded] = useState(false);
  const list = upcoming(
    cons.flatMap((c) => conDeadlines(c, hotelsByCon.get(c.id) ?? [])),
    today,
  );
  if (list.length === 0) return null;
  const shown = expanded ? list : list.slice(0, COLLAPSED);

  return (
    <section className="card">
      <div className="card-header">
        <CalendarClock size={20} className="muted" />
        <h2>Demnächst fällig</h2>
        <button className="btn ghost small" onClick={() => exportDeadlines(list, 'ConGanizer-Fristen')} title="Alle Fristen in den Kalender">
          <CalendarPlus size={16} /> Kalender
        </button>
      </div>
      <div className="deadline-bar">
        {shown.map((d) => (
          <Link
            key={`${d.conId}-${d.kind}-${d.label}`}
            to={`/con/${d.conId}`}
            className={`deadline-item ${daysUntil(d.date, today) <= 14 ? 'soon' : ''}`}
          >
            <span style={{ flex: 1, minWidth: 0 }}>
              {d.label}
              <span className="muted"> · {d.conName}</span>
            </span>
            <span className="when">
              {formatWeekdayDate(d.date)} · {relativeDays(d.date, today)}
            </span>
          </Link>
        ))}
      </div>
      {list.length > COLLAPSED && (
        <button className="btn ghost small" onClick={() => setExpanded((e) => !e)}>
          {expanded ? 'Weniger anzeigen' : `Alle ${list.length} anzeigen`}
        </button>
      )}
    </section>
  );
}
