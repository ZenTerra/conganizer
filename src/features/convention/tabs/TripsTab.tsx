import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftRight, BookOpen, Car, Map as MapIcon, MoveLeft, MoveRight, Plus } from 'lucide-react';
import { db } from '../../../db/db';
import { useAllTrips, useConRecords, useSettings } from '../../../db/hooks';
import type { TripKind } from '../../../db/types';
import { mapsRouteUrl } from '../../../domain/maps';
import { formatEuro } from '../../../domain/money';
import { formatKm, KIND_LABEL, kmTotals, openTrip, sortTrips } from '../../../domain/trips';
import { OpenTripBanner, TripCard, TripTransferView } from '../../trips/TripParts';
import { editTripState, newTripDraft, TripSheet, type TripSheetState } from '../../trips/TripSheet';
import { useConContext } from '../ConLayout';

export function TripsTab() {
  const { con } = useConContext();
  const settings = useSettings();
  const allTrips = useAllTrips();
  const hotels = useConRecords(db.hotels, con.id) ?? [];
  const [sheet, setSheet] = useState<TripSheetState | null>(null);
  const [view, setView] = useState<'liste' | 'uebertragen'>('liste');

  const trips = useMemo(() => sortTrips((allTrips ?? []).filter((t) => t.conId === con.id)), [allTrips, con.id]);
  if (!allTrips || !settings) return null;

  const hotel = hotels.find((h) => h.booked) ?? hotels[0];
  const home = { label: 'Zuhause', address: settings.homeAddress };
  const hotelPlace = hotel && { label: hotel.name || hotel.address || 'Hotel', address: hotel.address || hotel.name || '' };
  const venuePlace = (con.venueName || con.venueAddress) && {
    label: con.venueName || con.venueAddress || '',
    address: con.venueAddress || con.venueName || '',
  };
  const target = hotelPlace || venuePlace || { label: con.name, address: '' };

  const quick: Record<Exclude<TripKind, 'sonstig'>, { from: typeof home; to: typeof home } | null> = {
    hin: { from: home, to: target },
    rueck: { from: target, to: home },
    pendel: hotelPlace && venuePlace ? { from: hotelPlace, to: venuePlace } : null,
  };

  const start = (kind: TripKind) => {
    const q = kind === 'sonstig' ? null : quick[kind];
    setSheet({
      mode: 'start',
      draft: newTripDraft(allTrips, {
        conId: con.id,
        kind,
        from: q?.from.label ?? '',
        to: q?.to.label ?? '',
        purpose: kind === 'sonstig' ? con.name : `${KIND_LABEL[kind]} ${con.name}`,
      }),
    });
  };

  const totals = kmTotals(trips);
  const running = openTrip(allTrips);
  const routeTarget = target.address;

  return (
    <>
      <OpenTripBanner trip={running} onEnd={(t) => setSheet(editTripState(t))} />

      <section className="card">
        <h2>Fahrt starten</h2>
        <div className="quick-actions">
          <button className="btn" onClick={() => start('hin')}>
            <MoveRight size={16} /> Hinfahrt
          </button>
          <button className="btn" onClick={() => start('rueck')}>
            <MoveLeft size={16} /> Rückfahrt
          </button>
          <button className="btn" onClick={() => start('pendel')} disabled={!quick.pendel}>
            <ArrowLeftRight size={16} /> Hotel → Halle
          </button>
          <button className="btn" onClick={() => start('sonstig')}>
            <Plus size={16} /> Andere
          </button>
        </div>
        <div className="row small">
          {settings.homeAddress && routeTarget ? (
            <a href={mapsRouteUrl(settings.homeAddress, routeTarget)} target="_blank" rel="noreferrer" className="row" style={{ gap: 4 }}>
              <MapIcon size={14} /> Route Zuhause → {target.label}
            </a>
          ) : (
            <span className="faint">
              Für Route & Vorbelegung: {!settings.homeAddress && <Link to="/einstellungen">Heimatadresse</Link>}
              {!settings.homeAddress && !routeTarget && ' und '}
              {!routeTarget && 'Hotel- bzw. Veranstaltungsadresse'} eintragen.
            </span>
          )}
          <span className="spacer" />
          <Link to="/fahrtenbuch" className="row" style={{ gap: 4 }}>
            <BookOpen size={14} /> Gesamtes Fahrtenbuch
          </Link>
        </div>
      </section>

      {trips.length > 0 && (
        <>
          <section className="card">
            <div className="stats">
              <div className="stat">
                <span className="label">Geschäftlich gefahren</span>
                <span className="value">{formatKm(totals.geschaeftlich)}</span>
              </div>
              <div className="stat">
                <span className="label">km-Pauschale ({formatEuro(settings.kmRate)}/km)</span>
                <span className="value">{formatEuro(Math.round(totals.geschaeftlich * settings.kmRate))}</span>
              </div>
              {totals.privat > 0 && (
                <div className="stat">
                  <span className="label">Privat</span>
                  <span className="value">{formatKm(totals.privat)}</span>
                </div>
              )}
            </div>
          </section>

          <div className="segmented">
            <button aria-pressed={view === 'liste'} onClick={() => setView('liste')}>
              Liste
            </button>
            <button aria-pressed={view === 'uebertragen'} onClick={() => setView('uebertragen')}>
              Fürs Papierbuch
            </button>
          </div>

          {view === 'liste' ? (
            trips.map((t) => <TripCard key={t.id} trip={t} onOpen={() => setSheet(editTripState(t))} />)
          ) : (
            <TripTransferView trips={trips} />
          )}
        </>
      )}

      {trips.length === 0 && (
        <p className="muted small" style={{ textAlign: 'center' }}>
          <Car size={16} style={{ verticalAlign: -3 }} /> Noch keine Fahrten für diese Con.
        </p>
      )}

      {sheet && <TripSheet state={sheet} onClose={() => setSheet(null)} />}
    </>
  );
}
