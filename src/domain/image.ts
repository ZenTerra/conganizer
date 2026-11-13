export interface ResizedImage {
  blob: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Bild konnte nicht gelesen werden'));
    };
    img.src = url;
  });
}

function draw(img: HTMLImageElement, maxSide: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) return Promise.reject(new Error('Canvas nicht verfügbar'));
  ctx.drawImage(img, 0, 0, w, h);
  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, w, h }) : reject(new Error('Bild konnte nicht komprimiert werden'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** Verkleinert ein Foto (max. 1280 px, JPEG 0,7) und erzeugt ein Vorschaubild (320 px). */
export async function resizeImage(file: Blob, maxSide = 1280, thumbSide = 320, quality = 0.7): Promise<ResizedImage> {
  const img = await loadImage(file);
  const full = await draw(img, maxSide, quality);
  const thumb = await draw(img, thumbSide, quality);
  return { blob: full.blob, thumb: thumb.blob, width: full.w, height: full.h };
}
