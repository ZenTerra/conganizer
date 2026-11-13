import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChevronRight, CheckCircle2, Coins, Trash2 } from 'lucide-react';
import { db } from '../../../db/db';
import { useConRecords } from '../../../db/hooks';
import { alive, ensureCashDays, newId, updateRecord } from '../../../db/repo';
import type { CashDay, CashMovementType, Cents, DenominationCount, NewRecord } from '../../../db/types';
import {
  carryOverStart,
  cashReport,
  countTotal,
  denominationLabel,
  DENOMINATIONS,
  MOVEMENT_META,
  MOVEMENT_TYPES,
  nextReportNo,
  type CashReport,
} from '../../../domain/cash';
import { conDays, formatDate, formatWeekdayDate, todayIso } from '../../../domain/dates';
import { formatEuro } from '../../../domain/money';
import { Checkbox, MoneyField } from '../../../ui/fields';
import { useConContext } from '../ConLayout';

type DayChanges = Partial<NewRecord<CashDay>>;

const hasData = (d: CashDay) => d.start !== undefined || d.end !== undefined || d.card !== undefined || d.movements.length > 0;

function CountHelper({
  count,
  onApply,
  onClose,
}: {
  count: DenominationCount | undefined;
  onApply: (count: DenominationCount, total: Cents) => void;
  onClose: () => void;
}) {
  const [c, setC] = useState<DenominationCount>(count ?? {});
  const total = countTotal(c);
  return (
    <div className="stack" style={{ background: 'var(--surface-sunken)', padding: 12, borderRadius: 'var(--radius)' }}>
      <div className="count-grid">
        {DENOMINATIONS.map((d) => (
          <label key={d}>
            {denominationLabel(d)}
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={c[String(d)] ?? ''}
              onChange={(e) => setC({ ...c, [String(d)]: e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)) })}
            />
          </label>
        ))}
      </div>
      <div className="row">
        <span>
          Summe: <strong>{formatEuro(total)}</strong>
        </span>
        <span className="spacer" />
        <button className="btn ghost small" onClick={onClose}>
          Abbrechen
        </button>
        <button className="btn primary small" onClick={() => onApply(c, total)}>
          Übernehmen
        </button>
      </div>
    </div>
  );
}

function ReportView({ r }: { r: CashReport }) {
  const Row = ({ label, value, cls, op }: { label: string; value: Cents; cls?: string; op?: string }) => (
    <div className={`report-row ${cls ?? ''}`}>
      <span>
        <span className="op">{op}</span>
        {label}
      </span>
      <span>{formatEuro(value)}</span>
    </div>
  );
  return (
    <div className="report" aria-label="Kassenbericht">
      <Row label="Kassenbestand bei Geschäftsschluss" value={r.endbestand} />
      <Row label="Ausgaben im Laufe des Tages" value={r.ausgaben} op="+" />
      {r.wareneinkauf > 0 && <Row label="Wareneinkäufe/-nebenkosten" value={r.wareneinkauf} cls="sub" />}
      {r.geschaeft > 0 && <Row label="Geschäftsausgaben" value={r.geschaeft} cls="sub" />}
      {r.privat > 0 && <Row label="Privatentnahmen" value={r.privat} cls="sub" />}
      {r.sonstig > 0 && <Row label="Sonstige Ausgaben" value={r.sonstig} cls="sub" />}
      <Row label="Summe" value={r.summe} cls="total" />
      <Row label="abzüglich Kassenbestand des Vortages" value={r.vortag} op="−" />
      <Row label="Kasseneingang" value={r.kasseneingang} cls="total" />
      <Row label="abzüglich sonstige Einnahmen" value={r.einlagen} op="−" />
      <Row label="Einnahmen (Tageslosung)" value={r.tageslosung} cls="result" />
    </div>
  );
}

