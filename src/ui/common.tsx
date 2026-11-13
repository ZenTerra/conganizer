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
