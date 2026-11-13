/** Initialen für Kacheln ohne Titelbild: „Dokomi“ → „DO“, „Connichi Kassel“ → „CK“ */
export function initials(name: string): string {
  // Jahreszahlen o. Ä. ignorieren: „DoKomi 2027“ → „DO“
  const all = name.trim().split(/\s+/).filter(Boolean);
  const lettered = all.filter((w) => /\p{L}/u.test(w[0]));
  const words = lettered.length ? lettered : all;
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

const TILE_COLORS = ['#24434b', '#5c1530', '#2d4f3f', '#3b3561', '#4f3a22', '#1f4a5e'];

/** Stabile Kachelfarbe aus dem Namen */
export function tileColor(name: string): string {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[h % TILE_COLORS.length];
}

/** Erkennt URL bzw. E-Mail in einer Zeile und liefert ggf. einen Link. */
export function linkify(line: string): { text: string; href?: string } {
  const t = line.trim();
  if (/^https?:\/\//i.test(t)) return { text: t.replace(/^https?:\/\//i, ''), href: t };
  if (/^www\./i.test(t)) return { text: t, href: `https://${t}` };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t)) return { text: t, href: `mailto:${t}` };
  return { text: t };
}
