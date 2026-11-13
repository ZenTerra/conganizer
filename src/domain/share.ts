export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

function download(file: File): void {
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = file.name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Gibt eine Datei über das Teilen-Menü weiter (iPhone: „In Dateien sichern“, AirDrop, Mail …).
 * Wo das nicht geht (z. B. Desktop-Browser), wird sie heruntergeladen.
 * Mit `preferDownload` wird direkt heruntergeladen – für .ics öffnet Safari dann den Kalender-Dialog.
 */
export async function shareFile(file: File, opts: { title?: string; preferDownload?: boolean } = {}): Promise<ShareResult> {
  const canShare = typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] });
  if (canShare && !opts.preferDownload) {
    try {
      await navigator.share({ files: [file], title: opts.title ?? file.name });
      return 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      // sonst auf Download zurückfallen
    }
  }
  download(file);
  return 'downloaded';
}

export const textFile = (content: string, name: string, type: string): File =>
  new File([content], name, { type });

/** Dateiname ohne problematische Zeichen */
export const safeName = (s: string): string =>
  s
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w.-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
