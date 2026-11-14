/* Página "The Truth Behind the Mask": completa fotos y precios desde el
   catálogo (Supabase si está configurado; si no, js/productos.js). */
(async () => {
  'use strict';
  const dinero = (n) => '$' + Number(n).toLocaleString('es-CO');
  const secciones = Array.from(document.querySelectorAll('[data-producto]'));
  let productos = window.PRODUCTOS_LOCAL || [];
  const cfg = window.INSANITY_CONFIG || {};
  if (cfg.supabaseUrl && cfg.supabaseKey) {
    try {
      const ids = secciones.map((s) => s.dataset.producto).join(',');
      const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 7000);
      const r = await fetch(`${cfg.supabaseUrl.replace(/\/+$/, '')}/rest/v1/productos?select=*&id=in.(${ids})`, { headers: { apikey: cfg.supabaseKey }, signal: ctrl.signal });
      clearTimeout(t);
      if (r.ok) { const data = await r.json(); if (data.length) productos = data; }
    } catch { /* se usa el catálogo local */ }
  }
  const porId = new Map(productos.map((p) => [p.id, p]));
  secciones.forEach((sec) => {
    const p = porId.get(sec.dataset.producto);
    const img = sec.querySelector('.capitulo-img');
    const fotos = p?.imagenes && Object.values(p.imagenes)[0];
    if (fotos?.frente) img.src = fotos.frente; else sec.querySelector('.capitulo-media').classList.add('sin-foto');
    if (fotos?.espalda) {
      const vistas = sec.querySelector('.capitulo-vistas');
      vistas.classList.remove('hidden');
      vistas.addEventListener('click', (e) => {
        const b = e.target.closest('.view-btn'); if (!b) return;
        vistas.querySelectorAll('.view-btn').forEach((x) => { x.classList.toggle('active', x === b); x.setAttribute('aria-pressed', String(x === b)); });
        img.src = fotos[b.dataset.view] || fotos.frente;
      });
    }
    const precio = sec.querySelector('.capitulo-precio');
    if (p && p.activo !== false && p.precio != null) {
      const min = p.variantes?.length ? Math.min(...p.variantes.map((v) => v.precio)) : p.precio;
      precio.textContent = (p.variantes?.length ? 'Desde ' : '') + dinero(min) + ' · Tallas ' + p.tallas[0] + ' a ' + p.tallas[p.tallas.length - 1];
    }
  });
})();
