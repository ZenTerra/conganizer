import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, ShieldAlert } from 'lucide-react';
import { requestPersistentStorage } from '../../db/db';
import { useSettings } from '../../db/hooks';
import { setSetting } from '../../db/repo';
import type { AppSettings } from '../../db/types';
import { MoneyField, TextField } from '../../ui/fields';
import { Toast } from '../../ui/common';
import { ChecklistTemplateEditor, PackTemplateEditor } from './TemplateEditor';

type Editable = Pick<AppSettings, 'homeAddress' | 'kmRate' | 'mealRatePartial' | 'mealRateFull'>;

export function SettingsPage() {
  const settings = useSettings();
  const navigate = useNavigate();
  const [draft, setDraft] = useState<Editable | null>(null);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (settings && !draft) {
      const { homeAddress, kmRate, mealRatePartial, mealRateFull } = settings;
      setDraft({ homeAddress, kmRate, mealRatePartial, mealRateFull });
    }
  }, [settings, draft]);

  useEffect(() => {
    void (async () => {
      setPersisted(await requestPersistentStorage());
      const est = await navigator.storage?.estimate?.();
      if (est?.usage !== undefined) setUsage(`${(est.usage / 1024 / 1024).toFixed(1)} MB belegt`);
    })();
  }, []);

  if (!draft) return null;
  const set = <K extends keyof Editable>(k: K, v: Editable[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d));

  async function save() {
    if (!draft) return;
    await setSetting('homeAddress', draft.homeAddress.trim());
    await setSetting('kmRate', draft.kmRate);
    await setSetting('mealRatePartial', draft.mealRatePartial);
    await setSetting('mealRateFull', draft.mealRateFull);
    setToast('Einstellungen gespeichert');
  }

  return (
    <>
      <header className="topbar">
        <button className="btn ghost icon" aria-label="Zurück" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1>Einstellungen</h1>
      </header>
      <main className="page narrow">
        <section className="card">
          <h2>Fahrten</h2>
          <TextField
            label="Heimatadresse"
            hint="Startpunkt für Hin- und Rückfahrten im Fahrtenbuch"
            value={draft.homeAddress}
            onChange={(v) => set('homeAddress', v)}
            placeholder="Straße, PLZ Ort"
          />
          <MoneyField
            label="Kilometerpauschale pro km"
            value={draft.kmRate}
            onChange={(v) => set('kmRate', v ?? 0)}
          />
        </section>

        <section className="card">
          <h2>Verpflegungspauschale</h2>
          <div className="form-grid collapse">
            <MoneyField
              label="An-/Abreisetag, eintägig > 8 h"
              value={draft.mealRatePartial}
              onChange={(v) => set('mealRatePartial', v ?? 0)}
            />
            <MoneyField
              label="Voller Tag (24 h)"
              value={draft.mealRateFull}
              onChange={(v) => set('mealRateFull', v ?? 0)}
            />
          </div>
        </section>

        <button className="btn primary block" onClick={save}>
          Speichern
        </button>

        {settings && (
          <>
            <PackTemplateEditor initial={settings.packTemplate} onSaved={() => setToast('Packlisten-Vorlage gespeichert')} />
            <ChecklistTemplateEditor
              initial={settings.checklistTemplate}
              onSaved={() => setToast('Checklisten-Vorlage gespeichert')}
            />
          </>
        )}

        <section className="card">
          <h2>Daten</h2>
          <div className="row">
            {persisted ? (
              <ShieldCheck size={20} className="success-text" />
            ) : (
              <ShieldAlert size={20} className="warn-text" />
            )}
            <span className="small">
              {persisted
                ? 'Dauerhafter Speicher aktiv – der Browser löscht die Daten nicht automatisch.'
                : 'Dauerhafter Speicher nicht bestätigt. Auf dem iPhone die App über „Zum Home-Bildschirm“ installieren.'}
            </span>
          </div>
          {usage && <span className="muted small">{usage}</span>}
          <p className="muted small" style={{ margin: 0 }}>
            Alle Daten liegen nur auf diesem Gerät. Backup &amp; Abgleich zwischen Geräten folgen mit Meilenstein 4.
          </p>
        </section>

        <p className="faint small" style={{ textAlign: 'center' }}>
          ConGanizer {__APP_VERSION__}
        </p>
      </main>
      <Toast message={toast} onDone={() => setToast(null)} />
    </>
  );
}
