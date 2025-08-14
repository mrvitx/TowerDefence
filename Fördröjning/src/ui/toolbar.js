// Toolbar setup: decorate buttons and wire simple toggle labels.
import { decorateButton } from '../utils/dom.js';

export function initToolbar({
  buttons,
  Visuals,
  Settings,
  saveSettingsDump
}){
  const {
    startWaveBtn, sellAllBtn, btnSpeed, btnPause,
    btnRanges, btnDps, btnHeat, btnSkills, btnAdmin, btnRestart, btnMenu,
    speedLbl
  } = buttons;

  // Decorate core buttons
  if(startWaveBtn) decorateButton(startWaveBtn, 'i-play', 'Starta våg');
  if(btnSpeed) btnSpeed._deco = decorateButton(btnSpeed, 'i-speed', btnSpeed.textContent||'×1');
  if(btnPause) btnPause._deco = decorateButton(btnPause, 'i-pause', 'Pausa');
  if(sellAllBtn) decorateButton(sellAllBtn, 'i-sell', 'Sälj alla');
  if(btnSkills) decorateButton(btnSkills, 'i-skill', 'Skills');
  if(btnAdmin) { decorateButton(btnAdmin, 'i-admin', 'Admin'); try{ btnAdmin.title='Klick: Dev-panel • Shift/Högerklick: Admin-sida'; }catch(_e){} }
  if(btnRestart) decorateButton(btnRestart, 'i-restart', 'Restart');
  if(btnMenu) decorateButton(btnMenu, 'i-home', 'Meny');

  // Toggle helpers with label sync
  function wireToggle(btn, iconId, get, set, labelOn, labelOff){
    if(!btn) return; const deco = decorateButton(btn, iconId, labelOff);
    const sync = ()=>{ deco && deco.set(get()? labelOn : labelOff); };
    sync();
    btn.addEventListener('click',()=>{ set(!get()); try{ saveSettingsDump && saveSettingsDump(); }catch(_e){} sync(); });
    return { sync };
  }
  const tRanges = wireToggle(btnRanges, 'i-eye', ()=>Visuals.showAllRanges, v=>Visuals.showAllRanges=v, 'Dölj räckvidd', 'Visa räckvidd');
  const tDps    = wireToggle(btnDps,   'i-bolt', ()=>Visuals.showDps,       v=>Visuals.showDps=v,       'Dölj DPS',     'Visa DPS');
  const tHeat   = wireToggle(btnHeat,  'i-heat', ()=>Visuals.showHeatmap,   v=>Visuals.showHeatmap=v,   'Dölj heatmap', 'Visa heatmap');

  // Speed label sync API
  function syncSpeed(v){ if(speedLbl) speedLbl.textContent = (v||Settings.gameSpeed||1).toFixed(2)+'×'; if(btnSpeed && btnSpeed._deco){ btnSpeed._deco.set('×'+Math.max(1,Math.round(v||Settings.gameSpeed||1))); } }
  function syncPause(paused){ if(btnPause && btnPause._deco){ btnPause._deco.set(paused ? 'Fortsätt' : 'Pausa'); } }

  return { syncSpeed, syncPause, syncToggles: ()=>{ tRanges&&tRanges.sync(); tDps&&tDps.sync(); tHeat&&tHeat.sync(); } };
}
