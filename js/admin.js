/* =========================================================
   INSANITY SOCIETY — Panel de administración
   La seguridad real está en la base de datos (supabase/setup.sql):
   aunque alguien abra esta página, sin cuenta de administrador
   no puede crear, editar ni borrar nada.
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const dinero = (n) => (n == null ? 'Por confirmar' : '$' + Number(n).toLocaleString('es-CO'));
  const soloNumero = (v) => { const d = String(v || '').replace(/\D/g, ''); return d ? parseInt(d, 10) : null; };

  const BUCKET = 'productos';
  const TALLAS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Única'];
  const vistas = ['vistaConfig', 'vistaLogin', 'vistaSinPermiso', 'vistaPanel'];
  const mostrar = (id) => vistas.forEach((v) => $('#' + v).classList.toggle('hidden', v !== id));

  let toastTimer;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.remove('hidden');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.add('hidden'), 2800);
  }
  function errorEn(sel, msg) { const e = $(sel); e.textContent = msg || ''; e.classList.toggle('hidden', !msg); }
  const traducir = (err) => {
    const m = (err && (err.message || err.error_description || String(err))) || 'Error desconocido';
    if (/Invalid login credentials/i.test(m)) return 'Correo o contraseña incorrectos.';
    if (/duplicate key|already exists/i.test(m)) return 'Ya existe un producto con ese nombre. Cambia el nombre.';
    if (/row-level security|permission denied/i.test(m)) return 'Tu cuenta no tiene permiso para esta acción.';
    if (/Failed to fetch|NetworkError/i.test(m)) return 'Sin conexión con Supabase. Revisa tu internet y js/config.js.';
    if (/'stock'|stock column|column.*stock/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Falta activar el inventario: ejecuta supabase/inventario.sql en Supabase (SQL Editor).';
    if (/preventa|usos_por_cliente|usos_maximos/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Falta activar preventa y límites de cupones: ejecuta supabase/cupones-preventa.sql en Supabase (SQL Editor).';
    if (/destacado|oferta_pct|oferta_hasta|cupones|validar_cupon/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Falta activar las promociones: ejecuta supabase/promos.sql en Supabase (SQL Editor).';
    if (/pedidos|crear_pedido/i.test(m) && /does not exist|schema cache|could not find/i.test(m)) return 'Falta activar los pedidos: ejecuta supabase/pedidos.sql en Supabase (SQL Editor).';
    return m;
  };

  // ---------- Conexión ----------
  const cfg = window.INSANITY_CONFIG || {};
  if (!cfg.supabaseUrl || !cfg.supabaseKey || !window.supabase) { mostrar('vistaConfig'); return; }
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey);

  // ---------- Sesión ----------
  async function revisarSesion() {
    const { data: { session } } = await sb.auth.getSession();
    const user = session?.user;
    $('#usuarioActual').classList.toggle('hidden', !user);
    $('#btnSalir').classList.toggle('hidden', !user);
    if (!user) { mostrar('vistaLogin'); return; }
    $('#usuarioActual').textContent = user.email;
    const { data, error } = await sb.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
    if (error || !data) { mostrar('vistaSinPermiso'); return; }
    mostrar('vistaPanel');
    cargarProductos();
    document.dispatchEvent(new CustomEvent('admin:listo'));
  }

  $('#formLogin').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn('#loginError', '');
    const btn = e.submitter || $('#formLogin button');
    btn.disabled = true; btn.textContent = 'Entrando…';
    const { error } = await sb.auth.signInWithPassword({ email: $('#loginEmail').value.trim(), password: $('#loginPass').value });
    btn.disabled = false; btn.textContent = 'Entrar';
    if (error) { errorEn('#loginError', traducir(error)); return; }
    $('#loginPass').value = '';
    revisarSesion();
  });
  $('#btnSalir').addEventListener('click', async () => {
    const { error } = await sb.auth.signOut();
    // Sin conexión: borrar igualmente la sesión guardada en este dispositivo
    if (error) { try { Object.keys(localStorage).filter((k) => k.startsWith('sb-')).forEach((k) => localStorage.removeItem(k)); } catch { /* */ } location.reload(); return; }
    productos = [];
    revisarSesion();
  });

  // ---------- Lista ----------
  let productos = [];
  async function cargarProductos() {
    errorEn('#panelError', '');
    $('#listaProductos').innerHTML = '<p class="admin-cargando">Cargando productos…</p>';
    const { data, error } = await sb.from('productos').select('*').order('orden').order('nombre');
    if (error) { errorEn('#panelError', traducir(error)); $('#listaProductos').innerHTML = ''; return; }
    productos = data || [];
    if (!$('#subInventario')?.classList.contains('hidden')) setTimeout(renderInventario);
    $('#listaColecciones').innerHTML = [...new Set(productos.map((p) => p.coleccion))].map((c) => `<option value="${esc(c)}">`).join('');
    renderLista();
  }

  // Estado del inventario de un producto
  function estadoStock(p) {
    if (!p.stock || typeof p.stock !== 'object') return 'sin-control';
    const vals = p.colores.flatMap((c) => p.tallas.map((t) => parseInt(p.stock[`${c}|${t}`], 10) || 0));
    const total = vals.reduce((s, n) => s + n, 0);
    if (!total) return 'agotado';
    return vals.some((n) => n > 0 && n <= 3) || vals.some((n) => n === 0) ? 'bajo' : 'ok';
  }
  const unidades = (p) => (p.stock ? p.colores.reduce((s, c) => s + p.tallas.reduce((x, t) => x + (parseInt(p.stock[`${c}|${t}`], 10) || 0), 0), 0) : null);
  function badgeStock(p) {
    const e = estadoStock(p);
    if (e === 'sin-control') return '';
    if (e === 'agotado') return '<span class="admin-badge admin-badge--agotado">Agotado</span>';
    return `<span class="admin-badge ${e === 'bajo' ? 'admin-badge--bajo' : 'admin-badge--stock'}">${unidades(p)} und.${e === 'bajo' ? ' · revisar' : ''}</span>`;
  }
  const ofertaVigente = (p) => Number(p.oferta_pct) > 0 && (!p.oferta_hasta || new Date(p.oferta_hasta) > new Date());
  const fechaCorta = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  // Fecha (YYYY-MM-DD) <-> fin de ese día en hora de Colombia
  const aFinDeDia = (d) => (d ? `${d}T23:59:59-05:00` : null);
  const aFechaInput = (iso) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000); return d.toISOString().slice(0, 10); };
  const primeraFoto = (p) => { const i = p.imagenes && Object.values(p.imagenes)[0]; return i?.frente || i?.espalda || null; };

  function renderLista() {
    const q = slug($('#buscar').value);
    const estado = $('#filtroEstado').value;
    const lista = productos.filter((p) =>
      (!q || slug(p.nombre + ' ' + p.coleccion).includes(q)) &&
      (estado === 'todos' || (estado === 'activos' && p.activo) || (estado === 'ocultos' && !p.activo) ||
       (estado === 'destacados' && p.destacado) || (estado === 'ofertas' && ofertaVigente(p)) || (estado === 'preventa' && p.preventa) ||
       (estado === 'agotados' && estadoStock(p) === 'agotado') || (estado === 'bajo' && estadoStock(p) === 'bajo')));
    $('#conteo').textContent = `${lista.length} de ${productos.length}`;
    $('#listaProductos').innerHTML = lista.length ? lista.map((p) => {
      const foto = primeraFoto(p);
      const precio = p.variantes?.length ? p.variantes.map((v) => dinero(v.precio)).join(' / ') : dinero(p.precio);
      return `
      <article class="admin-item ${p.activo ? '' : 'is-oculto'}" data-id="${esc(p.id)}">
        <div class="admin-thumb">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" />` : `<span>${esc(p.coleccion)}</span>`}</div>
        <div class="admin-item-info">
          <p class="producto-col">${esc(p.coleccion)}</p>
          <h3>${esc(p.nombre)}</h3>
          ${p.destacado || p.oferta_pct || p.stock || p.preventa ? `<p class="admin-badges">${p.preventa ? `<span class="admin-badge admin-badge--preventa${p.preventa_hasta && new Date(p.preventa_hasta) < new Date() ? ' is-vencida' : ''}">⏳ Preventa${p.preventa_hasta ? ' hasta ' + esc(fechaCorta(p.preventa_hasta)) : ''}</span>` : ''}${badgeStock(p)}${p.destacado ? '<span class="admin-badge">★ Destacado</span>' : ''}${p.oferta_pct ? `<span class="admin-badge admin-badge--oferta${ofertaVigente(p) ? '' : ' is-vencida'}">-${p.oferta_pct}%${p.oferta_hasta ? ' hasta ' + esc(fechaCorta(p.oferta_hasta)) : ''}${ofertaVigente(p) ? '' : ' (vencida)'}</span>` : ''}</p>` : ''}
          <p class="admin-meta">${esc(precio)} · ${esc(p.colores.join(', '))} · ${esc(p.tallas.join(' '))}</p>
        </div>
        <div class="admin-item-acciones">
          <label class="admin-switch" title="Visible en la tienda">
            <input type="checkbox" data-accion="activo" ${p.activo ? 'checked' : ''} />
            <span>${p.activo ? 'Visible' : 'Oculto'}</span>
          </label>
          <button type="button" class="btn-secundario" data-accion="editar">Editar</button>
        </div>
      </article>`;
    }).join('') : '<p class="admin-cargando">No hay productos con ese filtro.</p>';
  }
  $('#buscar').addEventListener('input', renderLista);
  $('#filtroEstado').addEventListener('change', renderLista);

  $('#listaProductos').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-accion="editar"]');
    if (btn) abrirEditor(productos.find((p) => p.id === btn.closest('.admin-item').dataset.id));
  });
  $('#listaProductos').addEventListener('change', async (e) => {
    if (e.target.dataset.accion !== 'activo') return;
    const id = e.target.closest('.admin-item').dataset.id;
    const activo = e.target.checked;
    const { error } = await sb.from('productos').update({ activo }).eq('id', id);
    if (error) { toast(traducir(error)); e.target.checked = !activo; return; }
    productos.find((p) => p.id === id).activo = activo;
    renderLista();
    toast(activo ? 'Producto visible en la tienda' : 'Producto oculto');
  });

  // ---------- Editor ----------
  let editando = null;          // producto original (null = nuevo)
  let estado = null;            // copia de trabajo: colores, tallas, variantes, imagenes
  const modal = $('#editorModal');

  function abrirEditor(p) {
    editando = p || null;
    estado = {
      colores: [...(p?.colores || ['Negro'])],
      tallas: [...(p?.tallas || ['S', 'M', 'L', 'XL'])],
      variantes: (p?.variantes || []).map((v) => ({ ...v })),
      imagenes: JSON.parse(JSON.stringify(p?.imagenes || {})),
      stock: p?.stock && typeof p.stock === 'object' ? { ...p.stock } : null
    };
    $('#editorTitulo').textContent = p ? 'Editar producto' : 'Nuevo producto';
    $('#pNombre').value = p?.nombre || '';
    $('#pColeccion').value = p?.coleccion || '';
    $('#pCategoria').value = p?.categoria || 'camiseta';
    $('#pMaterial').value = p?.material || '';
    $('#pPrecio').value = p?.precio != null ? Number(p.precio).toLocaleString('es-CO') : '';
    $('#pOrden').value = p?.orden ?? (Math.max(0, ...productos.map((x) => x.orden || 0)) + 10);
    $('#pActivo').checked = p ? p.activo : true;
    $('#pDestacado').checked = !!p?.destacado;
    $('#pOfertaPct').value = p?.oferta_pct || '';
    $('#pOfertaHasta').value = aFechaInput(p?.oferta_hasta);
    $('#pPreventa').checked = !!p?.preventa;
    $('#pPreventaHasta').value = aFechaInput(p?.preventa_hasta);
    $('#pPreventaEntrega').value = p?.preventa_entrega || '';
    mostrarCamposPreventa();
    actualizarVistaOferta();
    $('#btnBorrar').classList.toggle('hidden', !p);
    errorEn('#editorError', '');
    actualizarId();
    $('#pControlStock').checked = !!estado.stock;
    renderTallas(); renderColores(); renderVariantes(); renderImagenes(); renderStock();
    modal.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    $('#pNombre').focus();
  }
  function actualizarVistaOferta() {
    const pct = parseInt($('#pOfertaPct').value, 10) || 0;
    const base = estado.variantes.length ? Math.min(...estado.variantes.filter((v) => v.precio != null).map((v) => v.precio)) : soloNumero($('#pPrecio').value);
    const el = $('#pOfertaVista');
    if (!pct) { el.textContent = 'Sin oferta.'; return; }
    if (pct > 90) { el.textContent = 'Máximo 90%.'; return; }
    el.textContent = base && isFinite(base) ? `Precio con oferta: ${dinero(Math.round(base * (1 - pct / 100) / 100) * 100)}${estado.variantes.length ? ' (variante más barata)' : ''} en lugar de ${dinero(base)}.` : `${pct}% de descuento.`;
  }
  function mostrarCamposPreventa() {
    const on = $('#pPreventa').checked;
    $('#pPreventaCampos').classList.toggle('hidden', !on);
    $('#pPreventaAyuda').classList.toggle('hidden', !on);
  }
  $('#pPreventa').addEventListener('change', mostrarCamposPreventa);
  ['#pOfertaPct', '#pPrecio'].forEach((s) => $(s).addEventListener('input', actualizarVistaOferta));
  $('#pOfertaPct').addEventListener('input', (e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 2); });

  function cerrarEditor() { modal.classList.add('hidden'); document.body.classList.remove('no-scroll'); editando = null; }
  $('#btnNuevo').addEventListener('click', () => abrirEditor(null));
  $('#cerrarEditor').addEventListener('click', cerrarEditor);
  $('#btnCancelar').addEventListener('click', cerrarEditor);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrarEditor(); });

  const idActual = () => editando ? editando.id : slug($('#pNombre').value);
  function actualizarId() { $('#pIdTxt').textContent = idActual() || '—'; }
  $('#pNombre').addEventListener('input', actualizarId);
  $('#pPrecio').addEventListener('input', (e) => { const n = soloNumero(e.target.value); e.target.value = n == null ? '' : n.toLocaleString('es-CO'); });

  // Tallas
  function renderTallas() {
    const todas = [...new Set([...TALLAS, ...estado.tallas])];
    $('#pTallas').innerHTML = todas.map((t) => `
      <label class="chip chip--talla"><input type="checkbox" value="${esc(t)}" ${estado.tallas.includes(t) ? 'checked' : ''} /><span>${esc(t)}</span></label>`).join('');
  }
  $('#pTallas').addEventListener('change', () => {
    const marcadas = $$('#pTallas input:checked').map((i) => i.value);
    const orden = [...new Set([...TALLAS, ...estado.tallas])];
    estado.tallas = orden.filter((t) => marcadas.includes(t));
    renderStock();
  });

  // Inventario: tabla colores × tallas
  const claveStock = (c, t) => `${c}|${t}`;
  function totalStock(stock) { return Object.values(stock || {}).reduce((s, n) => s + (parseInt(n, 10) || 0), 0); }
  function renderStock() {
    const cont = $('#pStock');
    const activo = $('#pControlStock').checked;
    $('#pStockHerramientas').classList.toggle('hidden', !activo);
    if (!activo) { cont.innerHTML = '<p class="admin-hint">Sin control de inventario: el producto se vende sin límite (ideal para prendas bajo pedido).</p>'; return; }
    estado.stock = estado.stock || {};
    const { colores, tallas } = estado;
    if (!colores.length || !tallas.length) { cont.innerHTML = '<p class="admin-hint">Agrega colores y tallas para cargar unidades.</p>'; return; }
    const v = (c, t) => parseInt(estado.stock[claveStock(c, t)], 10) || 0;
    cont.innerHTML = `
      <div class="stock-tabla-wrap">
        <table class="stock-tabla">
          <thead><tr><th>Color \ Talla</th>${tallas.map((t) => `<th>${esc(t)}</th>`).join('')}<th>Total</th></tr></thead>
          <tbody>${colores.map((c) => `
            <tr><th>${esc(c)}</th>${tallas.map((t) => `<td><input type="number" min="0" max="9999" inputmode="numeric" data-c="${esc(c)}" data-t="${esc(t)}" value="${v(c, t)}" class="${v(c, t) === 0 ? 'is-cero' : v(c, t) <= 3 ? 'is-bajo' : ''}" aria-label="${esc(c)} talla ${esc(t)}" /></td>`).join('')}
              <td class="stock-total-fila">${tallas.reduce((s, t) => s + v(c, t), 0)}</td></tr>`).join('')}
          </tbody>
          <tfoot><tr><th>Total</th>${tallas.map((t) => `<td>${colores.reduce((s, c) => s + v(c, t), 0)}</td>`).join('')}<td class="stock-gran-total">${colores.reduce((s, c) => s + tallas.reduce((x, t) => x + v(c, t), 0), 0)}</td></tr></tfoot>
        </table>
      </div>`;
  }
  $('#pControlStock').addEventListener('change', () => { if (!$('#pControlStock').checked) estado.stock = null; renderStock(); });
  $('#pStock').addEventListener('input', (e) => {
    const i = e.target; if (!i.dataset.c) return;
    const n = Math.max(0, Math.min(9999, parseInt(i.value, 10) || 0));
    estado.stock[claveStock(i.dataset.c, i.dataset.t)] = n;
  });
  $('#pStock').addEventListener('change', (e) => { if (e.target.dataset.c) { const pos = [e.target.dataset.c, e.target.dataset.t]; renderStock(); $(`#pStock input[data-c="${CSS.escape(pos[0])}"][data-t="${CSS.escape(pos[1])}"]`)?.focus(); } });
  $('#btnStockLlenar').addEventListener('click', () => {
    const n = Math.max(0, parseInt($('#pStockValor').value, 10) || 0);
    estado.colores.forEach((c) => estado.tallas.forEach((t) => { estado.stock[claveStock(c, t)] = n; }));
    renderStock();
  });
  $('#btnStockVaciar').addEventListener('click', () => {
    if (!window.confirm('¿Poner todas las unidades en 0? (marca el producto como agotado)')) return;
    estado.colores.forEach((c) => estado.tallas.forEach((t) => { estado.stock[claveStock(c, t)] = 0; }));
    renderStock();
  });

  // Colores
  function renderColores() {
    $('#pColores').innerHTML = estado.colores.map((c, i) => `
      <span class="admin-tag">${esc(c)}${i === 0 ? ' <small>(principal)</small>' : ''}
        <button type="button" data-i="${i}" aria-label="Quitar ${esc(c)}">✕</button></span>`).join('') || '<small class="admin-hint">Agrega al menos un color.</small>';
  }
  function agregarColor() {
    const v = $('#pColorNuevo').value.trim().replace(/\s+/g, ' ');
    if (!v) return;
    const nombre = v.charAt(0).toUpperCase() + v.slice(1);
    if (!estado.colores.some((c) => slug(c) === slug(nombre))) estado.colores.push(nombre);
    $('#pColorNuevo').value = '';
    renderColores(); renderImagenes(); renderStock();
  }
  $('#btnAgregarColor').addEventListener('click', agregarColor);
  $('#pColorNuevo').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); agregarColor(); } });
  $('#pColores').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-i]');
    if (!b) return;
    const [quitado] = estado.colores.splice(+b.dataset.i, 1);
    delete estado.imagenes[quitado];
    renderColores(); renderImagenes(); renderStock();
  });

  // Variantes
  function renderVariantes() {
    const conVar = estado.variantes.length > 0;
    $('#pPrecio').disabled = conVar;
    $('#pPrecio').placeholder = conVar ? 'Se usa el precio de cada variante' : 'Vacío = precio por confirmar';
    $('#pVariantes').innerHTML = estado.variantes.map((v, i) => `
      <div class="admin-variante" data-i="${i}">
        <input type="text" data-campo="nombre" value="${esc(v.nombre)}" placeholder="Ej: Burda" aria-label="Nombre de la variante" />
        <input type="text" data-campo="precio" inputmode="numeric" value="${v.precio != null ? Number(v.precio).toLocaleString('es-CO') : ''}" placeholder="Precio" aria-label="Precio de la variante" />
        <button type="button" class="icon-btn" data-quitar="${i}" aria-label="Quitar variante">✕</button>
      </div>`).join('');
  }
  $('#btnAgregarVariante').addEventListener('click', () => { estado.variantes.push({ nombre: '', precio: null }); renderVariantes(); $$('#pVariantes input[data-campo=nombre]').pop()?.focus(); });
  $('#pVariantes').addEventListener('input', (e) => {
    const row = e.target.closest('.admin-variante'); if (!row) return;
    const v = estado.variantes[+row.dataset.i];
    if (e.target.dataset.campo === 'nombre') v.nombre = e.target.value;
    else { v.precio = soloNumero(e.target.value); e.target.value = v.precio == null ? '' : v.precio.toLocaleString('es-CO'); }
  });
  $('#pVariantes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-quitar]'); if (!b) return;
    estado.variantes.splice(+b.dataset.quitar, 1); renderVariantes();
  });

  // Imágenes
  function renderImagenes() {
    $('#pImagenes').innerHTML = estado.colores.map((c) => `
      <div class="admin-img-color">
        <p>${esc(c)}</p>
        <div class="admin-img-slots">
          ${['frente', 'espalda'].map((vista) => {
            const url = estado.imagenes[c]?.[vista];
            return `
            <div class="admin-slot" data-color="${esc(c)}" data-vista="${vista}">
              <div class="admin-slot-img">${url ? `<img src="${esc(url)}" alt="${esc(c)} ${vista}" />` : `<span>${vista === 'frente' ? 'Frente' : 'Espalda'}</span>`}</div>
              <label class="btn-secundario admin-subir">${url ? 'Cambiar' : 'Subir'}<input type="file" accept="image/*" hidden /></label>
              ${url ? '<button type="button" class="admin-quitar-foto">Quitar</button>' : ''}
            </div>`;
          }).join('')}
        </div>
      </div>`).join('');
  }
  $('#pImagenes').addEventListener('change', async (e) => {
    if (e.target.type !== 'file' || !e.target.files[0]) return;
    const slot = e.target.closest('.admin-slot');
    const { color, vista } = slot.dataset;
    if (!idActual()) { errorEn('#editorError', 'Escribe primero el nombre del producto.'); return; }
    slot.classList.add('subiendo');
    slot.querySelector('.admin-slot-img').innerHTML = '<span>Subiendo…</span>';
    try {
      const blob = await comprimir(e.target.files[0]);
      const ruta = `${idActual()}/${slug(color)}-${vista}-${Date.now()}.webp`;
      const { error } = await sb.storage.from(BUCKET).upload(ruta, blob, { contentType: 'image/webp', cacheControl: '31536000' });
      if (error) throw error;
      const { data } = sb.storage.from(BUCKET).getPublicUrl(ruta);
      estado.imagenes[color] = { ...(estado.imagenes[color] || {}), [vista]: data.publicUrl };
      toast('Foto subida. Recuerda pulsar Guardar.');
    } catch (err) {
      errorEn('#editorError', 'No se pudo subir la foto: ' + traducir(err));
    }
    renderImagenes();
  });
  $('#pImagenes').addEventListener('click', (e) => {
    if (!e.target.closest('.admin-quitar-foto')) return;
    const { color, vista } = e.target.closest('.admin-slot').dataset;
    if (estado.imagenes[color]) {
      delete estado.imagenes[color][vista];
      if (!Object.keys(estado.imagenes[color]).length) delete estado.imagenes[color];
    }
    renderImagenes();
  });

  // Reduce la foto a máx. 1200 px y la convierte a WebP
  function comprimir(file) {
    return new Promise((resolve, reject) => {
      if (!file.type.startsWith('image/')) return reject(new Error('El archivo no es una imagen.'));
      const img = new Image();
      img.onload = () => {
        const max = 1200, k = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('No se pudo procesar la imagen.'))), 'image/webp', 0.85);
      };
      img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Guardar
  $('#formProducto').addEventListener('submit', async (e) => {
    e.preventDefault();
    errorEn('#editorError', '');
    const variantes = estado.variantes.filter((v) => v.nombre.trim() || v.precio != null);
    const fallo =
      !$('#pNombre').value.trim() ? 'Escribe el nombre.' :
      !$('#pColeccion').value.trim() ? 'Escribe la colección.' :
      !estado.colores.length ? 'Agrega al menos un color.' :
      !estado.tallas.length ? 'Marca al menos una talla.' :
      variantes.some((v) => !v.nombre.trim() || v.precio == null) ? 'Cada variante necesita nombre y precio.' : null;
    if (fallo) { errorEn('#editorError', fallo); return; }

    const imagenes = Object.fromEntries(Object.entries(estado.imagenes).filter(([c, v]) => estado.colores.includes(c) && Object.keys(v).length));
    const fila = {
      nombre: $('#pNombre').value.trim(),
      coleccion: $('#pColeccion').value.trim().toUpperCase(),
      categoria: $('#pCategoria').value,
      material: $('#pMaterial').value.trim() || null,
      tallas: estado.tallas,
      colores: estado.colores,
      precio: variantes.length ? Math.min(...variantes.map((v) => v.precio)) : soloNumero($('#pPrecio').value),
      variantes: variantes.length ? variantes.map((v) => ({ nombre: v.nombre.trim(), precio: v.precio })) : null,
      imagenes: Object.keys(imagenes).length ? imagenes : null,
      orden: parseInt($('#pOrden').value, 10) || 0,
      activo: $('#pActivo').checked,
      destacado: $('#pDestacado').checked,
      oferta_pct: Math.min(90, parseInt($('#pOfertaPct').value, 10) || 0) || null,
      oferta_hasta: (parseInt($('#pOfertaPct').value, 10) || 0) ? aFinDeDia($('#pOfertaHasta').value) : null,
      // Las columnas de preventa solo se envían si ya existen (supabase/cupones-preventa.sql)
      ...(productos.some((x) => 'preventa' in x) || $('#pPreventa').checked ? {
        preventa: $('#pPreventa').checked,
        preventa_hasta: $('#pPreventa').checked ? aFinDeDia($('#pPreventaHasta').value) : null,
        preventa_entrega: $('#pPreventa').checked ? ($('#pPreventaEntrega').value.trim() || null) : null
      } : {}),
      stock: $('#pControlStock').checked
        ? Object.fromEntries(estado.colores.flatMap((c) => estado.tallas.map((t) => [claveStock(c, t), Math.max(0, parseInt(estado.stock?.[claveStock(c, t)], 10) || 0)])))
        : null
    };

    if (fila.preventa && fila.preventa_hasta && new Date(fila.preventa_hasta) < new Date()) {
      errorEn('#editorError', 'La fecha de cierre de la preventa ya pasó. Elige una fecha futura o desmarca «En preventa».'); return;
    }
    const btn = $('#btnGuardar');
    btn.disabled = true; btn.textContent = 'Guardando…';
    const { error } = editando
      ? await sb.from('productos').update(fila).eq('id', editando.id)
      : await sb.from('productos').insert({ id: idActual(), ...fila });
    btn.disabled = false; btn.textContent = 'Guardar';
    if (error) { errorEn('#editorError', traducir(error)); return; }
    toast(editando ? 'Cambios guardados' : 'Producto creado');
    cerrarEditor();
    cargarProductos();
  });

  // Eliminar
  $('#btnBorrar').addEventListener('click', async () => {
    if (!editando) return;
    if (!window.confirm(`¿Eliminar "${editando.nombre}" para siempre?\n\nSi solo quieres sacarlo de la tienda por un tiempo, mejor desmarca "Visible en la tienda".`)) return;
    const { error } = await sb.from('productos').delete().eq('id', editando.id);
    if (error) { errorEn('#editorError', traducir(error)); return; }
    toast('Producto eliminado');
    cerrarEditor();
    cargarProductos();
  });

  // ---------- Pestaña Inventario ----------
  function renderInventario() {
    const cont = $('#inventarioLista'); if (!cont) return;
    const conCtrl = productos.filter((p) => estadoStock(p) !== 'sin-control');
    const agot = conCtrl.filter((p) => estadoStock(p) === 'agotado');
    const bajos = conCtrl.filter((p) => estadoStock(p) === 'bajo');
    const total = conCtrl.reduce((s, p) => s + unidades(p), 0);
    $('#invResumen').innerHTML = `
      <div class="inv-card"><strong>${total.toLocaleString('es-CO')}</strong><span>unidades en inventario</span></div>
      <div class="inv-card inv-card--bajo"><strong>${bajos.length}</strong><span>con tallas agotadas o pocas unidades</span></div>
      <div class="inv-card inv-card--agotado"><strong>${agot.length}</strong><span>producto${agot.length === 1 ? '' : 's'} agotado${agot.length === 1 ? '' : 's'}</span></div>
      <div class="inv-card inv-card--sin"><strong>${productos.length - conCtrl.length}</strong><span>sin control (bajo pedido)</span></div>`;
    const filtro = $('#invFiltro').value;
    const orden = { agotado: 0, bajo: 1, ok: 2, 'sin-control': 3 };
    const lista = productos.filter((p) => filtro === 'todos' || estadoStock(p) === filtro || (filtro === 'controlados' && estadoStock(p) !== 'sin-control'))
      .sort((a, b) => orden[estadoStock(a)] - orden[estadoStock(b)] || a.orden - b.orden);
    cont.innerHTML = lista.length ? lista.map((p) => {
      const e = estadoStock(p);
      const faltan = e === 'sin-control' ? [] : p.colores.flatMap((c) => p.tallas.filter((t) => (parseInt(p.stock[`${c}|${t}`], 10) || 0) <= 3).map((t) => `${c} ${t}: ${parseInt(p.stock[`${c}|${t}`], 10) || 0}`));
      const foto = primeraFoto(p);
      return `
      <article class="admin-item inv-item inv-${e}${p.activo ? '' : ' is-oculto'}" data-id="${esc(p.id)}">
        <div class="admin-thumb">${foto ? `<img src="${esc(foto)}" alt="" loading="lazy" />` : `<span>${esc(p.coleccion)}</span>`}</div>
        <div class="admin-item-info">
          <h3>${esc(p.nombre)}</h3>
          <p class="admin-meta">${e === 'sin-control' ? 'Sin control de inventario (se vende sin límite)'
            : e === 'agotado' ? 'Agotado en todas las tallas y colores'
            : `${unidades(p)} unidades${faltan.length ? ` · Revisar: ${esc(faltan.slice(0, 6).join(' · '))}${faltan.length > 6 ? ` y ${faltan.length - 6} más` : ''}` : ''}`}</p>
        </div>
        <div class="admin-item-acciones">
          <span class="inv-estado">${{ agotado: 'Agotado', bajo: 'Revisar', ok: 'OK', 'sin-control': 'Sin control' }[e]}</span>
          <button type="button" class="btn-secundario" data-inv-editar>Editar unidades</button>
        </div>
      </article>`;
    }).join('') : '<p class="admin-cargando">No hay productos con ese filtro.</p>';
  }
  $('#invFiltro')?.addEventListener('change', renderInventario);
  $('#inventarioLista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-inv-editar]'); if (!b) return;
    abrirEditor(productos.find((p) => p.id === b.closest('[data-id]').dataset.id));
    if (!$('#pControlStock').checked) { $('#pControlStock').checked = true; renderStock(); }
    setTimeout(() => $('#pStockFieldset')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  });
  document.addEventListener('admin:seccion', (e) => { if (e.detail === 'inventario') renderInventario(); });

  // Utilidades compartidas con js/admin-contenido.js
  async function subirImagen(file, carpeta) {
    const blob = await comprimir(file);
    const ruta = `${carpeta}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.webp`;
    const { error } = await sb.storage.from(BUCKET).upload(ruta, blob, { contentType: 'image/webp', cacheControl: '31536000' });
    if (error) throw error;
    return sb.storage.from(BUCKET).getPublicUrl(ruta).data.publicUrl;
  }
  window.AdminCore = { sb, toast, esc, slug, traducir, subirImagen, errorEn, recargarProductos: () => cargarProductos(), get productos() { return productos; } };

  sb.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') revisarSesion(); });
  revisarSesion();
})();
