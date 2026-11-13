import type { CSSProperties } from 'react';
import { Car, CheckCircle2, Square } from 'lucide-react';
import { db } from '../../db/db';
import { updateRecord } from '../../db/repo';
import type { Trip } from '../../db/types';
import { formatDate, formatWeekdayDate } from '../../domain/dates';
import { formatEuro } from '../../domain/money';
import { CATEGORY_META, formatKm, isOpen, routeLabel } from '../../domain/trips';
import { Checkbox } from '../../ui/fields';

const timeRange = (t: Trip) => (t.startTime || t.endTime ? `${t.startTime ?? '?'}–${t.endTime ?? '…'}` : '');
const num = (n: number | undefined) => (n === undefined ? '' : n.toLocaleString('de-DE'));

export function TripCard({ trip, conName, onOpen }: { trip: Trip; conName?: string; onOpen: () => void }) {
  const open = isOpen(trip);
  return (
    <section className={`card trip-card ${open ? 'open' : ''}`} onClick={onOpen} role="button" tabIndex={0}>
      <div className="row small muted">
        <span>
          {formatWeekdayDate(trip.date)} {timeRange(trip)}
        </span>
        <span className="spacer" />
        {trip.transferred && (
          <span className="success-text row" style={{ gap: 4 }}>
            <CheckCircle2 size={14} /> übertragen
          </span>
        )}
      </div>
      <div className="trip-route">{routeLabel(trip)}</div>
      {(trip.purpose || conName) && <div className="small muted">{trip.purpose || conName}</div>}
      <div className="row small">
        {open ? (
          <span className="badge" style={{ '--badge-color': 'var(--accent-bright)' } as CSSProperties}>
            <Car size={12} /> läuft
          </span>
        ) : (
          <strong>{formatKm(trip.km)}</strong>
        )}
        {trip.category !== 'geschaeftlich' && (
          <span className="badge" style={{ '--badge-color': 'var(--status-interessant)' } as CSSProperties}>
            {CATEGORY_META[trip.category].label}
          </span>
        )}
        {trip.odoStart !== undefined && (
          <span className="faint">
            km-Stand {num(trip.odoStart)}
            {trip.odoEnd !== undefined ? ` → ${num(trip.odoEnd)}` : ''}
          </span>
        )}
        {trip.costAmount ? <span className="faint">· {formatEuro(trip.costAmount)} {trip.costPurpose}</span> : null}
      </div>
    </section>
  );
}

export function OpenTripBanner({ trip, onEnd }: { trip: Trip | undefined; onEnd: (t: Trip) => void }) {
  if (!trip) return null;
  return (
    <div className="status-banner warn">
      <Car size={20} />
      <span style={{ flex: 1, minWidth: 0 }}>
        Fahrt läuft seit <strong>{trip.startTime}</strong>
        <br />
        <span className="small muted">{routeLabel(trip)}</span>
      </span>
      <button className="btn primary small" onClick={() => onEnd(trip)}>
        <Square size={14} /> Beenden
      </button>
    </div>
  );
}

const km = (t: Trip, c: Trip['category']) => (t.category === c && !isOpen(t) ? num(t.km) : '');

/** Werte in der Spaltenreihenfolge des Papier-Fahrtenbuchs. */
export function TripTransferView({ trips }: { trips: Trip[] }) {
  const toggle = (t: Trip, v: boolean) => updateRecord(db.trips, t.id, { transferred: v });
  if (trips.length === 0) return <p className="muted small">Keine Fahrten.</p>;
  return (
    <>
      <div className="only-desktop card" style={{ padding: 0, overflowX: 'auto' }}>
        <table className="transfer-table">
          <thead>
            <tr>
              <th>Datum</th>
              <th>Fahrzeit von–bis</th>
              <th>Reiseroute und Ziel</th>
              <th>Zweck der Fahrt</th>
              <th>km-Stand Beginn</th>
              <th>gesch.</th>
              <th>Wohn./Arb.</th>
              <th>privat</th>
              <th>km-Stand Ende</th>
              <th>Kosten EUR</th>
              <th>Verwendungszweck</th>
              <th>✓</th>
            </tr>
          </thead>
          <tbody>
            {trips.map((t) => (
              <tr key={t.id} className={t.transferred ? 'transferred' : ''}>
                <td>{formatDate(t.date)}</td>
                <td>{timeRange(t)}</td>
                <td>{routeLabel(t)}</td>
                <td>{t.purpose}</td>
                <td className="num">{num(t.odoStart)}</td>
                <td className="num">{km(t, 'geschaeftlich')}</td>
                <td className="num">{km(t, 'wohnung')}</td>
                <td className="num">{km(t, 'privat')}</td>
                <td className="num">{num(t.odoEnd)}</td>
                <td className="num">{t.costAmount ? (t.costAmount / 100).toFixed(2).replace('.', ',') : ''}</td>
                <td>{t.costPurpose}</td>
                <td>
                  <input
                    type="checkbox"
                    aria-label="übertragen"
                    checked={t.transferred}
                    onChange={(e) => toggle(t, e.target.checked)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="only-mobile stack">
        {trips.map((t) => (
          <section key={t.id} className="card" style={t.transferred ? { opacity: 0.6 } : undefined}>
            <dl className="kv">
              <dt>Datum</dt>
              <dd>{formatDate(t.date)}</dd>
              <dt>Fahrzeit</dt>
              <dd>{timeRange(t) || '–'}</dd>
              <dt>Reiseroute & Ziel</dt>
              <dd>{routeLabel(t)}</dd>
              <dt>Zweck</dt>
              <dd>{t.purpose || '–'}</dd>
              <dt>km-Stand Beginn</dt>
              <dd>{num(t.odoStart) || '–'}</dd>
              <dt>Gefahrene km</dt>
              <dd>
                {isOpen(t) ? 'läuft noch' : `${num(t.km)} (${CATEGORY_META[t.category].label})`}
              </dd>
              <dt>km-Stand Ende</dt>
              <dd>{num(t.odoEnd) || '–'}</dd>
              {t.costAmount ? (
                <>
                  <dt>Kosten</dt>
                  <dd>
                    {formatEuro(t.costAmount)} {t.costPurpose}
                  </dd>
                </>
              ) : null}
            </dl>
            <Checkbox label="Übertragen" checked={t.transferred} onChange={(v) => toggle(t, v)} />
          </section>
        ))}
      </div>
    </>
  );
}
