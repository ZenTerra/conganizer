const isAppleTouch = (): boolean =>
  typeof navigator !== 'undefined' &&
  /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent) &&
  typeof document !== 'undefined' &&
  'ontouchend' in document;

const enc = encodeURIComponent;

/** Auf iPhone/iPad Apple Karten, sonst Google Maps. */
export function mapsSearchUrl(address: string): string {
  return isAppleTouch()
    ? `https://maps.apple.com/?q=${enc(address)}`
    : `https://www.google.com/maps/search/?api=1&query=${enc(address)}`;
}

export function mapsRouteUrl(from: string, to: string): string {
  return isAppleTouch()
    ? `https://maps.apple.com/?saddr=${enc(from)}&daddr=${enc(to)}`
    : `https://www.google.com/maps/dir/?api=1&origin=${enc(from)}&destination=${enc(to)}&travelmode=driving`;
}
