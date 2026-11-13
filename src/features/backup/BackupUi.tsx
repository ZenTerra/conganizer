import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DatabaseBackup, History, Upload, X } from 'lucide-react';
import { exportBackupJson, importBackup, restoreSnapshot, type ImportResult } from '../../db/backup';
import { db } from '../../db/db';
import { useSettings } from '../../db/hooks';
import { alive, setSetting } from '../../db/repo';
import { backupReminder } from '../../domain/reminder';
import { shareFile, textFile, type ShareResult } from '../../domain/share';

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
};

/** Erstellt die Sicherungsdatei und gibt sie weiter (iPhone: „In Dateien sichern“). */
export async function runBackupExport(): Promise<ShareResult> {
  const json = await exportBackupJson();
  const result = await shareFile(textFile(json, `ConGanizer-Backup_${stamp()}.json`, 'application/json'), {
    title: 'ConGanizer-Backup',
  });
  if (result !== 'cancelled') await setSetting('lastBackupAt', Date.now());
  return result;
}

const formatDateTime = (ms: number) =>
  new Date(ms).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });

function readFile(file: File): Promise<string> {
  return file.text();
}

/** Banner auf der Übersicht, wenn ein Backup fällig ist. */
export function BackupBanner() {
  const settings = useSettings();
  const data = useLiveQuery(async () => ({
    cons: alive(await db.cons.toArray()),
    checklist: await db.checklistItems.toArray(),
  }));
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem('backupBannerDismissed') === '1';
    } catch {
      return false;
    }
  });
  const [busy, setBusy] = useState(false);

  if (!settings || !data || dismissed) return null;
  const reminder = backupReminder(settings.lastBackupAt, Date.now(), data.cons, data.checklist);
  if (!reminder) return null;

  const text =
    reminder.reason === 'never'
      ? 'Noch kein Backup – deine Daten liegen nur auf diesem Gerät.'
      : reminder.reason === 'stale'
        ? `Letztes Backup vor ${reminder.days} Tagen.`
        : `„${reminder.conName}“ ist abgeschlossen – guter Zeitpunkt für ein Backup.`;

  return (
    <div className="status-banner warn">
      <DatabaseBackup size={20} />
      <span style={{ flex: 1, minWidth: 0 }}>{text}</span>
      <button
        className="btn primary small"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            await runBackupExport();
          } finally {
            setBusy(false);
          }
        }}
      >
        Sichern
      </button>
      <button
        className="btn ghost icon small"
        aria-label="Später"
        onClick={() => {
          setDismissed(true);
          try {
            sessionStorage.setItem('backupBannerDismissed', '1');
          } catch {
            /* egal */
          }
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

/** Abschnitt „Backup & Abgleich“ in den Einstellungen. */
export function BackupSection({ onToast }: { onToast: (msg: string) => void }) {
  const settings = useSettings();
  const snapshots = useLiveQuery(() => db.snapshots.orderBy('createdAt').reverse().toArray(), []);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function doExport() {
    setBusy(true);
    setError(null);
    try {
      const r = await runBackupExport();
      if (r !== 'cancelled') onToast('Backup erstellt');
    } catch (e) {
      setError(`Backup fehlgeschlagen: ${(e as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  async function doImport(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    if (!confirm(`„${file.name}“ mit den Daten auf diesem Gerät zusammenführen?\n\nPro Eintrag gewinnt die neuere Version. Vorher wird automatisch ein Sicherungsstand angelegt.`))
      return;
    setBusy(true);
    try {
      setResult(await importBackup(await readFile(file)));
      onToast('Abgleich abgeschlossen');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function doRestore(id: string, createdAt: number) {
    if (!confirm(`Alle Daten auf den Stand vom ${formatDateTime(createdAt)} zurücksetzen?\n\nÄnderungen seitdem gehen auf diesem Gerät verloren.`)) return;
    setBusy(true);
    try {
      await restoreSnapshot(id);
      onToast('Sicherungsstand wiederhergestellt');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card">
      <h2>Backup & Abgleich</h2>
      <p className="muted small" style={{ margin: 0 }}>
        Alle Daten liegen nur auf diesem Gerät. Ein Backup ist eine Datei, die du z. B. in iCloud Drive sicherst. Dieselbe Datei
        importierst du auf dem anderen Gerät – die Daten werden zusammengeführt, nicht überschrieben.
      </p>
      <div className="row small">
        <span className="muted">Letztes Backup:</span>
        <strong>{settings?.lastBackupAt ? formatDateTime(settings.lastBackupAt) : 'noch nie'}</strong>
      </div>
      <div className="row">
        <button className="btn primary" onClick={doExport} disabled={busy}>
          <DatabaseBackup size={18} /> Backup erstellen
        </button>
        <button className="btn" onClick={() => input.current?.click()} disabled={busy}>
          <Upload size={18} /> Backup importieren
        </button>
        <input
          ref={input}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            void doImport(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>

      {error && <div className="status-banner warn">{error}</div>}
      {result && (
        <div className="status-banner">
          <span>
            Abgleich mit Backup vom {formatDateTime(result.exportedAt)}: <strong>{result.stats.added}</strong> neu,{' '}
            <strong>{result.stats.updated}</strong> aktualisiert, <strong>{result.stats.deleted}</strong> gelöscht,{' '}
            {result.stats.unchanged} unverändert.
          </span>
        </div>
      )}

      {snapshots && snapshots.length > 0 && (
        <details>
          <summary className="muted small" style={{ cursor: 'pointer' }}>
            <History size={14} style={{ verticalAlign: -2 }} /> Sicherungsstände vor Importen ({snapshots.length})
          </summary>
          <ul className="list-plain" style={{ marginTop: 8 }}>
            {snapshots.map((s) => (
              <li key={s.id} className="row small">
                <span style={{ flex: 1 }}>{formatDateTime(s.createdAt)}</span>
                <button className="btn ghost small" disabled={busy} onClick={() => doRestore(s.id, s.createdAt)}>
                  Wiederherstellen
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}
