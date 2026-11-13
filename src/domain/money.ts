import type { Cents } from '../db/types';

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' });

export const formatEuro = (cents: Cents | undefined): string =>
  cents === undefined || Number.isNaN(cents) ? '' : euro.format(cents / 100);

/** Zahl ohne Währungszeichen, z. B. für Eingabefelder: 1250 → "12,50" */
export const centsToInput = (cents: Cents | undefined): string =>
  cents === undefined ? '' : (cents / 100).toFixed(2).replace('.', ',');

/**
 * Liest deutsche und englische Schreibweisen: "12,50", "12.50", "1.234,56", "12 €".
 * Gibt `undefined` für leere oder ungültige Eingaben zurück.
 */
export function parseEuro(input: string): Cents | undefined {
  let s = input.replace(/[€\s]/g, '');
  if (!s) return undefined;
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if ((s.match(/\./g) ?? []).length > 1) s = s.replace(/\./g, '');
  if (!/^-?\d*(\.\d*)?$/.test(s) || s === '-' || s === '.') return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : undefined;
}
