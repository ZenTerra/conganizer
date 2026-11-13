import type { CSSProperties, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { CalendarClock, CalendarPlus, MapPin } from 'lucide-react';
import { exportDeadlines } from '../../overview/DeadlineBar';
import { db } from '../../../db/db';
import { useConRecords } from '../../../db/hooks';
import { updateRecord } from '../../../db/repo';
import { CON_STATUSES } from '../../../db/types';
import { conDays, daysUntil, formatDate, formatRange, formatWeekdayDate, relativeDays, todayIso } from '../../../domain/dates';
import { conDeadlines } from '../../../domain/deadlines';
import { mapsSearchUrl } from '../../../domain/maps';
import { formatEuro } from '../../../domain/money';
import { STATUS_META, statusSideEffects } from '../../../domain/status';
import { linkify } from '../../../domain/text';
import { ConCover } from '../../../ui/common';
import { Checkbox } from '../../../ui/fields';
import { useConContext } from '../ConLayout';
import { ReviewCard } from '../ReviewCard';
import { SeriesCard } from '../SeriesCard';

function KV({ rows }: { rows: [string, ReactNode][] }) {
  const visible = rows.filter(([, v]) => v !== undefined && v !== null && v !== '' && v !== false);
  if (visible.length === 0) return null;
  return (
    <dl className="kv">
      {visible.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function OverviewTab() {
  const { con } = useConContext();
  const hotels = useConRecords(db.hotels, con.id) ?? [];
  const today = todayIso();
  const days = conDays(con.startDate, con.endDate);
  const deadlines = conDeadlines(con, hotels);
  const untilStart = daysUntil(con.startDate, today);
  const editLink = `/con/${con.id}/bearbeiten`;

  const hasVenue =
    con.venueName || con.venueAddress || con.hall || con.booth || con.tableSize || con.power || con.setupTimes || con.teardownTimes;
  const links = (con.contactLinks ?? '').split('\n').filter((l) => l.trim());

  return (
    <>
      <div className="grid-2">
        <section className="card">
          <ConCover name={con.name} imageId={con.coverImageId} large className="cover-preview" />
          <div className="row">
            <strong style={{ fontSize: '1.05rem' }}>{formatRange(con.startDate, con.endDate)}</strong>
            <span className="muted small">
              · {days.length} {days.length === 1 ? 'Tag' : 'Tage'}
            </span>
            <span className="spacer" />
            {untilStart > 0 && <span className="muted small">startet {relativeDays(con.startDate, today)}</span>}
            {untilStart <= 0 && con.endDate >= today && <span className="success-text small">läuft gerade</span>}
          </div>
          {(con.departureDate || con.returnDate) && (
            <p className="muted small" style={{ margin: 0 }}>
              Abfahrt {formatDate(con.departureDate ?? con.startDate)} · Rückkehr {formatDate(con.returnDate ?? con.endDate)}
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Bewerbung</h2>
          </div>
          <div className="segmented" role="group" aria-label="Status ändern">
            {CON_STATUSES.map((s) => (
              <button
                key={s}
                aria-pressed={con.status === s}
                style={{ '--seg-color': STATUS_META[s].color } as CSSProperties}
                onClick={() => updateRecord(db.cons, con.id, statusSideEffects(con, s, today))}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <KV
            rows={[
              ['Bewerbung öffnet', formatDate(con.applicationOpens)],
              ['Bewerbungsschluss', formatDate(con.applicationCloses)],
              ['Beworben am', formatDate(con.appliedAt)],
              ['Zusage am', formatDate(con.acceptedAt)],
              ['Standgebühr', formatEuro(con.fee)],
              ['Zahlungsfrist', formatDate(con.feeDue)],
            ]}
          />
          {(con.fee !== undefined || con.feeDue) && (
            <Checkbox
              label="Standgebühr bezahlt"
              checked={con.feePaid}
              onChange={(v) => updateRecord(db.cons, con.id, { feePaid: v })}
            />
          )}
        </section>
      </div>

      {deadlines.length > 0 && (
        <section className="card">
          <div className="card-header">
            <CalendarClock size={20} className="muted" />
            <h2>Fristen</h2>
            <button
              className="btn ghost small"
              onClick={() => exportDeadlines(deadlines.filter((d) => d.date >= today), `${con.name}-Fristen`)}
              disabled={!deadlines.some((d) => d.date >= today)}
            >
              <CalendarPlus size={16} /> Kalender
            </button>
          </div>
          <ul className="list-plain">
            {deadlines.map((d) => {
              const n = daysUntil(d.date, today);
              const cls = n < 0 ? 'faint' : n <= 14 ? 'warn-text' : '';
              return (
                <li key={d.kind + d.label} className={`row ${cls}`}>
                  <span style={{ flex: 1 }}>{d.label}</span>
                  <span className="small">
                    {formatWeekdayDate(d.date)} · {relativeDays(d.date, today)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <div className="grid-2">
        <section className="card">
          <div className="card-header">
            <h2>Ort & Stand</h2>
          </div>
          {hasVenue ? (
            <KV
              rows={[
                ['Ort', con.venueName],
                [
                  'Adresse',
                  con.venueAddress && (
                    <a href={mapsSearchUrl(con.venueAddress)} target="_blank" rel="noreferrer">
                      <MapPin size={14} style={{ verticalAlign: -2 }} /> {con.venueAddress}
                    </a>
                  ),
                ],
                ['Halle / Stand', [con.hall, con.booth].filter(Boolean).join(' · ')],
                ['Tisch', con.tableSize],
                ['Strom', con.power ? 'Ja' : undefined],
                ['Aufbau', con.setupTimes],
                ['Abbau', con.teardownTimes],
              ]}
            />
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              Noch keine Angaben. <Link to={editLink}>Ergänzen</Link>
            </p>
          )}
        </section>

        <section className="card">
          <div className="card-header">
            <h2>Kontakt</h2>
          </div>
          {con.contactName || links.length ? (
            <>
              {con.contactName && <div>{con.contactName}</div>}
              <ul className="list-plain">
                {links.map((l) => {
                  const { text, href } = linkify(l);
                  return (
                    <li key={l} style={{ overflowWrap: 'anywhere' }}>
                      {href ? (
                        <a href={href} target="_blank" rel="noreferrer">
                          {text}
                        </a>
                      ) : (
                        text
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="muted small" style={{ margin: 0 }}>
              Noch keine Angaben. <Link to={editLink}>Ergänzen</Link>
            </p>
          )}
        </section>
      </div>

      {(untilStart <= 0 || con.rating || con.lessons || con.reapply) && <ReviewCard con={con} />}

      {con.notes && (
        <section className="card">
          <h2>Notizen</h2>
          <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{con.notes}</p>
        </section>
      )}
      <SeriesCard con={con} />
    </>
  );
}
