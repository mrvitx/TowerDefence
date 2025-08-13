## 2025-08-13 – Avancerad kartgenerering & optimeringar

- Kartbygge: cachear path‑geometri (mindre onödiga rebuilds) och snabbare blockerat‑nät via stride.
- Ny UI‑stabilitet: fix för uppgraderingspopupens prisbadge.
- Nya MapSettings:
  - seed (0=auto), complexity (1..5), smoothness (0..1)
- Nya presets:
  - riverNoise: flodlik meander via fraktalt värdebrus; styrs av complexity.
  - aStarSnake: A*-baserad rutt tvärs över kartan med mjuka hinder för kurvighet.
- Smoothing: Catmull‑Rom anpassad av smoothness.

Admin • Karteditor
- Nya verktyg i ADMIN.html:
  - Generator: Preset (Diagonal/River Noise/A* Snake/Ring/Maze), Seed, Complexity.
  - Transform: Förenkla (RDP epsilon), Jämna (Chaikin-iterations), Utjämna avstånd (steg), Jitter (ampl.), Vänd, Stäng slinga.
  - Allt ritar om canvas direkt och sparar i spelkoordinater (1200×800 med PAD=24).
- Nya Maps‑APIer (window.Maps):
  - generatePresetPoints(preset, width, height, tile, { seed, complexity })
  - simplifyPath(points, epsilon)
  - smoothPath(points, iterations)
  - equalizeSpacing(points, step)
  - jitterPath(points, seed, amount)
  - reversePath(points)
  - closeLoop(points)

Tips: ändra MapSettings i XML eller localStorage‑inställningarna och fokusera tillbaka fönstret för att trigga rebuild.

# Nytt – Kartbyggar‑API (2025‑08‑13)
- `Maps.analyzePath(points)` — längd, böjar, snitt‑sväng, bbox och grov svårighetsgrad.
- `Maps.optimizePath(points, opts)` — rensa dubletter, klipp inom bounds, ta bort mikrosektorer, förenkla (RDP), mjuka (Chaikin), jämna avstånd.
- `Maps.autoBuildPath(preset, width, height, tile, opts)` — generera via preset och optimera i ett steg.
- Exempel: `const pts = Maps.autoBuildPath('riverNoise', 1200, 800, 40, { smooth:2, step:30 });`
- Använd i Admin genom att ersätta `current.points` och spara.

## Utökningar (2025‑08‑13, senare)
- Målsvårighet: `Maps.autoBuildToDifficulty(preset, w, h, tile, { target, tolerance, seed, complexity, ... })` provar parametrar tills svårighet≈mål.
- Hårda svängar: `Maps.capTurnAngles(points, maxDeg)` mjukar upp för skarpare än maxDeg.
- Korsningar: `Maps.detectSelfIntersections(points)` returnerar antal och positioner på själv‑korsningar.
- Admin UI:
  - Knapp “Bygg→svårighet” + fält “Mål‑svårighet”.
  - Info visar “Korsningar”.
  - Nya spelinställningar: Våglängd (sek), Max vågor, koppling mellan Mål‑svårighet → spel‑svårighet.
  - Waves: spawn‑mängd och spawn‑tempo påverkas av Våglängd; spelet avslutas med seger när Max vågor nås (om inte Endless).

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
