import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { CopyPlus, Star } from 'lucide-react';
import { db } from '../../db/db';
import { alive, duplicateConForNextYear } from '../../db/repo';
import type { Con } from '../../db/types';
import { formatRange } from '../../domain/dates';
import { StatusBadge } from '../../ui/common';

/** Andere Jahrgänge derselben Con + „Nächsten Jahrgang anlegen“. */
export function SeriesCard({ con }: { con: Con }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const siblings = useLiveQuery(
    async () =>
      alive(await db.cons.where('seriesId').equals(con.seriesId).toArray())
        .filter((c) => c.id !== con.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate)),
    [con.seriesId, con.id],
  );

  async function duplicate() {
    setBusy(true);
    try {
      const next = await duplicateConForNextYear(con.id);
      navigate(`/con/${next.id}/bearbeiten`, { replace: false });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <div className="card-header">
        <h2>Jahrgänge</h2>
        <button className="btn small" onClick={duplicate} disabled={busy}>
          <CopyPlus size={16} /> Nächsten Jahrgang anlegen
        </button>
      </div>
      {siblings && siblings.length > 0 ? (
        <ul className="list-plain">
          {siblings.map((s) => (
            <li key={s.id}>
              <Link to={`/con/${s.id}`} className="deadline-item" style={{ alignItems: 'flex-start' }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <strong>{s.name}</strong> <span className="muted small">{formatRange(s.startDate, s.endDate)}</span>
                  {s.lessons && (
                    <span className="small muted" style={{ display: 'block', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                      {s.lessons.length > 160 ? `${s.lessons.slice(0, 160)}…` : s.lessons}
                    </span>
                  )}
                </span>
                <span className="stack" style={{ gap: 4, alignItems: 'flex-end' }}>
                  <StatusBadge status={s.status} />
                  {s.rating ? (
                    <span className="small">
                      <Star size={12} fill="currentColor" style={{ color: 'var(--warning)', verticalAlign: -1 }} /> {s.rating}
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted small" style={{ margin: 0 }}>
          Übernimmt Name, Ort, Logistik, Kontakt, Titelbild und Hotel (nicht gebucht). Termine werden um 52 Wochen verschoben –
          bitte prüfen.
        </p>
      )}
    </section>
  );
}
