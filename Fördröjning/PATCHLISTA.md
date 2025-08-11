# Patchlista — Optimeringar

Datum: 2025-08-08

Denna fil sammanfattar optimeringar och relaterade förbättringar som lagts in för bättre prestanda och smidigare bygg-upplevelse.

## Prestanda
- Offscreen-bakgrund (cachad grid + väg)
  - Fil: `src/render.js`
  - Nytt: `initBackground(canvas)` skapar en offscreen-canvas som ritas en gång; `drawWorld()` blitar bilden varje frame.
  - Effekt: Avsevärt mindre ritkostnad per frame.

- Spatial hash för närsök (fiender ⇄ torn)
  - Filer: `src/spatial.js`, `src/main.js`, `src/entities.js`
  - Nytt: `SpatialHash` indexerar fiender i celler; torn frågar `queryCircle()` istället för att loopa alla fiender varje frame.
  - Effekt: Minskar målsökning från O(N²) till nära O(N) vid många fiender.

- Throttlad målsökning + kandidatcache i torn
  - Fil: `src/entities.js` (Tower)
  - Nytt: Torn rescanar potentiella mål mer sällan och återanvänder kandidatlista mellan skott.
  - Effekt: Färre distansberäkningar per sekund utan att tappa respons.

- Stabil tidsskala och jitter-fri rörelse (tidigare fix)
  - Filer: `src/entities.js`, `src/waves.js`, `src/main.js`
  - Nytt: GameSpeed appliceras exakt en gång per system; fiender rör sig med segment-baserad integrering (inga “fastna vid hörn”).
  - Effekt: Jämn rörelse även vid 5× hastighet.

## Bygg- och UX-förbättringar
- Räckviddsring med affordance-färg
  - Fil: `src/ui.js`
  - Nytt: Grön ring om du har råd; röd om pengarna inte räcker.

- Dämpade tornknappar när pengarna inte räcker
  - Fil: `src/ui.js`
  - Nytt: `highlightAffordable()` uppdaterar knapplistan när saldo ändras.

- Shift-klick för snabb placering i följd
  - Fil: `src/ui.js`
  - Nytt: Håll Shift när du klickar för att snabbt placera torn i följd (ett per klick, utan flood).

## Struktur och kompatibilitet (relaterat)
- Modulär kodbas
  - Filer: `src/*.js` (constants, path, math, entities, state, towers, waves, render, ui, main)
  - Effekt: Lättare att optimera och underhålla.

- Fallback-bundle för file://
  - Filer: `dist/bundle.js`, `SPEL.HTML`
  - Nytt: Automatisk fallback till icke-modul-bundle när modulimport blockeras (lokal fil-öppning).

## Snabb validering
- Starta våg och öka till 5×: fiender ska flyta jämnt.
- Bygg flera torn med Shift-klick; knappar dämpas när pengarna inte räcker.
- Prestanda bör vara stabil även med många fiender/torn.

## Idéer för nästa steg
- Drag-bygg (klick-dra för att lägga rad/kolumn torn med grid-snapp).
- Culling/sprite-batching för projektiler vid extrema scenarier.
- Web Worker för path/spawn-planering i massiva vågor.
