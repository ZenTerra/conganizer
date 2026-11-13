import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, ImagePlus, Trash2 } from 'lucide-react';
import { db } from '../../db/db';
import { useCon } from '../../db/hooks';
import { createCon, createRecord, deleteCon, deleteRecord, updateRecord } from '../../db/repo';
import { CON_STATUSES, type Con, type NewRecord } from '../../db/types';
import { isValidIso, todayIso } from '../../domain/dates';
import { resizeImage, type ResizedImage } from '../../domain/image';
import { STATUS_META, statusSideEffects } from '../../domain/status';
import { ConCover, useBlobUrl } from '../../ui/common';
import { Checkbox, DateField, MoneyField, TextArea, TextField } from '../../ui/fields';

type Draft = Omit<NewRecord<Con>, 'seriesId' | 'coverImageId'>;

const EMPTY: Draft = {
  name: '',
  startDate: '',
  endDate: '',
  status: 'interessant',
  feePaid: false,
};

function toDraft(con: Con): Draft {
  // Verwaltete Felder und Bild/Serie herausnehmen
  const { id: _id, updatedAt: _u, deleted: _d, seriesId: _s, coverImageId: _c, ...rest } = con;
  return rest;
}

export function ConFormPage() {
  const { id } = useParams();
  const isNew = !id;
  const con = useCon(id);
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [loaded, setLoaded] = useState(isNew);
  const [pendingCover, setPendingCover] = useState<ResizedImage | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const pendingUrl = useBlobUrl(pendingCover?.thumb);

  useEffect(() => {
    if (!isNew && con && !loaded) {
      setDraft(toDraft(con));
      setLoaded(true);
    }
  }, [con, isNew, loaded]);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const nameError = submitted && !draft.name.trim() ? 'Bitte einen Namen eingeben' : undefined;
  const startError = submitted && !isValidIso(draft.startDate) ? 'Bitte ein Startdatum wählen' : undefined;
  const endError =
    draft.endDate && draft.startDate && draft.endDate < draft.startDate ? 'Ende liegt vor dem Start' : undefined;

  async function pickCover(file: File | undefined) {
    if (!file) return;
    try {
      setPendingCover(await resizeImage(file));
      setRemoveCover(false);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function save() {
    setSubmitted(true);
    if (!draft.name.trim() || !isValidIso(draft.startDate) || endError) return;
    setBusy(true);
    try {
      const data: Draft = {
        ...draft,
        name: draft.name.trim(),
        endDate: isValidIso(draft.endDate) ? draft.endDate : draft.startDate,
      };
      let conId: string;
      let oldCover: string | undefined;
      if (isNew) {
        conId = (await createCon(data)).id;
      } else {
        conId = id!;
        oldCover = con?.coverImageId;
        await updateRecord(db.cons, conId, data);
      }

      if (pendingCover) {
        const img = await createRecord(db.images, {
          conId,
          kind: 'cover',
          blob: pendingCover.blob,
          thumb: pendingCover.thumb,
          width: pendingCover.width,
          height: pendingCover.height,
        });
        await updateRecord(db.cons, conId, { coverImageId: img.id });
        if (oldCover) await deleteRecord(db.images, oldCover);
      } else if (removeCover && oldCover) {
        await updateRecord(db.cons, conId, { coverImageId: undefined });
        await deleteRecord(db.images, oldCover);
      }
      navigate(`/con/${conId}`, { replace: true });
    } catch (e) {
      setError(`Speichern fehlgeschlagen: ${(e as Error).message}`);
      setBusy(false);
    }
  }

  async function remove() {
    if (!id || !con) return;
    if (!confirm(`„${con.name}“ wirklich löschen? Hotel, Fahrten, Kasse und Listen dieser Con werden ebenfalls gelöscht.`))
      return;
    await deleteCon(id);
    navigate('/', { replace: true });
  }

  if (!isNew && con === null) {
    return (
      <main className="page narrow">
        <p>Diese Con gibt es nicht (mehr).</p>
        <Link to="/">Zur Übersicht</Link>
      </main>
    );
  }
  if (!loaded) return null;

  const showExistingCover = !pendingCover && !removeCover && con?.coverImageId;

  return (
    <>
      <header className="topbar">
        <button className="btn ghost icon" aria-label="Zurück" onClick={() => navigate(-1)}>
          <ArrowLeft size={22} />
        </button>
        <h1>{isNew ? 'Neue Con' : 'Con bearbeiten'}</h1>
        <button className="btn primary small" onClick={save} disabled={busy}>
          Speichern
        </button>
      </header>

      <main className="page narrow">
        {error && <div className="status-banner warn">{error}</div>}

        <section className="card">
          <h2>Basisdaten</h2>
          <TextField
            label="Name der Con *"
            value={draft.name}
            onChange={(v) => set('name', v)}
            placeholder="z. B. DoKomi 2027"
            autoFocus={isNew}
            error={nameError}
          />
          <div className="form-grid">
            <DateField
              label="Erster Tag *"
              value={draft.startDate || undefined}
              error={startError}
              onChange={(v) =>
                setDraft((d) => ({
                  ...d,
                  startDate: v ?? '',
                  endDate: !d.endDate || (v && d.endDate < v) ? (v ?? '') : d.endDate,
                }))
              }
            />
            <DateField
              label="Letzter Tag"
              value={draft.endDate || undefined}
              min={draft.startDate || undefined}
              error={endError}
              onChange={(v) => set('endDate', v ?? '')}
            />
          </div>

          <div className="field">
            <span>Titelbild / Logo</span>
            {pendingUrl ? (
              <div className="cover-preview" style={{ backgroundImage: `url(${pendingUrl})` }} />
            ) : showExistingCover ? (
              <ConCover name={draft.name} imageId={con?.coverImageId} large className="cover-preview" />
            ) : null}
            <div className="row">
              <button type="button" className="btn small" onClick={() => fileInput.current?.click()}>
                <ImagePlus size={16} /> {pendingUrl || showExistingCover ? 'Bild ändern' : 'Bild wählen'}
              </button>
              {(pendingUrl || showExistingCover) && (
                <button
                  type="button"
                  className="btn ghost small"
                  onClick={() => {
                    setPendingCover(null);
                    setRemoveCover(true);
                  }}
                >
                  Entfernen
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void pickCover(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
        </section>

        <section className="card">
          <h2>Bewerbung</h2>
          <div className="segmented" role="group" aria-label="Status">
            {CON_STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={draft.status === s}
                style={{ '--seg-color': STATUS_META[s].color } as CSSProperties}
                onClick={() => setDraft((d) => ({ ...d, ...statusSideEffects(d, s, todayIso()) }))}
              >
                {STATUS_META[s].label}
              </button>
            ))}
          </div>
          <div className="form-grid">
            <DateField
              label="Bewerbung öffnet"
              value={draft.applicationOpens}
              onChange={(v) => set('applicationOpens', v)}
            />
            <DateField
              label="Bewerbungsschluss"
              value={draft.applicationCloses}
              onChange={(v) => set('applicationCloses', v)}
            />
            <DateField label="Beworben am" value={draft.appliedAt} onChange={(v) => set('appliedAt', v)} />
            <DateField label="Zusage am" value={draft.acceptedAt} onChange={(v) => set('acceptedAt', v)} />
            <MoneyField label="Standgebühr" value={draft.fee} onChange={(v) => set('fee', v)} />
            <DateField label="Zahlungsfrist" value={draft.feeDue} onChange={(v) => set('feeDue', v)} />
          </div>
          <Checkbox label="Standgebühr bezahlt" checked={draft.feePaid} onChange={(v) => set('feePaid', v)} />
        </section>

        <section className="card">
          <h2>Reise</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Für die Verpflegungspauschale. Leer lassen, wenn du am ersten Con-Tag los- und am letzten zurückfährst.
          </p>
          <div className="form-grid">
            <DateField
              label="Abfahrt von zu Hause"
              value={draft.departureDate}
              onChange={(v) => set('departureDate', v)}
            />
            <DateField label="Rückkehr" value={draft.returnDate} onChange={(v) => set('returnDate', v)} />
          </div>
        </section>

        <section className="card">
          <h2>Ort & Stand</h2>
          <TextField label="Veranstaltungsort" value={draft.venueName} onChange={(v) => set('venueName', v)} />
          <TextField
            label="Adresse"
            value={draft.venueAddress}
            onChange={(v) => set('venueAddress', v)}
            placeholder="Straße, PLZ Ort"
          />
          <div className="form-grid">
            <TextField label="Halle" value={draft.hall} onChange={(v) => set('hall', v)} />
            <TextField label="Standnummer" value={draft.booth} onChange={(v) => set('booth', v)} />
            <TextField
              label="Tischgröße"
              value={draft.tableSize}
              onChange={(v) => set('tableSize', v)}
              placeholder="z. B. 1,80 × 0,80 m"
            />
            <div className="field">
              <span>Strom</span>
              <Checkbox label="Stromanschluss" checked={!!draft.power} onChange={(v) => set('power', v)} />
            </div>
            <TextField
              label="Aufbauzeiten"
              value={draft.setupTimes}
              onChange={(v) => set('setupTimes', v)}
              placeholder="z. B. Fr 14–20 Uhr"
            />
            <TextField
              label="Abbauzeiten"
              value={draft.teardownTimes}
              onChange={(v) => set('teardownTimes', v)}
              placeholder="z. B. So ab 18 Uhr"
            />
          </div>
        </section>

        <section className="card">
          <h2>Kontakt & Notizen</h2>
          <TextField label="Ansprechpartner" value={draft.contactName} onChange={(v) => set('contactName', v)} />
          <TextArea
            label="Links & E-Mail"
            hint="Eine Zeile pro Link (Website, Discord, E-Mail)"
            value={draft.contactLinks}
            onChange={(v) => set('contactLinks', v)}
            rows={3}
          />
          <TextArea label="Notizen" value={draft.notes} onChange={(v) => set('notes', v)} rows={4} />
        </section>

        <button className="btn primary block" onClick={save} disabled={busy}>
          Speichern
        </button>
        {!isNew && (
          <button className="btn danger block" onClick={remove}>
            <Trash2 size={18} /> Con löschen
          </button>
        )}
      </main>
    </>
  );
}
