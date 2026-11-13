import { useCallback, useState } from 'react';
import { Copy, FileDown, FileSpreadsheet, Plus, Trash2 } from 'lucide-react';
import { db } from '../../../db/db';
import { useAllTrips, useConRecords, useSettings } from '../../../db/hooks';
import { createRecord, deleteRecord } from '../../../db/repo';
import type { Cents } from '../../../db/types';
import { ALLOWANCE_LABEL, mealAllowance } from '../../../domain/allowance';
import { formatDate } from '../../../domain/dates';
import { centsToInput, formatEuro } from '../../../domain/money';
import { conProfit } from '../../../domain/profit';
import { safeName, shareFile, textFile } from '../../../domain/share';
import { tripsToCsv, tripsToPdf } from '../../../domain/tripExport';
import { formatKm } from '../../../domain/trips';
import { Toast } from '../../../ui/common';
import { MoneyField } from '../../../ui/fields';
import { useConContext } from '../ConLayout';
import { ItemList } from './ChecklistTab';

function CopyRow({
  label,
  hint,
  value,
  onCopy,
}: {
  label: string;
  hint?: string;
  value: Cents;
  onCopy: (text: string, label: string) => void;
}) {
  return (
    <div className="copy-row">
      <div className="label">
        {label}
        {hint && <small>{hint}</small>}
      </div>
      <span className="value">{formatEuro(value)}</span>
      <button className="btn ghost icon small" aria-label={`${label} kopieren`} onClick={() => onCopy(centsToInput(value), label)}>
        <Copy size={16} />
      </button>
    </div>
  );
}

function ProfitLine({ label, value, strong, minus }: { label: string; value: Cents; strong?: boolean; minus?: boolean }) {
  return (
    <div className={`report-row ${strong ? 'total' : ''}`}>
      <span>
        <span className="op">{minus ? '−' : ''}</span>
        {label}
      </span>
      <span>{formatEuro(value)}</span>
    </div>
  );
}

