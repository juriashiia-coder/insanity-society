/* =========================================================
   INSANITY SOCIETY — Pedidos y Estadísticas (panel)
   Los pedidos se guardan solos cuando un cliente compra por la web
   (función crear_pedido en Supabase). Aquí se confirman, se registran
   ventas hechas por fuera de la web y se ven las estadísticas.
   ========================================================= */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  const ESTADOS = { pendiente: 'Pendiente', confirmado: 'Confirmado', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
  const VENDIDOS = new Set(['confirmado', 'enviado', 'entregado']);
  const CANALES = { web: 'Web', whatsapp: 'WhatsApp', instagram: 'Instagram', presencial: 'En persona', otro: 'Otro' };
  const DEPARTAMENTOS = ['Amazonas', 'Antioquia', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas', 'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía', 'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander', 'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre', 'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada'];
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

  let core = null;
  let pedidos = [];
  let cargados = false;
  let cargando = null;
  let mostrarHasta = 50;
  let abierto = null;
  let embNombres = null; // id -> nombre (null si embajadores no está activado)

  const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const numero = (n) => Math.round(Number(n) || 0).toLocaleString('es-CO');
  const soloNumero = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d ? parseInt(d, 10) : 0; };
  const e = (s) => core.esc(s);

  // ---------- Fechas en hora de Colombia (UTC-5, sin horario de verano) ----------
  const OFF = 5 * 3600 * 1000;
  const diaCo = (t) => new Date(new Date(t).getTime() - OFF).toISOString().slice(0, 10); // YYYY-MM-DD
  const hoyCo = () => diaCo(Date.now());
  const sumarDias = (ymd, n) => { const d = new Date(`${ymd}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
  const textoDia = (ymd, conAnio) => { const [y, m, d] = ymd.split('-').map(Number); return `${d} ${MESES[m - 1]}${conAnio ? ' ' + y : ''}`; };
  const fechaHora = (t) => {
    const d = new Date(new Date(t).getTime() - OFF);
    const y = d.getUTCFullYear(), anio = y !== new Date().getFullYear();
    return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}${anio ? ' ' + y : ''} · ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`;
  };

  const resumenItems = (p) => (p.items || []).map((i) => `${i.cantidad}× ${i.nombre} (${[i.preventa ? 'PREVENTA' : '', i.variante, i.color, i.talla].filter(Boolean).join(' · ')})`).join(', ');
  const unidadesDe = (p) => (p.items || []).reduce((s, i) => s + (Number(i.cantidad) || 0), 0);
  const lugarDe = (p) => [p.ciudad, p.departamento].filter(Boolean).join(', ');

  function mostrarError(msg) {
    ['#pedidosError', '#estadisticasError'].forEach((sel) => core.errorEn(sel, msg));
  }

  // ---------- Carga ----------
  async function cargar(forzar = false) {
    if (cargados && !forzar) return true;
    if (cargando) return cargando;
    cargando = (async () => {
      const todos = [];
      const PAG = 1000;
      for (let desde = 0; ; desde += PAG) {
        const { data, error } = await core.sb.from('pedidos').select('*')
          .order('fecha', { ascending: false }).order('id', { ascending: false }).range(desde, desde + PAG - 1);
        if (error) { mostrarError(core.traducir(error)); return false; }
        todos.push(...data);
        if (data.length < PAG) break;
      }
      mostrarError('');
      pedidos = todos; cargados = true;
      // Nombres de embajadores (si la función está activada)
      const re = await core.sb.from('embajadores').select('id, nombre');
      embNombres = re.error ? null : Object.fromEntries((re.data || []).map((x) => [x.id, x.nombre]));
      actualizarPendientes();
      return true;
    })();
    try { return await cargando; } finally { cargando = null; }
  }

  function actualizarPendientes(n = pedidos.filter((p) => p.estado === 'pendiente').length) {
    const b = $('#tabPendientes'); if (!b) return;
    b.textContent = n; b.classList.toggle('hidden', !n);
  }

  document.addEventListener('admin:listo', async () => {
    core = window.AdminCore;
    $('#listaDepartamentos').innerHTML = DEPARTAMENTOS.map((d) => `<option value="${e(d)}">`).join('');
    // Número de pendientes en la pestaña (consulta liviana; si la tabla aún no existe, no pasa nada)
    const { count, error } = await core.sb.from('pedidos').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente');
    if (!error) actualizarPendientes(count || 0);
  });
  document.addEventListener('admin:seccion', async (ev) => {
    if (ev.detail === 'pedidos') {
      if (!cargados) $('#listaPedidos').innerHTML = '<p class="admin-cargando">Cargando pedidos…</p>';
      if (await cargar(true)) renderPedidos();
      else $('#listaPedidos').innerHTML = '';
    }
    if (ev.detail === 'estadisticas') {
      if (!cargados) $('#estKpis').innerHTML = '<p class="admin-cargando">Cargando…</p>';
      if (await cargar(true)) renderEstadisticas();
      else $('#estKpis').innerHTML = '';
    }
  });

  // =========================================================
  // PEDIDOS
  // =========================================================
  const opcionesEstado = (actual) => Object.entries(ESTADOS).map(([k, v]) => `<option value="${k}" ${k === actual ? 'selected' : ''}>${v}</option>`).join('');

  function filtrados() {
    const filtro = $('#pedFiltro').value;
    const q = core.slug($('#pedBuscar').value.trim());
    const qNum = $('#pedBuscar').value.replace(/\D/g, '');
    return pedidos.filter((p) => (filtro === 'todos' || p.estado === filtro) && (!q
      || core.slug([p.cliente_nombre, p.ciudad, p.departamento, resumenItems(p)].join(' ')).includes(q)
      || (qNum && (String(p.id).includes(qNum) || String(p.celular || '').includes(qNum)))));
  }

  function renderPedidos() {
    const lista = filtrados();
    const pend = pedidos.filter((p) => p.estado === 'pendiente').length;
    $('#pedidosConteo').textContent = `${pedidos.length} en total${pend ? ` · ${pend} pendiente${pend === 1 ? '' : 's'}` : ''}`;
    const visibles = lista.slice(0, mostrarHasta);
    $('#listaPedidos').innerHTML = visibles.length ? visibles.map((p) => `
      <article class="admin-item ped-item ped-${p.estado}" data-id="${p.id}">
        <div class="ped-num">#${p.id}<small>${e(fechaHora(p.fecha))}</small></div>
        <div class="admin-item-info">
          <h3>${e(p.cliente_nombre || 'Sin nombre')}${lugarDe(p) ? ` <span class="ped-lugar">· ${e(lugarDe(p))}</span>` : ''}</h3>
          <p class="admin-meta ped-resumen">${e(resumenItems(p))}</p>
          <p class="ped-total">${dinero(p.total)} <span class="admin-meta">· ${e(CANALES[p.canal] || p.canal)}${p.cupon ? ' · ' + e(p.cupon) : ''}${p.guia ? ' · Guía ' + e(p.guia) : ''}</span></p>
        </div>
        <div class="admin-item-acciones">
          <select class="ped-estado" data-accion="estado" aria-label="Estado del pedido #${p.id}">${opcionesEstado(p.estado)}</select>
          <button type="button" class="btn-secundario" data-accion="ver">Ver</button>
        </div>
      </article>`).join('')
      : `<p class="admin-cargando">${pedidos.length ? 'Ningún pedido coincide con la búsqueda.' : 'Aún no hay pedidos. Aparecerán aquí cuando alguien compre por la web, o regístralos con “+ Registrar venta”.'}</p>`;
    $('#pedMas').classList.toggle('hidden', lista.length <= mostrarHasta);
  }

  $('#pedFiltro').addEventListener('change', () => { mostrarHasta = 50; renderPedidos(); });
  $('#pedBuscar').addEventListener('input', () => { mostrarHasta = 50; renderPedidos(); });
  $('#pedMas').addEventListener('click', () => { mostrarHasta += 50; renderPedidos(); });

  async function cambiarEstado(id, estado) {
    const p = pedidos.find((x) => x.id === id); if (!p || p.estado === estado) return;
    const antes = p.estado;
    const { error } = await core.sb.from('pedidos').update({ estado }).eq('id', id);
    if (error) { core.toast(core.traducir(error)); renderPedidos(); return; }
    p.estado = estado;
    const msg = VENDIDOS.has(estado) && !VENDIDOS.has(antes) ? ' · cuenta como venta'
      : !VENDIDOS.has(estado) && VENDIDOS.has(antes) ? ' · ya no cuenta como venta' : '';
    core.toast(`Pedido #${id}: ${ESTADOS[estado]}${msg}`);
    actualizarPendientes();
    renderPedidos();
    if (abierto === id) abrirPedido(id);
    if (msg) core.recargarProductos?.();
  }

  $('#listaPedidos').addEventListener('change', (ev) => {
    const s = ev.target.closest('select[data-accion="estado"]'); if (!s) return;
    cambiarEstado(Number(s.closest('[data-id]').dataset.id), s.value);
  });
  $('#listaPedidos').addEventListener('click', (ev) => {
    const b = ev.target.closest('button[data-accion="ver"]'); if (!b) return;
    abrirPedido(Number(b.closest('[data-id]').dataset.id));
  });

  // ---------- Detalle ----------
  function abrirPedido(id) {
    const p = pedidos.find((x) => x.id === id); if (!p) return;
    abierto = id;
    const cel = String(p.celular || '').replace(/\D/g, '');
    const fila = (k, v) => (v ? `<tr><th>${k}</th><td>${e(v)}</td></tr>` : '');
    $('#pedidoTitulo').textContent = `Pedido #${p.id}`;
    $('#pedidoBody').innerHTML = `
      <div class="ped-detalle-head">
        <span class="admin-meta">${e(fechaHora(p.fecha))} · ${e(CANALES[p.canal] || p.canal)}</span>
        <select id="pedEstadoModal" class="ped-estado" aria-label="Estado">${opcionesEstado(p.estado)}</select>
      </div>
      <table class="ped-tabla">
        <thead><tr><th>Producto</th><th>Cant.</th><th>Valor</th></tr></thead>
        <tbody>${(p.items || []).map((i) => `<tr><td><strong>${e(i.nombre)}</strong><br><span class="admin-meta">${i.preventa ? `<span class="admin-badge admin-badge--preventa">⏳ Preventa${i.entrega ? ' · ' + e(i.entrega) : ''}</span> ` : ''}${e([i.variante, i.color, i.talla].filter(Boolean).join(' · '))}${i.oferta ? ` · oferta -${i.oferta}%` : ''}</span></td><td>${i.cantidad}</td><td>${dinero(i.precio * i.cantidad)}</td></tr>`).join('')}</tbody>
        <tfoot>
          ${p.descuento ? `<tr><th colspan="2">Subtotal</th><td>${dinero(p.subtotal)}</td></tr><tr><th colspan="2">Descuento${p.cupon ? ' (' + e(p.cupon) + ')' : ''}</th><td>−${dinero(p.descuento)}</td></tr>` : ''}
          <tr class="ped-tabla-total"><th colspan="2">Total</th><td>${dinero(p.total)}</td></tr>
        </tfoot>
      </table>
      <div class="ped-guia">
        <label for="pedGuia">Guía de envío <small class="admin-hint">(el cliente la ve en «Mis pedidos»)</small></label>
        <div class="ped-guia-fila">
          <input id="pedGuia" type="text" maxlength="120" placeholder="Ej: Servientrega 2190000001" value="${e(p.guia || '')}" />
          <button id="pedGuiaGuardar" class="btn-secundario" type="button">Guardar</button>
        </div>
      </div>
      <table class="ped-cliente">
        ${fila('Nombre', p.cliente_nombre)}${fila('Cédula', p.cedula)}${fila('Celular', p.celular)}
        ${fila('Ciudad', lugarDe(p))}${fila('Dirección', p.direccion)}${fila('Barrio', p.barrio)}${fila('Notas', p.notas)}
      </table>
      ${cel ? `<a class="btn-secundario ped-wa" href="https://wa.me/${cel.length === 10 ? '57' + cel : cel}?text=${encodeURIComponent(`Hola ${p.cliente_nombre || ''}, te escribimos de Insanity Society por tu pedido #${p.id}.`)}" target="_blank" rel="noopener">Escribirle por WhatsApp</a>` : ''}`;
    $('#pedEstadoModal').addEventListener('change', (ev) => cambiarEstado(id, ev.target.value));
    $('#pedGuiaGuardar').addEventListener('click', async () => {
      const guia = $('#pedGuia').value.trim() || null;
      const btn = $('#pedGuiaGuardar'); btn.disabled = true;
      const { error } = await core.sb.from('pedidos').update({ guia }).eq('id', id);
      btn.disabled = false;
      if (error) {
        core.toast(/guia/i.test(error.message || '') ? 'Falta activar «Mis pedidos»: ejecuta supabase/mis-pedidos.sql en Supabase.' : core.traducir(error));
        return;
      }
      p.guia = guia;
      core.toast(guia ? `Guía guardada en el pedido #${id}` : `Guía borrada del pedido #${id}`);
      renderPedidos();
    });
    $('#pedidoModal').classList.remove('hidden');
    $('#cerrarPedido').focus();
  }
  function cerrarPedido() { abierto = null; $('#pedidoModal').classList.add('hidden'); }
  $('#cerrarPedido').addEventListener('click', cerrarPedido);
  $('#btnCerrarPedido').addEventListener('click', cerrarPedido);
  $('#pedidoModal').addEventListener('click', (ev) => { if (ev.target.id === 'pedidoModal') cerrarPedido(); });
  $('#btnBorrarPedido').addEventListener('click', async () => {
    const p = pedidos.find((x) => x.id === abierto); if (!p) return;
    if (!confirm(`¿Eliminar el pedido #${p.id}? Esta acción no se puede deshacer.${p.stock_descontado ? '\nLas unidades vuelven al inventario.' : ''}`)) return;
    const { error } = await core.sb.from('pedidos').delete().eq('id', p.id);
    if (error) { core.toast(core.traducir(error)); return; }
    pedidos = pedidos.filter((x) => x.id !== p.id);
    if (p.stock_descontado) core.recargarProductos?.();
    cerrarPedido(); actualizarPendientes(); renderPedidos();
    core.toast(`Pedido #${p.id} eliminado`);
  });

  // ---------- Registrar venta (Instagram, en persona, etc.) ----------
  const productosAdmin = () => [...(core.productos || [])].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
  const precioBase = (p, variante) => (p?.variantes?.find((v) => v.nombre === variante)?.precio ?? p?.precio ?? 0);

  function filaItem() {
    const prods = productosAdmin();
    const div = document.createElement('div');
    div.className = 'venta-item';
    div.innerHTML = `
      <select data-c="producto" aria-label="Producto"><option value="">Producto…</option>${prods.map((p) => `<option value="${e(p.id)}">${e(p.nombre)}${p.activo ? '' : ' (oculto)'}</option>`).join('')}</select>
      <select data-c="variante" aria-label="Versión" class="hidden"></select>
      <select data-c="color" aria-label="Color"></select>
      <select data-c="talla" aria-label="Talla"></select>
      <input data-c="cantidad" type="number" min="1" max="99" value="1" aria-label="Cantidad" />
      <input data-c="precio" type="text" inputmode="numeric" placeholder="Precio" aria-label="Precio unitario" />
      <button type="button" class="icon-btn" data-c="quitar" aria-label="Quitar">✕</button>`;
    return div;
  }
  function llenarItem(div) {
    const p = (core.productos || []).find((x) => x.id === div.querySelector('[data-c=producto]').value);
    const opts = (arr) => (arr || []).map((v) => `<option value="${e(v)}">${e(v)}</option>`).join('');
    const sv = div.querySelector('[data-c=variante]');
    const tieneVar = p?.variantes?.length > 0;
    sv.classList.toggle('hidden', !tieneVar);
    sv.innerHTML = tieneVar ? opts(p.variantes.map((v) => v.nombre)) : '';
    div.querySelector('[data-c=color]').innerHTML = opts(p?.colores);
    div.querySelector('[data-c=talla]').innerHTML = opts(p?.tallas);
    div.querySelector('[data-c=precio]').value = p ? numero(precioBase(p, sv.value || undefined)) : '';
  }
  function totalVenta() {
    const sub = $$('.venta-item', $('#vItems')).reduce((s, d) => s + soloNumero(d.querySelector('[data-c=precio]').value) * (parseInt(d.querySelector('[data-c=cantidad]').value, 10) || 0), 0);
    const desc = Math.min(soloNumero($('#vDescuento').value), sub);
    $('#vTotal').textContent = dinero(sub - desc) + (desc ? `  (subtotal ${dinero(sub)})` : '');
    return { sub, desc };
  }
  $('#vAgregarItem').addEventListener('click', () => { $('#vItems').append(filaItem()); });
  $('#vItems').addEventListener('change', (ev) => {
    const div = ev.target.closest('.venta-item'); if (!div) return;
    const c = ev.target.dataset.c;
    if (c === 'producto') llenarItem(div);
    if (c === 'variante') {
      const p = (core.productos || []).find((x) => x.id === div.querySelector('[data-c=producto]').value);
      div.querySelector('[data-c=precio]').value = numero(precioBase(p, ev.target.value));
    }
    totalVenta();
  });
  $('#vItems').addEventListener('input', totalVenta);
  $('#vItems').addEventListener('click', (ev) => {
    if (ev.target.closest('[data-c=quitar]')) { ev.target.closest('.venta-item').remove(); totalVenta(); }
  });
  $('#vDescuento').addEventListener('input', totalVenta);

  async function cargarCodigosEmbajadores() {
    const sel = $('#vCupon'); if (!sel) return;
    sel.innerHTML = '<option value="">Ninguno</option>';
    const [rc, re] = await Promise.all([
      core.sb.from('cupones').select('codigo, valor, embajador_id').not('embajador_id', 'is', null),
      core.sb.from('embajadores').select('id, nombre')
    ]);
    const error = rc.error || re.error;
    const nombres = Object.fromEntries((re.data || []).map((x) => [x.id, x.nombre]));
    const data = (rc.data || []).map((c) => ({ ...c, nombre: nombres[c.embajador_id] || 'embajador' }));
    sel.closest('.form-row').hidden = !!error || !data.length;
    data.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .forEach((c) => sel.add(new Option(`${c.codigo} — ${c.nombre} (−${c.valor}%)`, c.codigo)));
  }
  function abrirVenta() {
    $('#formVenta').reset();
    cargarCodigosEmbajadores();
    $('#vFecha').value = hoyCo();
    $('#vFecha').max = hoyCo();
    $('#vItems').innerHTML = '';
    $('#vItems').append(filaItem());
    core.errorEn('#ventaError', '');
    totalVenta();
    $('#ventaModal').classList.remove('hidden');
    $('#vItems select').focus();
  }
  const cerrarVenta = () => $('#ventaModal').classList.add('hidden');
  $('#btnNuevaVenta').addEventListener('click', abrirVenta);
  $('#cerrarVenta').addEventListener('click', cerrarVenta);
  $('#btnCancelarVenta').addEventListener('click', cerrarVenta);
  $('#ventaModal').addEventListener('click', (ev) => { if (ev.target.id === 'ventaModal') cerrarVenta(); });

  $('#formVenta').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    core.errorEn('#ventaError', '');
    const items = [];
    for (const d of $$('.venta-item', $('#vItems'))) {
      const p = (core.productos || []).find((x) => x.id === d.querySelector('[data-c=producto]').value);
      if (!p) continue;
      const cantidad = parseInt(d.querySelector('[data-c=cantidad]').value, 10) || 0;
      if (cantidad < 1) { core.errorEn('#ventaError', `Revisa la cantidad de ${p.nombre}.`); return; }
      const variante = d.querySelector('[data-c=variante]').value || null;
      items.push({ id: p.id, nombre: p.nombre, coleccion: p.coleccion, categoria: p.categoria,
        color: d.querySelector('[data-c=color]').value, talla: d.querySelector('[data-c=talla]').value,
        variante, cantidad, precio: soloNumero(d.querySelector('[data-c=precio]').value), oferta: 0 });
    }
    if (!items.length) { core.errorEn('#ventaError', 'Agrega al menos un producto.'); return; }
    const { sub, desc } = totalVenta();
    const dia = $('#vFecha').value || hoyCo();
    const fecha = dia === hoyCo() ? new Date().toISOString() : `${dia}T12:00:00-05:00`;
    const fila = {
      fecha, estado: $('#vEstado').value, canal: $('#vCanal').value, items,
      subtotal: sub, descuento: desc, total: sub - desc,
      ...($('#vCupon')?.value ? { cupon: $('#vCupon').value } : {}),
      cliente_nombre: $('#vNombre').value.trim() || null, celular: $('#vCelular').value.replace(/\D/g, '') || null,
      departamento: $('#vDepartamento').value.trim() || null, ciudad: $('#vCiudad').value.trim() || null,
      notas: $('#vNotas').value.trim() || null
    };
    const btn = $('#btnGuardarVenta'); btn.disabled = true;
    const { data, error } = await core.sb.from('pedidos').insert(fila).select().single();
    btn.disabled = false;
    if (error) { core.errorEn('#ventaError', core.traducir(error)); return; }
    pedidos.unshift(data);
    pedidos.sort((a, b) => new Date(b.fecha) - new Date(a.fecha) || b.id - a.id);
    cerrarVenta(); actualizarPendientes();
    if (!$('#subPedidos').classList.contains('hidden')) renderPedidos();
    if (!$('#subEstadisticas').classList.contains('hidden')) renderEstadisticas();
    if (VENDIDOS.has(fila.estado)) core.recargarProductos?.();
    core.toast(`Venta #${data.id} registrada`);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!$('#ventaModal').classList.contains('hidden')) cerrarVenta();
    else if (!$('#pedidoModal').classList.contains('hidden')) cerrarPedido();
  });

  // =========================================================
  // ESTADÍSTICAS
  // =========================================================
  let periodo = '30d';

  function rangoPeriodo() {
    const hoy = hoyCo();
    switch (periodo) {
      case 'hoy': return [hoy, hoy];
      case '7d': return [sumarDias(hoy, -6), hoy];
      case '30d': return [sumarDias(hoy, -29), hoy];
      case 'mes': return [hoy.slice(0, 8) + '01', hoy];
      case 'anio': return [hoy.slice(0, 5) + '01-01', hoy];
      case 'todo': {
        const primero = pedidos.length ? diaCo(pedidos[pedidos.length - 1].fecha) : hoy;
        return [primero < hoy ? primero : hoy, hoy];
      }
      default: {
        let d = $('#estDesde').value || hoy, h = $('#estHasta').value || hoy;
        if (d > h) [d, h] = [h, d];
        return [d, h];
      }
    }
  }
  const enRango = (p, [d, h]) => { const k = diaCo(p.fecha); return k >= d && k <= h; };

  $$('.est-chip').forEach((b) => b.addEventListener('click', () => {
    periodo = b.dataset.periodo;
    $$('.est-chip').forEach((x) => x.classList.toggle('is-activo', x === b));
    renderEstadisticas();
  }));
  ['#estDesde', '#estHasta'].forEach((sel) => $(sel).addEventListener('change', () => {
    periodo = 'rango';
    $$('.est-chip').forEach((x) => x.classList.remove('is-activo'));
    renderEstadisticas();
  }));
  $('#estOrdenProd').addEventListener('change', () => renderEstadisticas());
  $('#estLugar').addEventListener('change', () => renderEstadisticas());

  function metricas(lista) {
    const ventas = lista.reduce((s, p) => s + (Number(p.total) || 0), 0);
    const unidades = lista.reduce((s, p) => s + unidadesDe(p), 0);
    return { ventas, pedidos: lista.length, unidades, ticket: lista.length ? ventas / lista.length : 0 };
  }
  function variacion(act, ant) {
    if (ant == null) return '';
    if (!ant) return act ? '<span class="est-var est-var--sube">nuevo</span>' : '<span class="est-var">—</span>';
    const pct = Math.round(((act - ant) / ant) * 100);
    const cls = pct > 0 ? 'est-var--sube' : pct < 0 ? 'est-var--baja' : '';
    return `<span class="est-var ${cls}" title="Frente al periodo anterior">${pct > 0 ? '▲' : pct < 0 ? '▼' : ''} ${Math.abs(pct)}%</span>`;
  }

  // Agrupa y suma; devuelve [{clave, etiqueta, u, v, n}] ordenado
  function agrupar(lista, fn, orden = 'u') {
    const m = new Map();
    lista.forEach((p) => fn(p).forEach(({ clave, etiqueta, u = 0, v = 0, n = 0 }) => {
      if (!clave) return;
      const a = m.get(clave) || { clave, etiqueta: etiqueta || clave, u: 0, v: 0, n: 0 };
      a.u += u; a.v += v; a.n += n;
      m.set(clave, a);
    }));
    return [...m.values()].sort((a, b) => b[orden] - a[orden] || b.v - a.v);
  }
  const porItem = (fn) => (p) => (p.items || []).map((i) => ({ ...fn(i), u: Number(i.cantidad) || 0, v: (Number(i.precio) || 0) * (Number(i.cantidad) || 0) }));

  // Lista de barras horizontales (un solo color; el valor siempre va escrito)
  function barras(sel, filas, { medida = 'u', valor, vacio = 'Sin datos en este periodo.', max = 8 } = {}) {
    const cont = $(sel);
    if (!filas.length) { cont.innerHTML = `<p class="est-vacio">${vacio}</p>`; return; }
    let top = filas.slice(0, max);
    if (filas.length > max) {
      const resto = filas.slice(max);
      top = [...top, { clave: '__otros', etiqueta: `Otros (${resto.length})`, u: resto.reduce((s, x) => s + x.u, 0), v: resto.reduce((s, x) => s + x.v, 0), n: resto.reduce((s, x) => s + x.n, 0), otros: true }];
    }
    const mayor = Math.max(...top.map((f) => f[medida]), 1);
    cont.innerHTML = `<ol class="est-barras">${top.map((f) => `
      <li class="${f.otros ? 'is-otros' : ''}">
        <span class="est-barras-txt"><span class="est-barras-nombre">${e(f.etiqueta)}</span><span class="est-barras-valor">${valor(f)}</span></span>
        <span class="est-barras-pista"><span class="est-barras-barra" style="width:${Math.max(1.5, (f[medida] / mayor) * 100)}%"></span></span>
      </li>`).join('')}</ol>`;
  }

  // Serie de tiempo: barras verticales con tooltip
  function serie(lista, [d, h]) {
    const dias = diasEntre(d, h) + 1;
    const gran = dias <= 62 ? 'dia' : dias <= 200 ? 'semana' : 'mes';
    const claveDe = (ymd) => {
      if (gran === 'dia') return ymd;
      if (gran === 'mes') return ymd.slice(0, 7);
      const dow = (new Date(`${ymd}T12:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
      return sumarDias(ymd, -dow);
    };
    const cubetas = new Map();
    for (let k = d; k <= h; k = sumarDias(k, 1)) { const c = claveDe(k); if (!cubetas.has(c)) cubetas.set(c, { c, v: 0, n: 0 }); }
    lista.forEach((p) => { const b = cubetas.get(claveDe(diaCo(p.fecha))); if (b) { b.v += Number(p.total) || 0; b.n += 1; } });
    const arr = [...cubetas.values()];
    const varios = d.slice(0, 4) !== h.slice(0, 4);
    const etiqueta = (c) => gran === 'mes' ? `${MESES[Number(c.slice(5, 7)) - 1]}${varios ? ' ' + c.slice(2, 4) : ''}`
      : gran === 'semana' ? `${textoDia(c)}` : textoDia(c);
    const etiquetaLarga = (c) => gran === 'mes' ? `${MESES[Number(c.slice(5, 7)) - 1]} ${c.slice(0, 4)}`
      : gran === 'semana' ? `Semana del ${textoDia(c, true)}` : textoDia(c, true);
    $('#estSerieTitulo').textContent = `Ventas por ${gran === 'dia' ? 'día' : gran}`;

    const mayor = Math.max(...arr.map((b) => b.v));
    if (!mayor) { $('#estSerie').innerHTML = '<p class="est-vacio">Sin ventas en este periodo.</p>'; return; }
    // Escala "redonda" para las líneas guía
    const paso = Math.pow(10, Math.floor(Math.log10(mayor)));
    const techo = Math.ceil(mayor / paso) * paso;
    const corto = (n) => n >= 1e6 ? `$${(n / 1e6).toLocaleString('es-CO', { maximumFractionDigits: 1 })} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} mil` : dinero(n);
    const maxEtiquetas = Math.max(3, Math.floor(($('#estSerie').clientWidth - 60) / 62));
    const cadaCuanto = Math.max(1, Math.ceil(arr.length / maxEtiquetas));
    $('#estSerie').innerHTML = `
      <div class="est-serie-plot">
        <div class="est-guias" aria-hidden="true">
          <span style="bottom:100%"><i>${corto(techo)}</i></span>
          <span style="bottom:50%"><i>${corto(techo / 2)}</i></span>
          <span style="bottom:0"><i>$0</i></span>
        </div>
        <div class="est-columnas" style="--n:${arr.length}">
          ${arr.map((b, i) => `<button type="button" class="est-col" data-tip="${e(etiquetaLarga(b.c))}|${dinero(b.v)}|${b.n} pedido${b.n === 1 ? '' : 's'}" aria-label="${e(etiquetaLarga(b.c))}: ${dinero(b.v)}, ${b.n} pedidos">
              <span class="est-col-barra" style="height:${(b.v / techo) * 100}%"></span>
              <span class="est-col-x">${i % cadaCuanto === 0 ? e(etiqueta(b.c)) : ''}</span>
            </button>`).join('')}
        </div>
      </div>`;
  }

  // Tooltip de la serie (mouse y toque)
  const tip = $('#estTip');
  function mostrarTip(btn, x, y) {
    const [t, v, n] = btn.dataset.tip.split('|');
    tip.innerHTML = `<strong>${e(t)}</strong><span>${e(v)}</span><small>${e(n)}</small>`;
    tip.classList.remove('hidden');
    const r = tip.getBoundingClientRect();
    tip.style.left = `${Math.min(window.innerWidth - r.width - 8, Math.max(8, x - r.width / 2))}px`;
    tip.style.top = `${Math.max(8, y - r.height - 14)}px`;
    $$('.est-col.is-hover').forEach((c) => c.classList.remove('is-hover'));
    btn.classList.add('is-hover');
  }
  const ocultarTip = () => { tip.classList.add('hidden'); $$('.est-col.is-hover').forEach((c) => c.classList.remove('is-hover')); };
  $('#estSerie').addEventListener('pointermove', (ev) => { const b = ev.target.closest('.est-col'); if (b) mostrarTip(b, ev.clientX, ev.clientY); else ocultarTip(); });
  $('#estSerie').addEventListener('pointerleave', ocultarTip);
  $('#estSerie').addEventListener('focusin', (ev) => { const b = ev.target.closest('.est-col'); if (b) { const r = b.getBoundingClientRect(); mostrarTip(b, r.left + r.width / 2, r.top + r.height * .4); } });
  $('#estSerie').addEventListener('focusout', ocultarTip);
  // En celular: tocar una barra muestra su valor
  $('#estSerie').addEventListener('click', (ev) => {
    const b = ev.target.closest('.est-col'); if (!b) return;
    const r = b.getBoundingClientRect();
    setTimeout(() => mostrarTip(b, r.left + r.width / 2, Math.max(60, r.top + r.height * .4)), 0);
  });
  window.addEventListener('scroll', ocultarTip, { passive: true });
  let anchoEst = 0, finResize;
  window.addEventListener('resize', () => {
    clearTimeout(finResize);
    finResize = setTimeout(() => {
      const w = $('#estSerie').clientWidth;
      if (cargados && w && w !== anchoEst && !$('#subEstadisticas').classList.contains('hidden')) { anchoEst = w; renderEstadisticas(); }
    }, 200);
  });

  function renderEstadisticas() {
    const rango = rangoPeriodo();
    const [d, h] = rango;
    $('#estDesde').value = d; $('#estHasta').value = h;
    $('#estDesde').max = $('#estHasta').max = hoyCo();
    const dias = diasEntre(d, h) + 1;
    $('#estPeriodoTxt').textContent = d === h ? `Mostrando: ${textoDia(d, true)}` : `Mostrando: ${textoDia(d, true)} — ${textoDia(h, true)} (${dias} días)`;

    const vend = pedidos.filter((p) => VENDIDOS.has(p.estado) && enRango(p, rango));
    const pend = pedidos.filter((p) => p.estado === 'pendiente' && enRango(p, rango));
    const m = metricas(vend);
    let ant = null;
    if (periodo !== 'todo') {
      const rAnt = [sumarDias(d, -dias), sumarDias(d, -1)];
      ant = metricas(pedidos.filter((p) => VENDIDOS.has(p.estado) && enRango(p, rAnt)));
    }
    const kpi = (titulo, valor, delta, extra = '') => `<div class="inv-card est-kpi"><span>${titulo}</span><strong>${valor}</strong>${delta || ''}${extra}</div>`;
    $('#estKpis').innerHTML =
      kpi('Vendido', dinero(m.ventas), ant && variacion(m.ventas, ant.ventas))
      + kpi('Pedidos', numero(m.pedidos), ant && variacion(m.pedidos, ant.pedidos))
      + kpi('Prendas vendidas', numero(m.unidades), ant && variacion(m.unidades, ant.unidades))
      + kpi('Ticket promedio', dinero(m.ticket), ant && variacion(m.ticket, ant.ticket))
      + `<div class="inv-card est-kpi est-kpi--pend"><span>Por confirmar</span><strong>${numero(pend.length)}</strong><small class="admin-meta">${pend.length ? dinero(pend.reduce((s, p) => s + (Number(p.total) || 0), 0)) + ' en pedidos pendientes' : 'Nada pendiente'}</small></div>`;

    serie(vend, rango);

    const ordenProd = $('#estOrdenProd').value;
    barras('#estProductos', agrupar(vend, porItem((i) => ({ clave: i.id || i.nombre, etiqueta: i.nombre })), ordenProd), {
      medida: ordenProd, max: 10,
      valor: (f) => ordenProd === 'u' ? `${numero(f.u)} und · ${dinero(f.v)}` : `${dinero(f.v)} · ${numero(f.u)} und`
    });

    const porLugar = $('#estLugar').value;
    barras('#estLugares', agrupar(vend, (p) => {
      const clave = porLugar === 'ciudad' ? lugarDe(p) : p.departamento;
      return [{ clave: clave || 'Sin dato', etiqueta: clave || 'Sin dato', n: 1, u: unidadesDe(p), v: Number(p.total) || 0 }];
    }, 'n'), { medida: 'n', max: 10, valor: (f) => `${numero(f.n)} pedido${f.n === 1 ? '' : 's'} · ${dinero(f.v)}` });

    const ORDEN_TALLAS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', 'Única'];
    const tallas = agrupar(vend, porItem((i) => ({ clave: i.talla, etiqueta: i.talla })), 'u');
    barras('#estTallas', tallas.sort((a, b) => (ORDEN_TALLAS.indexOf(a.clave) + 1 || 99) - (ORDEN_TALLAS.indexOf(b.clave) + 1 || 99)), {
      max: 12, valor: (f) => `${numero(f.u)} und`
    });
    barras('#estColores', agrupar(vend, porItem((i) => ({ clave: i.color, etiqueta: i.color })), 'u'), { max: 8, valor: (f) => `${numero(f.u)} und` });
    barras('#estColecciones', agrupar(vend, porItem((i) => ({ clave: i.coleccion || 'Sin colección', etiqueta: i.coleccion || 'Sin colección' })), 'v'), {
      medida: 'v', max: 8, valor: (f) => `${dinero(f.v)} · ${numero(f.u)} und`
    });
    barras('#estCanales', agrupar(vend, (p) => [{ clave: p.canal, etiqueta: CANALES[p.canal] || p.canal, n: 1, v: Number(p.total) || 0 }], 'n'), {
      medida: 'n', valor: (f) => `${numero(f.n)} pedido${f.n === 1 ? '' : 's'} · ${dinero(f.v)}`
    });
    const panelEmb = $('#estEmbajadores')?.closest('.est-panel');
    if (panelEmb) panelEmb.hidden = !embNombres;
    if (embNombres) {
      const conEmb = vend.filter((p) => p.embajador_id);
      const comisionDe = (p) => Math.round((Number(p.total) || 0) * (Number(p.comision_pct) || 0) / 100);
      const totCom = conEmb.reduce((t, p) => t + comisionDe(p), 0);
      barras('#estEmbajadores', agrupar(conEmb, (p) => [{ clave: p.embajador_id, etiqueta: embNombres[p.embajador_id] || 'Embajador eliminado', n: 1, v: Number(p.total) || 0, u: comisionDe(p) }], 'v'), {
        medida: 'v', max: 10, vacio: 'Ninguna venta con códigos de embajadores en este periodo.',
        valor: (f) => `${dinero(f.v)} vendido · ${dinero(f.u)} comisión · ${numero(f.n)} pedido${f.n === 1 ? '' : 's'}`
      });
      if (conEmb.length) $('#estEmbajadores').insertAdjacentHTML('beforeend', `<p class="admin-hint est-emb-total">Total: ${dinero(conEmb.reduce((t, p) => t + (Number(p.total) || 0), 0))} vendido por embajadores · ${dinero(totCom)} en comisiones.</p>`);
    }
    barras('#estCupones', agrupar(vend.filter((p) => p.cupon), (p) => {
      const vip = /^(VIP|BIEN)-/.test(p.cupon);
      return [{ clave: vip ? '__vip' : p.cupon, etiqueta: vip ? 'Códigos de bienvenida (personales)' : p.cupon, n: 1, v: Number(p.descuento) || 0 }];
    }, 'n'), {
      medida: 'n', vacio: 'No se usaron códigos de descuento en este periodo.',
      valor: (f) => `${numero(f.n)} uso${f.n === 1 ? '' : 's'} · ${dinero(f.v)} descontados`
    });
  }
})();
