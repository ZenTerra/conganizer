# ConGanizer

Private PWA zur Con-Vorbereitung für Aussteller: Bewerbungsstatus, Hotel, Fahrtenbuch, Packliste, Kasse pro Tag, Checklisten und Abrechnungs-Spickzettel für Accountable.

- **Kein Server, kein Account:** Alle Daten liegen lokal im Browser (IndexedDB). Auf GitHub Pages liegt nur der Programmcode.
- **iPhone:** URL in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Danach läuft die App offline.
- **Android:** In Chrome öffnen → „App installieren“.

## Entwicklung

```bash
npm install
npm run dev       # Entwicklungsserver
npm test          # Tests (Vitest)
npm run build     # Produktions-Build nach dist/
npm run preview   # Build lokal ansehen: http://localhost:4173/conganizer/
npm run icons     # App-Icons aus public/icon.svg neu erzeugen
```

## Deployment

Ein Push auf `main` baut die App per GitHub Action (`.github/workflows/deploy.yml`) und veröffentlicht sie auf GitHub Pages unter `https://<user>.github.io/conganizer/`.
Einmalig in den Repo-Einstellungen: **Settings → Pages → Source: GitHub Actions**.

Der Repo-Name muss `conganizer` lauten, sonst `base` in `vite.config.ts` anpassen.

## Aufbau

| Pfad | Inhalt |
|---|---|
| `src/db/` | Datenmodell (`types.ts`), Dexie-Schema, Repo-Schicht (einziger Schreibweg, setzt `updatedAt`/Tombstones), Vorlagen |
| `src/domain/` | Reine Logik: Datum, Geld (Cent), Status, Fristen, Bilder, Karten-Links |
| `src/features/` | Seiten: Übersicht, Con-Ansicht mit Tabs (`convention/` – nicht `con/`, das ist unter Windows ein reservierter Name), Einstellungen |
| `src/ui/` | Formularfelder und gemeinsame Bausteine |
| `src/styles/` | Design-Tokens (immer dunkel, Petrol + Weinrot) und globale Styles |

## Meilensteine

1. ✅ Grundgerüst, PWA, Übersicht, Con anlegen/bearbeiten, Status, Fristen, Hotel, Einstellungen
2. Fahrtenbuch, Kasse, Checklisten, Packliste
3. Bilder, Abrechnung, Gewinn pro Con, Fristen-Leiste + Kalender-Export, Nachbereitung
4. Backup & Abgleich zwischen Geräten, Duplizieren fürs nächste Jahr, Feinschliff