function MovementForm({ onAdd }: { onAdd: (type: CashMovementType, amount: Cents, note: string) => void }) {
  const [type, setType] = useState<CashMovementType>('privat');
  const [amount, setAmount] = useState<Cents | undefined>();
  const [note, setNote] = useState('');
  const [key, setKey] = useState(0); // setzt das Betragsfeld nach dem Hinzufügen zurück
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="segmented">
        {MOVEMENT_TYPES.map((t) => (
          <button
            key={t}
            type="button"
            aria-pressed={type === t}
            style={{ '--seg-color': MOVEMENT_META[t].direction === 'in' ? 'var(--success)' : 'var(--accent-bright)' } as CSSProperties}
            onClick={() => setType(t)}
          >
            {MOVEMENT_META[t].label}
          </button>
        ))}
      </div>
      <div className="form-grid">
        <MoneyField key={key} label="Betrag" value={amount} onChange={setAmount} />
        <label className="field">
          <span>Notiz</span>
          <input value={note} placeholder={MOVEMENT_META[type].hint} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
      <button
        className="btn small"
        disabled={!amount}
        onClick={() => {
          if (!amount) return;
          onAdd(type, amount, note.trim());
          setAmount(undefined);
          setNote('');
          setKey((k) => k + 1);
        }}
      >
        Buchung hinzufügen
      </button>
    </div>
  );
}

