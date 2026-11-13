import { useEffect, useState, type CSSProperties, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { X } from 'lucide-react';
import { db } from '../db/db';
import type { ConStatus } from '../db/types';
import { STATUS_META } from '../domain/status';
import { initials, tileColor } from '../domain/text';

export function StatusBadge({ status }: { status: ConStatus }) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`badge ${status === 'abgesagt' ? 'struck' : ''}`}
      style={{ '--badge-color': meta.color } as CSSProperties}
    >
      {status === 'abgelehnt' ? <X size={12} strokeWidth={3} /> : <span className="dot" />}
      {meta.label}
    </span>
  );
}

/** Object-URL für einen Blob, wird automatisch wieder freigegeben. */
export function useBlobUrl(blob: Blob | undefined | null): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob || blob.size === 0) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(blob);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [blob]);
  return url;
}

/** Titelbild einer Con (Thumbnail oder großes Bild), sonst farbige Initialen. */
export function ConCover({
  name,
  imageId,
  large,
  className,
}: {
  name: string;
  imageId?: string;
  large?: boolean;
  className: string;
}) {
  const image = useLiveQuery(async () => (imageId ? await db.images.get(imageId) : undefined), [imageId]);
  const url = useBlobUrl(image && !image.deleted ? (large ? image.blob : image.thumb) : undefined);
  return (
    <div
      className={className}
      style={url ? { backgroundImage: `url(${url})` } : { background: tileColor(name || '?') }}
      aria-hidden
    >
      {!url && initials(name || '?')}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      {icon}
      <strong>{title}</strong>
      {children}
    </div>
  );
}

export function Toast({ message, onDone }: { message: string | null; onDone: () => void }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, 2200);
    return () => clearTimeout(t);
  }, [message, onDone]);
  return message ? (
    <div className="toast" role="status">
      {message}
    </div>
  ) : null;
}

/** Dialog: auf dem Handy als Bottom-Sheet, am Desktop zentriert. */
export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>{title}</h2>
          <button className="btn ghost icon small" aria-label="Schließen" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function ProgressBar({ done, total, label }: { done: number; total: number; label?: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="stack" style={{ gap: 4 }}>
      <div className="row small muted">
        <span>{label}</span>
        <span className="spacer" />
        <span>
          {done} / {total}
        </span>
      </div>
      <div className={`progress ${total > 0 && done === total ? 'done' : ''}`} role="progressbar" aria-valuenow={pct}>
        <div style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** Kleines Eingabefeld + Button zum Hinzufügen eines Listenpunkts. */
export function InlineAdd({ placeholder, onAdd }: { placeholder: string; onAdd: (text: string) => void }) {
  const [text, setText] = useState('');
  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onAdd(t);
    setText('');
  };
  return (
    <form
      className="inline-add"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <input value={text} placeholder={placeholder} onChange={(e) => setText(e.target.value)} />
      <button type="submit" className="btn small" disabled={!text.trim()}>
        Hinzufügen
      </button>
    </form>
  );
}
