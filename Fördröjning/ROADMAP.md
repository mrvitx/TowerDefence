# Stegplan & status för Tower Defense-projektet

## Översikt
Mål: 
- Packa webbspelet i en desktop-wrapper (C# + WebView2) redo för Steam.
- Förenkla START-flödet, modernisera UI/UX, lägga till profil/progression och kart-gating.
- Städa upp/modernisera koden i små moduler och förbättra stabilitet/prestanda.

## Genomförda steg ✅
- START-förenkling och gating
  - Startflöde förenklat (en start), avancerat gömt under Inställningar → Avancerat.
  - Kart-gating baserad på profilnivå; Admin kan sätta level-krav per karta.
  - Lokal persistens via localStorage.
- Profil/progression
  - Profil med namn/level/XP, inventory och blueprints; XP-bar “Matrix”-tema i HUD.
  - HUD “profilchip” som uppdateras periodiskt. Fil: `src/ui/profileChip.js`.
- Inställningar och stabilitet
  - Flyttat verktyg till Inställningar; döljer legacy-popup och visar den i en “Avancerat”-modal.
  - Förhindrat att toolbar försvinner; robust init (UI-fel blockerar inte kartladdning).
- Modulär UI (Refaktor steg 2–4)
  - Dom-hjälpare: `src/utils/dom.js` (createEl/qs/qsa/on/decorateButton/ensurePriceBadge).
  - Tornlista modul: `src/ui/towerList.js` + wrapper i `src/ui.js` (bakåtkompatibelt).
  - Uppgraderingspopup modul: `src/ui/upgradePopup.js` (nu integrerad i `src/ui.js`).
  - Toolbar modul: `src/ui/toolbar.js` för dekoration och toggles (räckvidd/DPS/heatmap) och speed/pause‑sync.
- Övrigt
  - Heatmap-beräkning till offscreen canvas + throttling.
  - Dev-panel (Admin 2.0) med live sliders, snapshot/restore, replay.

## Pågående / Att göra 📌
- Desktop-wrapper och release
  - Skapa C# WinForms (.NET 8) app med WebView2 som hostar spelet (Steam‑redo).
  - Inbyggd updater/inställningar för fönsterstorlek, fullscreen, ESC‑hantering.
  - Steam-distribution: app-id, byggskript och CI (senare steg).
- Mer modulär uppdelning
  - Flytta skill‑panel till `src/ui/skills.js`.
  - Flytta dev‑panel till `src/ui/devPanel.js`.
  - Flytta mutator‑erbjudande till `src/ui/mutators.js`.
  - Konsolidera ikon-/button‑hjälp till `src/utils/dom.js` överallt (ta bort dubbletter i `ui.js`).
- Uppgraderingspopup – små förbättringar
  - Visa projektioner/delta (DPS/RNG/ROF) per uppgradering i modulen.
  - Lägg till tangentbindningar (t.ex. U) via modulens API.
- Robusthet/prestanda
  - Finjustera heatmap‑throttle och DPS-overlay (ev. rate-limit på mätning/ritning).
  - Debounce av UI‑uppdateringar i fler paneler.
- Kvalitet
  - Lint/formatter (ESLint + Prettier) samt npm‑script.
  - Enkla enhetstester för matematik/gating och kostskalning (t.ex. Jest).
  - Minimal README för körning och felsökning (webb + desktop wrapper).

## Kravtäckning (sammanfattning)
- Desktop wrapper (C#/C++) → Ej klar (plan vald: C# WinForms + WebView2).
- START förenkling → Klar.
- Profil/inventory/XP och kart‑gating → Klar.
- Admin nivåkrav per karta → Klar.
- HUD profilchip + Matrix‑tema → Klar.
- Meny samlad under Inställningar; legacy-panel under Avancerat → Klar.
- Städa/optimera/splittra koden → Pågår (steg 2–4 klara; fler moduler kvar).

## Viktiga filer (nya/ändrade)
- `src/utils/dom.js` – DOM/knapp‑hjälpare.
- `src/ui/profileChip.js` – HUD profilchip‑uppdatering.
- `src/ui/towerList.js` – Tornlistan (render + affordability).
- `src/ui/upgradePopup.js` – Uppgraderingspopup (köp/sälj, fokus, stats).
- `src/ui/toolbar.js` – Toolbar‑dekorationer, toggles, speed/pause‑sync.
- `src/ui.js` – Central glue (nu tunnare): använder modulerna ovan.
- `SPEL.HTML` – Stabiliserad inställningsupplevelse och “Avancerat”-modal.

## Nästa konkreta steg
1) Skapa desktop-wrapper (WinForms + WebView2) och peka till `SPEL.HTML`/index.
2) Modulärisera skills/devPanel/mutators enligt ovan.
3) Lägg till projektioner i uppgraderingspopupen.
4) ESLint/Prettier + några snabba Jest‑tester (kostskalning/xp‑behov/gating).

— Denna fil hålls uppdaterad när arbetet fortskrider.