function CashDayCard({
  day,
  index,
  open,
  onChange,
}: {
  day: CashDay;
  index: number;
  open: boolean;
  onChange: (changes: DayChanges) => void;
}) {
  const [counting, setCounting] = useState<'start' | 'end' | null>(null);
  // Nur beim ersten Rendern aufklappen – danach steuert der Nutzer
  const [isOpen, setIsOpen] = useState(open);
  const r = cashReport(day);

  return (
    <details className="card day" open={isOpen} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
      <summary>
        <ChevronRight size={18} className="chev" />
        <span style={{ flex: 1 }}>
          Tag {index + 1} · {formatWeekdayDate(day.date)}
        </span>
        {day.transferred ? (
          <CheckCircle2 size={18} className="success-text" aria-label="übertragen" />
        ) : r.complete ? (
          <span className="small" style={{ color: 'var(--accent-bright)' }}>
            {formatEuro(r.tageslosung + (day.card ?? 0))}
          </span>
        ) : null}
      </summary>

      <div className="stack">
        <div className="row small">
          <span className="muted">Kassenbericht Nr.</span>
          <input
            className="input-sm"
            type="number"
            inputMode="numeric"
            value={day.reportNo ?? ''}
            placeholder="–"
            onChange={(e) => onChange({ reportNo: e.target.value === '' ? undefined : Number(e.target.value) })}
          />
          <span className="spacer" />
          <span className="faint">{formatDate(day.date)}</span>
        </div>

        <div className="form-grid collapse">
          <div className="stack" style={{ gap: 4 }}>
            <MoneyField
              label={index === 0 ? 'Startbestand (Wechselgeld)' : 'Kassenbestand des Vortages'}
              value={day.start}
              onChange={(v) => onChange({ start: v })}
            />
            <button className="btn ghost small" onClick={() => setCounting(counting === 'start' ? null : 'start')}>
              <Coins size={14} /> Zählhilfe
            </button>
          </div>
          <div className="stack" style={{ gap: 4 }}>
            <MoneyField label="Kassenbestand bei Geschäftsschluss" value={day.end} onChange={(v) => onChange({ end: v })} />
            <button className="btn ghost small" onClick={() => setCounting(counting === 'end' ? null : 'end')}>
              <Coins size={14} /> Zählhilfe
            </button>
          </div>
        </div>

        {counting && (
          <CountHelper
            count={counting === 'start' ? day.startCount : day.endCount}
            onClose={() => setCounting(null)}
            onApply={(count, total) => {
              onChange(counting === 'start' ? { startCount: count, start: total } : { endCount: count, end: total });
              setCounting(null);
            }}
          />
        )}

        <MoneyField
          label="SumUp-Kartenumsatz"
          hint="Laut SumUp-Tagesbericht – nicht Teil des Kassenberichts"
          value={day.card}
          onChange={(v) => onChange({ card: v })}
        />

        <h3 className="section-title">Buchungen während des Tages</h3>
        {day.movements.length > 0 && (
          <div>
            {day.movements.map((m) => (
              <div key={m.id} className="movement">
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span className="small muted">{MOVEMENT_META[m.type].label}</span>
                  {m.note && <div style={{ overflowWrap: 'anywhere' }}>{m.note}</div>}
                </span>
                <span className={`amount ${MOVEMENT_META[m.type].direction === 'in' ? 'success-text' : ''}`}>
                  {MOVEMENT_META[m.type].direction === 'in' ? '+' : '−'}
                  {formatEuro(m.amount)}
                </span>
                <button
                  className="btn ghost icon small"
                  aria-label="Buchung löschen"
                  onClick={() => onChange({ movements: day.movements.filter((x) => x.id !== m.id) })}
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <MovementForm
          onAdd={(type, amount, note) => onChange({ movements: [...day.movements, { id: newId(), type, amount, note }] })}
        />

        <h3 className="section-title">Kassenbericht</h3>
        {!r.complete && <p className="muted small" style={{ margin: 0 }}>Start- und Endbestand eintragen, dann stimmt die Tageslosung.</p>}
        <ReportView r={r} />
        <div className="row small">
          <span className="muted">Tagesumsatz bar + Karte</span>
          <span className="spacer" />
          <strong>{formatEuro(r.tageslosung + (day.card ?? 0))}</strong>
        </div>
        <Checkbox label="In den Kassenbericht (Papier) übertragen" checked={day.transferred} onChange={(v) => onChange({ transferred: v })} />
      </div>
    </details>
  );
}

export function CashTab() {
  const { con } = useConContext();
  const days = useConRecords(db.cashDays, con.id);
  const allDays = useLiveQuery(async () => alive(await db.cashDays.toArray()), []);

  useEffect(() => {
    void ensureCashDays(con);
  }, [con]);

  const visible = useMemo(() => {
    const range = new Set(conDays(con.startDate, con.endDate));
    return (days ?? []).filter((d) => range.has(d.date) || hasData(d)).sort((a, b) => a.date.localeCompare(b.date));
  }, [days, con.startDate, con.endDate]);

  if (!days || !allDays) return null;

  const today = todayIso();
  const openIndex = Math.max(
    0,
    visible.findIndex((d) => d.date === today) >= 0
      ? visible.findIndex((d) => d.date === today)
      : visible.findIndex((d) => !cashReport(d).complete),
  );

  async function change(day: CashDay, changes: DayChanges) {
    const touchesValues = 'start' in changes || 'end' in changes || 'movements' in changes || 'card' in changes;
    const extra: DayChanges = {};
    if (touchesValues && day.reportNo === undefined && !('reportNo' in changes)) {
      extra.reportNo = nextReportNo(allDays ?? []);
    }
    await updateRecord(db.cashDays, day.id, { ...changes, ...extra });

    // Endbestand auf den Folgetag übertragen
    if ('end' in changes) {
      const idx = visible.findIndex((d) => d.id === day.id);
      const next = visible[idx + 1];
      if (next) {
        const newStart = carryOverStart(next.start, day.end, changes.end);
        if (newStart !== next.start) await updateRecord(db.cashDays, next.id, { start: newStart });
      }
    }
  }

  const reports = visible.map(cashReport);
  const sum = (f: (r: CashReport) => Cents) => reports.reduce((s, r) => s + f(r), 0);
  const card = visible.reduce((s, d) => s + (d.card ?? 0), 0);
  // Tageslosung nur von vollständigen Tagen (sonst zählt ein übertragener Startbestand negativ)
  const bar = reports.filter((r) => r.complete).reduce((s, r) => s + r.tageslosung, 0);
  const incomplete = reports.filter((r) => !r.complete && (r.vortag || r.endbestand)).length;

  return (
    <>
      <section className="card">
        <div className="stats">
          <div className="stat">
            <span className="label">Bar (Tageslosungen)</span>
            <span className="value">{formatEuro(bar)}</span>
            {incomplete > 0 && (
              <span className="faint small">
                {incomplete} {incomplete === 1 ? 'Tag' : 'Tage'} noch offen
              </span>
            )}
          </div>
          <div className="stat">
            <span className="label">SumUp (Karte)</span>
            <span className="value">{formatEuro(card)}</span>
          </div>
          <div className="stat">
            <span className="label">Umsatz gesamt</span>
            <span className="value" style={{ color: 'var(--accent-bright)' }}>
              {formatEuro(bar + card)}
            </span>
          </div>
          <div className="stat">
            <span className="label">Privatentnahmen</span>
            <span className="value">{formatEuro(sum((r) => r.privat))}</span>
          </div>
          <div className="stat">
            <span className="label">Geschäftl. Ausgaben bar</span>
            <span className="value">{formatEuro(sum((r) => r.wareneinkauf + r.geschaeft + r.sonstig))}</span>
          </div>
        </div>
      </section>

      {visible.map((d, i) => (
        <CashDayCard key={d.id} day={d} index={i} open={i === openIndex} onChange={(c) => change(d, c)} />
      ))}
    </>
  );
}
