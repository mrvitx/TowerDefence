// Shared DOM and icon helpers to reduce duplication across UI code.

export function createEl(tag, props = {}, html) {
  const el = document.createElement(tag);
  Object.assign(el, props);
  if (html !== undefined) el.innerHTML = html;
  return el;
}

export function qs(sel, root = document) {
  return root.querySelector(sel);
}

export function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

export function on(el, evt, handler, opts) {
  if (!el) return () => {};
  el.addEventListener(evt, handler, opts);
  return () => el.removeEventListener(evt, handler, opts);
}

// Button decoration with inline SVG fallback to be file:// safe.
export function decorateButton(btn, iconSvgOrId, label) {
  if (!btn) return null;
  const isRawSvg = /<svg[\s\S]*<\/svg>/.test(iconSvgOrId || '');
  const icon = isRawSvg
    ? iconSvgOrId
    : `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use href="#${iconSvgOrId}" xlink:href="#${iconSvgOrId}"></use></svg>`;
  btn.innerHTML = `<span class="ico" aria-hidden="true">${icon}</span><span class="lbl"></span>`;
  const lbl = btn.querySelector('.lbl'); if (lbl) lbl.textContent = label || '';
  const api = { set: (txt)=>{ const l=btn.querySelector('.lbl'); if(l) l.textContent=txt; } };
  btn._deco = api;
  return api;
}

export function ensurePriceBadge(btn) {
  if (!btn) return null;
  let p = btn.querySelector && btn.querySelector('.price');
  if (!p) {
    p = document.createElement('span');
    p.className = 'price';
    p.style.marginLeft = '8px';
    p.style.padding = '0 8px';
    p.style.borderRadius = '12px';
    p.style.background = 'rgba(0,0,0,0.35)';
    p.style.border = '1px solid rgba(255,255,255,0.35)';
    p.style.color = '#fff';
    p.style.fontWeight = '700';
    p.style.fontSize = '12px';
    p.style.lineHeight = '20px';
    p.style.height = '20px';
    p.style.display = 'inline-flex';
    p.style.alignItems = 'center';
    p.style.justifyContent = 'center';
    p.style.minWidth = '26px';
    p.style.whiteSpace = 'nowrap';
    p.style.verticalAlign = 'middle';
    try { btn.appendChild(p); btn.style.overflow = 'visible'; } catch(_e) {}
  }
  return p;
}
