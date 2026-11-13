import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { ArrowLeft, Car, Play } from 'lucide-react';
import { useAllTrips, useCons } from '../../db/hooks';
import type { Trip } from '../../db/types';
import { parseIso } from '../../domain/dates';
import { formatKm, kmTotals, openTrip, sortTrips } from '../../domain/trips';
import { EmptyState } from '../../ui/common';
import { OpenTripBanner, TripCard, TripTransferView } from './TripParts';
import { editTripState, newTripDraft, TripSheet, type TripSheetState } from './TripSheet';

type View = 'liste' | 'uebertragen';

export function LogbookPage() {
  const navigate = useNavigate();
  const trips = useAllTrips();
  const cons = useCons();
  const [sheet, setSheet] = useState<TripSheetState | null>(null);
  const [view, setView] = useState<View>('liste');
  const [onlyOpen, setOnlyOpen] = useState(false);

  const conNames = useMemo(() => new Map((cons ?? []).map((c) => [c.id, c.name])), [cons]);
  const year = String(new Date().getFullYear());

  const { byMonth, transferList, totals, running } = useMemo(() => {
    const all = trips ?? [];
    const filtered = onlyOpen ? all.filter((t) => !t.transferred) : all;
    const byMonth = new Map<string, Trip[]>();
    for (const t of sortTrips(filtered, 'desc')) {
      const key = t.date.slice(0, 7);
      byMonth.set(key, [...(byMonth.get(key) ?? []), t]);
    }
    return {
      byMonth,
      transferList: sortTrips(filtered, 'asc'),
      totals: kmTotals(all.filter((t) => t.date.startsWith(year))),
      running: openTrip(all),
    };
  }, [trips, onlyOpen, year]);

  if (!trips) return null;

  return (
    <>
      <header className="topbar">
        <button className="btn ghost icon" aria-label="Zurück" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1>Fahrtenbuch</h1>
        <button className="btn primary small" onClick={() => setSheet({ mode: 'start', draft: newTripDraft(trips) })}>
          <Play size={16} /> Fahrt
        </button>
      </header>

      <main className="page">
        <OpenTripBanner trip={running} onEnd={(t) => setSheet(editTripState(t))} />

        {trips.length === 0 ? (
          <EmptyState icon={<Car size={44} />} title="Noch keine Fahrten">
            <span>Starte eine Fahrt am Auto – Uhrzeit und km-Stand werden erfasst, die km rechnet die App.</span>
            <button className="btn primary" onClick={() => setSheet({ mode: 'start', draft: newTripDraft(trips) })}>
              <Play size={16} /> Fahrt starten
            </button>
          </EmptyState>
        ) : (
          <>
            <section className="card">
              <div className="stats">
                <div className="stat">
                  <span className="label">Geschäftlich {year}</span>
                  <span className="value">{formatKm(totals.geschaeftlich)}</span>
                </div>
                <div className="stat">
                  <span className="label">Wohnung–Arbeit {year}</span>
                  <span className="value">{formatKm(totals.wohnung)}</span>
                </div>
                <div className="stat">
                  <span className="label">Privat {year}</span>
                  <span className="value">{formatKm(totals.privat)}</span>
                </div>
              </div>
            </section>

            <div className="row">
              <div className="segmented">
                <button aria-pressed={view === 'liste'} onClick={() => setView('liste')}>
                  Liste
                </button>
                <button aria-pressed={view === 'uebertragen'} onClick={() => setView('uebertragen')}>
                  Fürs Papierbuch
                </button>
              </div>
              <span className="spacer" />
              <button className="chip" aria-pressed={onlyOpen} onClick={() => setOnlyOpen((v) => !v)}>
                Nur nicht übertragen
              </button>
            </div>

            {view === 'uebertragen' ? (
              <TripTransferView trips={transferList} />
            ) : (
              [...byMonth.entries()].map(([month, list]) => (
                <div key={month} className="stack">
                  <h2 className="section-title">{format(parseIso(`${month}-01`), 'LLLL yyyy', { locale: de })}</h2>
                  {list.map((t) => (
                    <TripCard key={t.id} trip={t} conName={conNames.get(t.conId)} onOpen={() => setSheet(editTripState(t))} />
                  ))}
                </div>
              ))
            )}
          </>
        )}
      </main>

      {sheet && <TripSheet state={sheet} onClose={() => setSheet(null)} />}
    </>
  );
}
