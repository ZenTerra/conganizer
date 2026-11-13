import { useState, type CSSProperties } from 'react';
import { BedDouble, MapPin, Pencil, Plus, Trash2 } from 'lucide-react';
import { differenceInCalendarDays } from 'date-fns';
import { db } from '../../../db/db';
import { useConRecords } from '../../../db/hooks';
import { createRecord, deleteRecord, updateRecord } from '../../../db/repo';
import type { Hotel, NewRecord } from '../../../db/types';
import { daysUntil, formatDate, isValidIso, parseIso, relativeDays, todayIso } from '../../../domain/dates';
import { mapsSearchUrl } from '../../../domain/maps';
import { formatEuro } from '../../../domain/money';
import { EmptyState } from '../../../ui/common';
import { Checkbox, DateField, MoneyField, TextArea, TextField } from '../../../ui/fields';
import { useConContext } from '../ConLayout';

type HotelDraft = Omit<NewRecord<Hotel>, 'conId'>;

function nights(h: Pick<Hotel, 'checkIn' | 'checkOut'>): number | undefined {
  if (!isValidIso(h.checkIn) || !isValidIso(h.checkOut)) return undefined;
  const n = differenceInCalendarDays(parseIso(h.checkOut), parseIso(h.checkIn));
  return n > 0 ? n : undefined;
}

