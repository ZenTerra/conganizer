# ConGanizer

Private PWA zur Con-Vorbereitung für Aussteller: Bewerbungsstatus, Hotel, Fahrtenbuch, Packliste, Kasse pro Tag, Checklisten und Abrechnungs-Spickzettel für Accountable.

- **Kein Server, kein Account:** Alle Daten liegen lokal im Browser (IndexedDB). Auf GitHub Pages liegt nur der Programmcode.
- **iPhone:** URL in Safari öffnen → Teilen → „Zum Home-Bildschirm“. Danach läuft die App offline.
- **Android:** In Chrome öffnen → „App installieren“.

## Backup & Abgleich zwischen Geräten

Es gibt keinen Server – abgeglichen wird per Datei (**Einstellungen → Backup & Abgleich**):

1. Auf Gerät A **Backup erstellen** → im Teilen-Menü „In Dateien sichern“ (z. B. iCloud Drive).
2. Auf Gerät B **Backup importieren** → Datei wählen.

Beim Import wird **pro Eintrag zusammengeführt**: Die neuere Version gewinnt, Löschungen werden übernommen, nichts wird pauschal überschrieben. Vor jedem Import legt die App automatisch einen Sicherungsstand an, der sich wiederherstellen lässt. Ein Banner erinnert an ein Backup, wenn das letzte älter als 7 Tage ist oder eine Con abgeschlossen wurde.

> Tipp: Die Uhren beider Geräte sollten stimmen (automatische Uhrzeit), da „neuer“ über den Zeitstempel entschieden wird.

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
| `src/db/` | Datenmodell (`types.ts`), Dexie-Schema, Repo-Schicht (einziger Schreibweg, setzt `updatedAt`/Tombstones), Vorlagen, Backup/Import |
| `src/domain/` | Reine Logik: Datum, Geld (Cent), Status, Fristen, Kasse, Fahrten, Pauschalen, Gewinn, Export (PDF/CSV/ICS), Merge |
| `src/features/` | Seiten: Übersicht, Con-Ansicht mit Tabs (`convention/` – nicht `con/`, das ist unter Windows ein reservierter Name), Fahrtenbuch (`trips/`), Einstellungen |
| `src/ui/` | Formularfelder und gemeinsame Bausteine |
| `src/styles/` | Design-Tokens (immer dunkel, Petrol + Weinrot) und globale Styles |

## Meilensteine

1. ✅ Grundgerüst, PWA, Übersicht, Con anlegen/bearbeiten, Status, Fristen, Hotel, Einstellungen
2. ✅ Fahrtenbuch (km-Stand, Start/Ende, Übertragungsansicht fürs Papierbuch), Kasse mit Kassenbericht (Avery 305), Checklisten, Packliste, Vorlagen-Editor
3. ✅ Referenzbilder, Abrechnungs-Spickzettel für Accountable (Verpflegungspauschale, km-Pauschale, Fahrtenbuch als PDF/CSV), Gewinn pro Con, sonstige Ausgaben, Fristen-Leiste + Kalender-Export (.ics), Nachbereitung
4. ✅ Backup & Abgleich zwischen Geräten (Merge pro Eintrag, Sicherungsstände, Erinnerung), Duplizieren fürs nächste Jahr, Jahrgänge
