import { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ImagePlus, Images, Trash2, X } from 'lucide-react';
import { db } from '../../../db/db';
import { useConRecords } from '../../../db/hooks';
import { createRecord, deleteRecord, updateRecord } from '../../../db/repo';
import type { ConImage } from '../../../db/types';
import { resizeImage } from '../../../domain/image';
import { EmptyState, useBlobUrl } from '../../../ui/common';
import { useConContext } from '../ConLayout';

function Thumb({ image, onOpen }: { image: ConImage; onOpen: () => void }) {
  const url = useBlobUrl(image.thumb);
  return (
    <button className="thumb" onClick={onOpen} aria-label={image.caption || 'Bild öffnen'}>
      {url && <img src={url} alt={image.caption ?? ''} loading="lazy" />}
      {image.caption && <span className="thumb-caption">{image.caption}</span>}
    </button>
  );
}

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: ConImage[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
}) {
  const image = images[index];
  const url = useBlobUrl(image?.blob);
  const [caption, setCaption] = useState(image?.caption ?? '');
  const touchX = useRef<number | null>(null);

  useEffect(() => setCaption(image?.caption ?? ''), [image?.id, image?.caption]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      if (e.key === 'ArrowRight' && index < images.length - 1) onIndex(index + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [index, images.length, onClose, onIndex]);

  if (!image) return null;

  const saveCaption = () => {
    if ((image.caption ?? '') !== caption.trim()) void updateRecord(db.images, image.id, { caption: caption.trim() || undefined });
  };

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      onTouchStart={(e) => (touchX.current = e.touches[0].clientX)}
      onTouchEnd={(e) => {
        if (touchX.current === null) return;
        const dx = e.changedTouches[0].clientX - touchX.current;
        if (dx > 60 && index > 0) onIndex(index - 1);
        if (dx < -60 && index < images.length - 1) onIndex(index + 1);
        touchX.current = null;
      }}
    >
      <div className="lightbox-bar">
        <span className="muted small">
          {index + 1} / {images.length}
        </span>
        <span className="spacer" />
        <button
          className="btn ghost icon small"
          aria-label="Bild löschen"
          onClick={async () => {
            if (!confirm('Dieses Bild löschen?')) return;
            await deleteRecord(db.images, image.id);
            if (images.length <= 1) onClose();
            else onIndex(Math.max(0, index - 1));
          }}
        >
          <Trash2 size={18} />
        </button>
        <button className="btn ghost icon small" aria-label="Schließen" onClick={onClose}>
          <X size={22} />
        </button>
      </div>
      <div className="lightbox-stage">
        {index > 0 && (
          <button className="lightbox-nav left" aria-label="Vorheriges Bild" onClick={() => onIndex(index - 1)}>
            <ChevronLeft size={28} />
          </button>
        )}
        {url && <img src={url} alt={image.caption ?? ''} />}
        {index < images.length - 1 && (
          <button className="lightbox-nav right" aria-label="Nächstes Bild" onClick={() => onIndex(index + 1)}>
            <ChevronRight size={28} />
          </button>
        )}
      </div>
      <div className="lightbox-caption">
        <input
          className="input"
          value={caption}
          placeholder="Beschriftung, z. B. „Tischaufbau links“"
          onChange={(e) => setCaption(e.target.value)}
          onBlur={saveCaption}
          onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
        />
      </div>
    </div>
  );
}

export function ImagesTab() {
  const { con } = useConContext();
  const all = useConRecords(db.images, con.id);
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(0);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!all) return null;
  const images = all.filter((i) => i.kind === 'ref').sort((a, b) => (a.createdAt ?? a.updatedAt) - (b.createdAt ?? b.updatedAt) || a.id.localeCompare(b.id));

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    setBusy(list.length);
    for (const file of list) {
      try {
        const r = await resizeImage(file);
        await createRecord(db.images, { conId: con.id, kind: 'ref', blob: r.blob, thumb: r.thumb, width: r.width, height: r.height, createdAt: Date.now() });
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      }
      setBusy((b) => b - 1);
    }
  }

  return (
    <>
      <div className="row">
        <p className="muted small" style={{ margin: 0, flex: 1 }}>
          Referenzbilder für den Standaufbau. Fotos werden beim Speichern verkleinert.
        </p>
        <button className="btn primary" onClick={() => input.current?.click()} disabled={busy > 0}>
          <ImagePlus size={18} /> {busy > 0 ? `Speichere … (${busy})` : 'Bilder hinzufügen'}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            void addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>
      {error && <div className="status-banner warn">{error}</div>}

      {images.length === 0 ? (
        <EmptyState icon={<Images size={44} />} title="Noch keine Bilder">
          <span>Fotografier deinen Stand oder wähl Bilder aus der Mediathek.</span>
        </EmptyState>
      ) : (
        <div className="gallery">
          {images.map((img, i) => (
            <Thumb key={img.id} image={img} onOpen={() => setOpen(i)} />
          ))}
        </div>
      )}

      {open !== null && images[open] && (
        <Lightbox images={images} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </>
  );
}