function HotelForm({
  initial,
  onSave,
  onCancel,
  onDelete,
}: {
  initial: HotelDraft;
  onSave: (d: HotelDraft) => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [d, setD] = useState<HotelDraft>(initial);
  const set = <K extends keyof HotelDraft>(k: K, v: HotelDraft[K]) => setD((x) => ({ ...x, [k]: v }));
  return (
    <section className="card">
      <Checkbox label="Gebucht" checked={d.booked} onChange={(v) => set('booked', v)} />
      <TextField label="Name" value={d.name} onChange={(v) => set('name', v)} placeholder="z. B. Motel One Messe" />
      <TextField label="Adresse" value={d.address} onChange={(v) => set('address', v)} placeholder="Straße, PLZ Ort" />
      <div className="form-grid">
        <DateField label="Check-in" value={d.checkIn} onChange={(v) => set('checkIn', v)} />
        <DateField label="Check-out" value={d.checkOut} min={d.checkIn} onChange={(v) => set('checkOut', v)} />
        <MoneyField label="Preis gesamt" value={d.price} onChange={(v) => set('price', v)} />
        <TextField label="Buchungsnummer" value={d.bookingRef} onChange={(v) => set('bookingRef', v)} />
        <DateField
          label="Kostenlos stornierbar bis"
          value={d.cancelDeadline}
          onChange={(v) => set('cancelDeadline', v)}
          className="full"
        />
      </div>
      <TextArea label="Notiz" value={d.notes} onChange={(v) => set('notes', v)} rows={2} />
      <div className="row">
        <button className="btn primary" onClick={() => onSave(d)}>
          Speichern
        </button>
        <button className="btn ghost" onClick={onCancel}>
          Abbrechen
        </button>
        <span className="spacer" />
        {onDelete && (
          <button className="btn danger icon" aria-label="Hotel löschen" onClick={onDelete}>
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </section>
  );
}

function HotelCard({ hotel, onEdit }: { hotel: Hotel; onEdit: () => void }) {
  const today = todayIso();
  const n = nights(hotel);
  const cancelIn = hotel.cancelDeadline ? daysUntil(hotel.cancelDeadline, today) : undefined;
  return (
    <section className="card">
      <div className="card-header">
        <h3>{hotel.name || 'Hotel'}</h3>
        <span
          className="badge"
          style={{ '--badge-color': hotel.booked ? 'var(--success)' : 'var(--warning)' } as CSSProperties}
        >
          {hotel.booked ? 'Gebucht' : 'Nicht gebucht'}
        </span>
        <button className="btn ghost icon small" aria-label="Bearbeiten" onClick={onEdit}>
          <Pencil size={16} />
        </button>
      </div>
      <dl className="kv">
        {hotel.address && (
          <>
            <dt>Adresse</dt>
            <dd>
              <a href={mapsSearchUrl(hotel.address)} target="_blank" rel="noreferrer">
                <MapPin size={14} style={{ verticalAlign: -2 }} /> {hotel.address}
              </a>
            </dd>
          </>
        )}
        {(hotel.checkIn || hotel.checkOut) && (
          <>
            <dt>Zeitraum</dt>
            <dd>
              {formatDate(hotel.checkIn)} – {formatDate(hotel.checkOut)}
              {n ? <span className="muted"> · {n} {n === 1 ? 'Nacht' : 'Nächte'}</span> : null}
            </dd>
          </>
        )}
        {hotel.price !== undefined && (
          <>
            <dt>Preis</dt>
            <dd>
              {formatEuro(hotel.price)}
              {n && n > 1 ? <span className="muted"> · {formatEuro(Math.round(hotel.price / n))} / Nacht</span> : null}
            </dd>
          </>
        )}
        {hotel.bookingRef && (
          <>
            <dt>Buchungsnr.</dt>
            <dd style={{ userSelect: 'all' }}>{hotel.bookingRef}</dd>
          </>
        )}
        {hotel.cancelDeadline && (
          <>
            <dt>Storno bis</dt>
            <dd className={cancelIn !== undefined && cancelIn >= 0 && cancelIn <= 14 ? 'warn-text' : cancelIn! < 0 ? 'faint' : ''}>
              {formatDate(hotel.cancelDeadline)} · {relativeDays(hotel.cancelDeadline, today)}
            </dd>
          </>
        )}
      </dl>
      {hotel.notes && <p style={{ margin: 0, whiteSpace: 'pre-wrap' }} className="muted">{hotel.notes}</p>}
    </section>
  );
}

export function HotelTab() {
  const { con } = useConContext();
  const hotels = useConRecords(db.hotels, con.id);
  const [editing, setEditing] = useState<string | 'new' | null>(null);

  if (!hotels) return null;
  const total = hotels.reduce((s, h) => s + (h.price ?? 0), 0);
  const sorted = [...hotels].sort((a, b) => (a.checkIn ?? '').localeCompare(b.checkIn ?? ''));

  const newDraft: HotelDraft = {
    booked: false,
    checkIn: con.departureDate && con.departureDate < con.startDate ? con.departureDate : con.startDate,
    checkOut: con.endDate,
  };

  return (
    <>
      {hotels.length === 0 && editing !== 'new' && (
        <EmptyState icon={<BedDouble size={44} />} title="Noch kein Hotel eingetragen">
          <button className="btn primary" onClick={() => setEditing('new')}>
            <Plus size={18} /> Hotel hinzufügen
          </button>
        </EmptyState>
      )}

      {hotels.length > 1 && (
        <div className="status-banner">
          <BedDouble size={18} /> Hotelkosten gesamt: <strong>{formatEuro(total)}</strong>
        </div>
      )}

      {sorted.map((h) =>
        editing === h.id ? (
          <HotelForm
            key={h.id}
            initial={h}
            onCancel={() => setEditing(null)}
            onSave={async (d) => {
              await updateRecord(db.hotels, h.id, d);
              setEditing(null);
            }}
            onDelete={async () => {
              if (confirm('Dieses Hotel löschen?')) {
                await deleteRecord(db.hotels, h.id);
                setEditing(null);
              }
            }}
          />
        ) : (
          <HotelCard key={h.id} hotel={h} onEdit={() => setEditing(h.id)} />
        ),
      )}

      {editing === 'new' && (
        <HotelForm
          initial={newDraft}
          onCancel={() => setEditing(null)}
          onSave={async (d) => {
            await createRecord(db.hotels, { ...d, conId: con.id });
            setEditing(null);
          }}
        />
      )}

      {hotels.length > 0 && editing !== 'new' && (
        <button className="btn" onClick={() => setEditing('new')}>
          <Plus size={18} /> Weiteres Hotel
        </button>
      )}
    </>
  );
}
