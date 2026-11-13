import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { Car, CalendarHeart, ChevronRight, Plus, Settings } from 'lucide-react';
import { db } from '../../db/db';
import { useAllTrips, useCons } from '../../db/hooks';
import { alive } from '../../db/repo';
import { CON_STATUSES, type Con, type ConStatus, type Hotel } from '../../db/types';
import { todayIso } from '../../domain/dates';
import { STATUS_META } from '../../domain/status';
import { openTrip } from '../../domain/trips';
import { OpenTripBanner } from '../trips/TripParts';
import { editTripState, TripSheet, type TripSheetState } from '../trips/TripSheet';
import { EmptyState } from '../../ui/common';
import { ConTile } from './ConTile';

type Filter = 'alle' | ConStatus;

export function OverviewPage() {
  const cons = useCons();
  const hotels = useLiveQuery(async () => alive(await db.hotels.toArray()), []);
  const [filter, setFilter] = useState<Filter>('alle');
  const trips = useAllTrips();
  const running = openTrip(trips ?? []);
  const [sheet, setSheet] = useState<TripSheetState | null>(null);
  const today = todayIso();

  const hotelsByCon = useMemo(() => {
    const map = new Map<string, Hotel[]>();
    for (const h of hotels ?? []) map.set(h.conId, [...(map.get(h.conId) ?? []), h]);
    return map;
  }, [hotels]);

  const { upcoming, archiveByYear, counts } = useMemo(() => {
    const list = cons ?? [];
    const counts: Record<string, number> = { alle: list.length };
    for (const c of list) counts[c.status] = (counts[c.status] ?? 0) + 1;

    const visible = filter === 'alle' ? list : list.filter((c) => c.status === filter);
    const upcoming = visible
      .filter((c) => (c.endDate || c.startDate) >= today)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    const past = visible
      .filter((c) => (c.endDate || c.startDate) < today)
      .sort((a, b) => b.startDate.localeCompare(a.startDate));
    const archiveByYear = new Map<string, Con[]>();
    for (const c of past) {
      const year = c.startDate.slice(0, 4);
      archiveByYear.set(year, [...(archiveByYear.get(year) ?? []), c]);
    }
    return { upcoming, archiveByYear, counts };
  }, [cons, filter, today]);

  return (
    <>
      <header className="topbar">
        <h1 className="brand">
          <img src={`${import.meta.env.BASE_URL}pwa-64x64.png`} alt="" />
          ConGanizer
        </h1>
        <Link to="/fahrtenbuch" className="btn ghost icon" aria-label="Fahrtenbuch">
          <Car size={22} />
        </Link>
        <Link to="/einstellungen" className="btn ghost icon" aria-label="Einstellungen">
          <Settings size={22} />
        </Link>
      </header>

      <main className="page">
        <OpenTripBanner trip={running} onEnd={(t) => setSheet(editTripState(t))} />
        {cons === undefined ? null : cons.length === 0 ? (
          <EmptyState icon={<CalendarHeart size={48} />} title="Noch keine Cons">
            <span>Leg deine erste Convention an – Status, Hotel und Fristen hast du dann auf einen Blick.</span>
            <Link to="/neu" className="btn primary">
              <Plus size={18} /> Erste Con anlegen
            </Link>
          </EmptyState>
        ) : (
          <>
            <div className="chips" role="toolbar" aria-label="Nach Status filtern">
              <button className="chip" aria-pressed={filter === 'alle'} onClick={() => setFilter('alle')}>
                Alle {counts.alle}
              </button>
              {CON_STATUSES.filter((s) => counts[s]).map((s) => (
                <button key={s} className="chip" aria-pressed={filter === s} onClick={() => setFilter(s)}>
                  {STATUS_META[s].label} {counts[s]}
                </button>
              ))}
            </div>

            <h2 className="section-title">Kommende Cons</h2>
            {upcoming.length === 0 ? (
              <p className="muted small">Keine kommenden Cons{filter !== 'alle' ? ' mit diesem Status' : ''}.</p>
            ) : (
              <div className="tiles">
                {upcoming.map((c) => (
                  <ConTile key={c.id} con={c} hotels={hotelsByCon.get(c.id) ?? []} today={today} />
                ))}
              </div>
            )}

            {archiveByYear.size > 0 && (
              <>
                <h2 className="section-title" style={{ marginTop: 12 }}>
                  Archiv
                </h2>
                {[...archiveByYear.entries()].map(([year, list]) => (
                  <details key={year} className="archive">
                    <summary>
                      <ChevronRight size={18} /> {year} <span className="faint">({list.length})</span>
                    </summary>
                    <div className="tiles">
                      {list.map((c) => (
                        <ConTile key={c.id} con={c} hotels={[]} today={today} />
                      ))}
                    </div>
                  </details>
                ))}
              </>
            )}
          </>
        )}
      </main>

      {cons && cons.length > 0 && (
        <Link to="/neu" className="btn primary fab">
          <Plus size={20} /> Neue Con
        </Link>
      )}
      {sheet && <TripSheet state={sheet} onClose={() => setSheet(null)} />}
    </>
  );
}