export function SettlementTab() {
  const { con } = useConContext();
  const settings = useSettings();
  const hotels = useConRecords(db.hotels, con.id);
  const cashDays = useConRecords(db.cashDays, con.id);
  const expenses = useConRecords(db.expenses, con.id);
  const checklist = useConRecords(db.checklistItems, con.id);
  const packItems = useConRecords(db.packItems, con.id);
  const allTrips = useAllTrips();
  const [toast, setToast] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [amount, setAmount] = useState<Cents | undefined>();
  const [amountKey, setAmountKey] = useState(0);
  const [exporting, setExporting] = useState(false);
  const clearToast = useCallback(() => setToast(null), []);

  if (!settings || !hotels || !cashDays || !expenses || !checklist || !packItems || !allTrips) return null;

  const trips = allTrips.filter((t) => t.conId === con.id);
  const allowance = mealAllowance(con, settings);
  const profit = conProfit({ con, cashDays, hotels, trips, expenses, kmRate: settings.kmRate });
  const bookedHotels = hotels.filter((h) => h.booked);
  const after = checklist.filter((i) => i.section === 'nach').sort((a, b) => a.order - b.order);

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setToast(`${what}: ${text} kopiert`);
    } catch {
      setToast('Kopieren nicht möglich');
    }
  };

  const allowanceHint = [
    allowance.partialDays && `${allowance.partialDays}× ${formatEuro(settings.mealRatePartial)}`,
    allowance.fullDays && `${allowance.fullDays}× ${formatEuro(settings.mealRateFull)}`,
  ]
    .filter(Boolean)
    .join(' + ');

  async function exportTrips(kind: 'pdf' | 'csv') {
    setExporting(true);
    try {
      const base = `Fahrtenbuch_${safeName(con.name)}`;
      const file =
        kind === 'csv'
          ? textFile(tripsToCsv(trips), `${base}.csv`, 'text/csv')
          : new File([await tripsToPdf(trips, con.name, settings!.kmRate)], `${base}.pdf`, { type: 'application/pdf' });
      await shareFile(file, { title: base });
    } catch (e) {
      setToast(`Export fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setExporting(false);
    }
  }

  async function addExpense() {
    if (!label.trim() || !amount) return;
    await createRecord(db.expenses, { conId: con.id, label: label.trim(), amount });
    setLabel('');
    setAmount(undefined);
    setAmountKey((k) => k + 1);
  }

  return (
    <>
      <section className="card">
        <h2>Für Accountable</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Werte zum Abtippen – Tippen auf <Copy size={12} style={{ verticalAlign: -1 }} /> kopiert den Betrag.
        </p>
        <div>
          <CopyRow
            label="Verpflegungspauschale"
            hint={`${allowanceHint || '–'} · Datum: ${formatDate(allowance.lastDay)} (letzter Reisetag)`}
            value={allowance.total}
            onCopy={copy}
          />
          <CopyRow
            label="Fahrtkosten (km-Pauschale)"
            hint={`${formatKm(profit.km)} geschäftlich × ${formatEuro(settings.kmRate)}`}
            value={profit.kmCost}
            onCopy={copy}
          />
          {bookedHotels.length > 0 && (
            <CopyRow
              label="Hotelkosten"
              hint={bookedHotels.map((h) => h.name || 'Hotel').join(', ')}
              value={profit.hotels}
              onCopy={copy}
            />
          )}
          {con.fee !== undefined && (
            <CopyRow label="Standgebühr" hint={con.feePaid ? 'bezahlt' : 'noch nicht bezahlt'} value={con.fee} onCopy={copy} />
          )}
          <CopyRow label="Einnahmen bar (Tageslosungen)" value={profit.revenueCash} onCopy={copy} />
          <CopyRow label="Einnahmen Karte (SumUp)" value={profit.revenueCard} onCopy={copy} />
        </div>

        <details>
          <summary className="muted small" style={{ cursor: 'pointer' }}>
            Pauschale je Tag
          </summary>
          <ul className="list-plain small" style={{ marginTop: 6 }}>
            {allowance.days.map((d) => (
              <li key={d.date} className="row">
                <span>{formatDate(d.date)}</span>
                <span className="muted">{ALLOWANCE_LABEL[d.type]}</span>
                <span className="spacer" />
                <span>{formatEuro(d.amount)}</span>
              </li>
            ))}
          </ul>
        </details>

        <div className="row">
          <button className="btn small" disabled={exporting || trips.length === 0} onClick={() => exportTrips('pdf')}>
            <FileDown size={16} /> Fahrtenbuch PDF
          </button>
          <button className="btn small" disabled={exporting || trips.length === 0} onClick={() => exportTrips('csv')}>
            <FileSpreadsheet size={16} /> CSV
          </button>
        </div>
        <p className="faint small" style={{ margin: 0 }}>
          Hilfe zum Abtippen, keine Steuerberatung. Sätze in den Einstellungen änderbar.
        </p>
      </section>

      {after.length > 0 && (
        <section className="card">
          <h2>Eingepflegt?</h2>
          <ItemList items={after} ctx={{ con, hotels, packItems }} editing={false} />
        </section>
      )}

      <section className="card">
        <h2>Gewinn dieser Con</h2>
        <div className="report">
          <ProfitLine label="Einnahmen bar" value={profit.revenueCash} />
          <ProfitLine label="Einnahmen Karte (SumUp)" value={profit.revenueCard} />
          <ProfitLine label="Umsatz" value={profit.revenue} strong />
          {profit.fee > 0 && <ProfitLine label="Standgebühr" value={profit.fee} minus />}
          {profit.hotels > 0 && <ProfitLine label="Hotel" value={profit.hotels} minus />}
          {profit.kmCost > 0 && <ProfitLine label={`Fahrt (${formatKm(profit.km)})`} value={profit.kmCost} minus />}
          {profit.cashBusiness > 0 && <ProfitLine label="Ausgaben aus der Kasse" value={profit.cashBusiness} minus />}
          {profit.other > 0 && <ProfitLine label="Sonstige Ausgaben" value={profit.other} minus />}
          <div className="report-row result">
            <span>Gewinn</span>
            <span style={{ color: profit.profit < 0 ? 'var(--danger)' : undefined }}>{formatEuro(profit.profit)}</span>
          </div>
        </div>
        {profit.privat > 0 && (
          <p className="muted small" style={{ margin: 0 }}>
            Verpflegung/Privat aus der Kasse: {formatEuro(profit.privat)} (zählt nicht als Kosten)
          </p>
        )}
        {profit.incompleteDays > 0 && (
          <p className="warn-text small" style={{ margin: 0 }}>
            {profit.incompleteDays} Kassentag(e) ohne Start- oder Endbestand – Bar-Einnahmen noch unvollständig.
          </p>
        )}
      </section>

      <section className="card">
        <h2>Sonstige Ausgaben</h2>
        <p className="muted small" style={{ margin: 0 }}>
          Kosten, die nicht aus der Kasse bezahlt wurden – z. B. Parken mit Karte, Material, Badge-Gebühr.
        </p>
        {expenses.length > 0 && (
          <div>
            {expenses.map((e) => (
              <div key={e.id} className="movement">
                <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{e.label}</span>
                <span className="amount">{formatEuro(e.amount)}</span>
                <button className="btn ghost icon small" aria-label={`${e.label} löschen`} onClick={() => deleteRecord(db.expenses, e.id)}>
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="form-grid">
          <label className="field">
            <span>Bezeichnung</span>
            <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="z. B. Parkhaus" />
          </label>
          <MoneyField key={amountKey} label="Betrag" value={amount} onChange={setAmount} />
        </div>
        <button className="btn small" disabled={!label.trim() || !amount} onClick={addExpense}>
          <Plus size={16} /> Ausgabe hinzufügen
        </button>
      </section>

      <Toast message={toast} onDone={clearToast} />
    </>
  );
}
