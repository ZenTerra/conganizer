import { useState, type CSSProperties } from 'react';
import { Play, Square, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import { useAllTrips, useCons } from '../../db/hooks';
import { createRecord, deleteRecord, updateRecord } from '../../db/repo';
import type { NewRecord, Trip, TripCategory, TripKind } from '../../db/types';
import { formatDate, todayIso } from '../../domain/dates';
import { formatKm, isOpen, kmFromOdo, lastOdometer, nowTime, CATEGORY_META } from '../../domain/trips';
import { Sheet } from '../../ui/common';
import { Checkbox, DateField, MoneyField, NumberField, TextField, TimeField } from '../../ui/fields';

export type TripDraft = NewRecord<Trip>;
export type TripSheetMode = 'start' | 'end' | 'edit';

export interface TripSheetState {
  mode: TripSheetMode;
  draft: TripDraft;
  /** gesetzt = bestehende Fahrt bearbeiten */
  id?: string;
}

/** Neue Fahrt mit sinnvollen Vorgaben (Datum/Uhrzeit jetzt, km-Stand = letzter Endstand). */
export function newTripDraft(
  allTrips: Trip[],
  over: Partial<TripDraft> & { kind?: TripKind } = {},
): TripDraft {
  const last = [...allTrips].filter((t) => !isOpen(t));
  return {
    conId: '',
    date: todayIso(),
    startTime: nowTime(),
    from: '',
    to: '',
    purpose: '',
    odoStart: lastOdometer(last),
    km: 0,
    kind: 'sonstig',
    category: 'geschaeftlich',
    transferred: false,
    ...over,
  };
}

export function editTripState(trip: Trip): TripSheetState {
  const { id, updatedAt: _u, deleted: _d, ...draft } = trip;
  return { mode: isOpen(trip) ? 'end' : 'edit', draft, id };
}

const TITLES: Record<TripSheetMode, string> = {
  start: 'Fahrt starten',
  end: 'Fahrt beenden',
  edit: 'Fahrt bearbeiten',
};

export function TripSheet({ state, onClose }: { state: TripSheetState; onClose: () => void }) {
  const cons = useCons();
  const allTrips = useAllTrips() ?? [];
  const [mode, setMode] = useState<TripSheetMode>(state.mode);
  const [d, setD] = useState<TripDraft>(() =>
    state.mode === 'end' && !state.draft.endTime ? { ...state.draft, endTime: nowTime() } : state.draft,
  );
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof TripDraft>(k: K, v: TripDraft[K]) => setD((x) => ({ ...x, [k]: v }));

  const computedKm = kmFromOdo(d.odoStart, d.odoEnd);
  const odoInvalid = d.odoStart !== undefined && d.odoEnd !== undefined && d.odoEnd < d.odoStart;
  const lastOdo = lastOdometer(allTrips.filter((t) => !isOpen(t)), state.id);
  const sortedCons = [...(cons ?? [])].sort((a, b) => b.startDate.localeCompare(a.startDate)).slice(0, 30);

  async function save(finish: boolean) {
    if (odoInvalid) return setError('km-Stand Ende ist kleiner als km-Stand Beginn');
    const data: TripDraft = { ...d, km: computedKm ?? d.km ?? 0 };
    if (mode === 'start' && !finish) {
      // Fahrt beginnt: Ende bleibt leer
      data.endTime = undefined;
      data.odoEnd = undefined;
    }
    if (finish && !data.endTime) data.endTime = nowTime();
    if (state.id) await updateRecord(db.trips, state.id, data);
    else await createRecord(db.trips, data);
    onClose();
  }

  async function remove() {
    if (state.id && confirm('Diese Fahrt löschen?')) {
      await deleteRecord(db.trips, state.id);
      onClose();
    }
  }

  const showStart = mode !== 'end';
  const showEnd = mode !== 'start';

  return (
    <Sheet title={TITLES[mode]} onClose={onClose}>
      {error && <div className="status-banner warn">{error}</div>}

      {mode === 'end' && (
        <div className="status-banner">
          <span>
            {formatDate(d.date)} · ab {d.startTime} · km-Stand {d.odoStart ?? '–'}
            <br />
            <strong>
              {d.from || '?'} → {d.to || '?'}
            </strong>
          </span>
        </div>
      )}

      {showStart && (
        <>
          <div className="form-grid">
            <DateField label="Datum" value={d.date} onChange={(v) => set('date', v ?? todayIso())} />
            <TimeField label="Abfahrt" value={d.startTime} onChange={(v) => set('startTime', v)} onNow={() => set('startTime', nowTime())} />
          </div>
          <TextField label="Von" value={d.from} onChange={(v) => set('from', v)} />
          <TextField label="Nach (Ziel)" value={d.to} onChange={(v) => set('to', v)} />
          <TextField
            label="Zweck der Fahrt"
            value={d.purpose}
            onChange={(v) => set('purpose', v)}
            placeholder="z. B. Hinfahrt DoKomi 2027"
          />
          <NumberField
            label="km-Stand Fahrtbeginn"
            value={d.odoStart}
            onChange={(v) => set('odoStart', v)}
            suffix="km"
            hint={lastOdo !== undefined ? `Letzter bekannter km-Stand: ${lastOdo.toLocaleString('de-DE')}` : undefined}
          />
        </>
      )}

      {showEnd && (
        <>
          <div className="form-grid">
            <TimeField label="Ankunft" value={d.endTime} onChange={(v) => set('endTime', v)} onNow={() => set('endTime', nowTime())} />
            <NumberField
              label="km-Stand Fahrtende"
              value={d.odoEnd}
              onChange={(v) => set('odoEnd', v)}
              suffix="km"
              error={odoInvalid ? 'Kleiner als Beginn' : undefined}
            />
          </div>
          {computedKm !== undefined ? (
            <div className="row">
              <span className="muted">Gefahrene km:</span> <strong>{formatKm(computedKm)}</strong>
            </div>
          ) : (
            <NumberField
              label="Gefahrene km (ohne km-Stand)"
              value={d.km || undefined}
              onChange={(v) => set('km', v ?? 0)}
              suffix="km"
            />
          )}
        </>
      )}

      {mode !== 'end' && (
        <>
          <div className="field">
            <span>Gefahrene km zählen als</span>
            <div className="segmented">
              {(Object.keys(CATEGORY_META) as TripCategory[]).map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-pressed={d.category === c}
                  style={{ '--seg-color': 'var(--accent-bright)' } as CSSProperties}
                  onClick={() => set('category', c)}
                >
                  {CATEGORY_META[c].label}
                </button>
              ))}
            </div>
          </div>
          <label className="field">
            <span>Con</span>
            <select value={d.conId} onChange={(e) => set('conId', e.target.value)}>
              <option value="">– ohne Con –</option>
              {sortedCons.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}

      {showEnd && (
        <details>
          <summary className="muted small" style={{ cursor: 'pointer', padding: '6px 0' }}>
            Kosten/Ausgaben (z. B. Benzin, Öl) {d.costAmount ? `· ${(d.costAmount / 100).toFixed(2).replace('.', ',')} €` : ''}
          </summary>
          <div className="form-grid" style={{ marginTop: 8 }}>
            <MoneyField label="Betrag" value={d.costAmount} onChange={(v) => set('costAmount', v)} />
            <TextField label="Verwendungszweck" value={d.costPurpose} onChange={(v) => set('costPurpose', v)} placeholder="Benzin" />
          </div>
          <p className="faint small" style={{ margin: '6px 0 0' }}>
            Nur fürs Fahrtenbuch – zählt nicht als Kosten (mit der km-Pauschale abgegolten).
          </p>
        </details>
      )}

      {mode === 'edit' && (
        <Checkbox label="Ins Papier-Fahrtenbuch übertragen" checked={d.transferred} onChange={(v) => set('transferred', v)} />
      )}

      <div className="row">
        {mode === 'start' && (
          <>
            <button className="btn primary" onClick={() => save(false)}>
              <Play size={16} /> Fahrt starten
            </button>
            <button className="btn ghost" onClick={() => setMode('edit')}>
              Komplett
            </button>
          </>
        )}
        {mode === 'end' && (
          <>
            <button className="btn primary" onClick={() => save(true)}>
              <Square size={16} /> Fahrt beenden
            </button>
            <button className="btn ghost" onClick={() => setMode('edit')}>
              Bearbeiten
            </button>
          </>
        )}
        {mode === 'edit' && (
          <button className="btn primary" onClick={() => save(false)}>
            Speichern
          </button>
        )}
        <span className="spacer" />
        {state.id && (
          <button className="btn danger icon" aria-label="Fahrt löschen" onClick={remove}>
            <Trash2 size={18} />
          </button>
        )}
      </div>
    </Sheet>
  );
}
