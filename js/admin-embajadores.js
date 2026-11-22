/* =========================================================
   INSANITY SOCIETY — Embajadores (panel)
   Códigos de descuento por embajador, comisiones, pagos y cifras.
   La comisión de cada pedido se guarda en la base (pedidos.comision_pct)
   al momento del pedido, así que cambiar el % no altera lo ya ganado.
   ========================================================= */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  let core = null;
  let embs = [];
  let cupones = [];   // códigos de embajadores
  let pedidos = [];   // pedidos con embajador
  let pagos = [];
  let editando = null;
  let pagando = null;

  const VENDIDOS = new Set(['confirmado', 'enviado', 'entregado']);
  const ESTADOS = { pendiente: 'Pendiente', confirmado: 'Confirmado', enviado: 'Enviado', entregado: 'Entregado', cancelado: 'Cancelado' };
  const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const numero = (n) => Math.round(Number(n) || 0).toLocaleString('es-CO');
  const soloNumero = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d ? parseInt(d, 10) : null; };
  const pctNum = (v) => { const n = parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
  const e = (s) => core.esc(s);
  const OFF = 5 * 3600 * 1000;
  const diaCo = (t) => new Date(new Date(t).getTime() - OFF).toISOString().slice(0, 10);
  const hoyCo = () => diaCo(Date.now());
  const fecha = (t) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
  const comisionDe = (p) => Math.round((Number(p.total) || 0) * (Number(p.comision_pct) || 0) / 100);

  document.addEventListener('admin:listo', () => { core = window.AdminCore; });
  document.addEventListener('admin:seccion', (ev) => { if (ev.detail === 'embajadores') cargar(); });

  async function todosLosPedidos() {
    const filas = [];
    for (let desde = 0; ; desde += 1000) {
      const { data, error } = await core.sb.from('pedidos')
        .select('id, fecha, estado, total, cupon, embajador_id, comision_pct, cliente_nombre, canal')
        .not('embajador_id', 'is', null).order('fecha', { ascending: false }).range(desde, desde + 999);
      if (error) return { error };
      filas.push(...data);
      if (data.length < 1000) break;
    }
    return { data: filas };
  }

  async function cargar() {
    core.errorEn('#embError', '');
    $('#embLista').innerHTML = '<p class="admin-cargando">Cargando…</p>';
    const [re, rc, rp, rg] = await Promise.all([
      core.sb.from('embajadores').select('*').order('nombre'),
      core.sb.from('cupones').select('*').not('embajador_id', 'is', null),
      todosLosPedidos(),
      core.sb.from('pagos_embajadores').select('*').order('fecha', { ascending: false })
    ]);
    const err = re.error || rc.error || rp.error || rg.error;
    if (err) {
      const falta = /embajador|pagos_embajadores|comision_pct/i.test(err.message || '') && /does not exist|schema cache|could not find/i.test(err.message || '');
      core.errorEn('#embError', falta ? 'Falta activar Embajadores: ejecuta supabase/embajadores.sql en Supabase (SQL Editor).' : core.traducir(err));
      $('#embLista').innerHTML = '';
      return;
    }
    embs = re.data || []; cupones = rc.data || []; pedidos = rp.data || []; pagos = rg.data || [];
    render();
  }

  function rango() {
    const h = hoyCo();
    const per = $('#embPeriodo').value;
    if (per === 'mes') return [h.slice(0, 8) + '01', h, 'este mes'];
    if (per === 'anio') return [h.slice(0, 5) + '01-01', h, 'este año'];
    if (per === 'mes_pasado') {
      const d = new Date(`${h.slice(0, 8)}01T12:00:00Z`); d.setUTCMonth(d.getUTCMonth() - 1);
      const ini = d.toISOString().slice(0, 10);
      const fin = new Date(`${h.slice(0, 8)}01T12:00:00Z`); fin.setUTCDate(0);
      return [ini, fin.toISOString().slice(0, 10), 'el mes pasado'];
    }
    return ['0000-01-01', '9999-12-31', 'en total'];
  }

  function cifras(id, [d, h]) {
    const suyos = pedidos.filter((p) => p.embajador_id === id && VENDIDOS.has(p.estado));
    const enPeriodo = suyos.filter((p) => { const k = diaCo(p.fecha); return k >= d && k <= h; });
    const ganado = suyos.reduce((s, p) => s + comisionDe(p), 0);
    const pagado = pagos.filter((g) => g.embajador_id === id).reduce((s, g) => s + g.monto, 0);
    return {
      pedidos: enPeriodo.length,
      ventas: enPeriodo.reduce((s, p) => s + (Number(p.total) || 0), 0),
      comision: enPeriodo.reduce((s, p) => s + comisionDe(p), 0),
      ganado, pagado, pendiente: Math.max(0, ganado - pagado),
      pendientesConfirmar: pedidos.filter((p) => p.embajador_id === id && p.estado === 'pendiente').length
    };
  }

  function render() {
    const r = rango();
    $('#embConteo').textContent = `${embs.length} embajador${embs.length === 1 ? '' : 'es'}`;
    const todas = embs.map((x) => ({ x, c: cifras(x.id, r) }));
    const tot = todas.reduce((a, { c }) => ({ pedidos: a.pedidos + c.pedidos, ventas: a.ventas + c.ventas, comision: a.comision + c.comision, pendiente: a.pendiente + c.pendiente, pagado: a.pagado + c.pagado }), { pedidos: 0, ventas: 0, comision: 0, pendiente: 0, pagado: 0 });
    $('#embResumen').innerHTML = `
      <div class="inv-card"><strong>${dinero(tot.ventas)}</strong><span>vendido con códigos ${r[2]}</span></div>
      <div class="inv-card"><strong>${numero(tot.pedidos)}</strong><span>pedido${tot.pedidos === 1 ? '' : 's'} ${r[2]}</span></div>
      <div class="inv-card"><strong>${dinero(tot.comision)}</strong><span>comisiones generadas ${r[2]}</span></div>
      <div class="inv-card ${tot.pendiente ? 'inv-card--alerta' : ''}"><strong>${dinero(tot.pendiente)}</strong><span>por pagar a embajadores (total)</span></div>`;

    if (!embs.length) {
      $('#embLista').innerHTML = '<p class="admin-cargando">Aún no hay embajadores. Crea el primero con «+ Nuevo embajador».</p>';
      return;
    }
    // Orden: más vendido en el periodo primero
    todas.sort((a, b) => b.c.ventas - a.c.ventas || a.x.nombre.localeCompare(b.x.nombre, 'es'));
    $('#embLista').innerHTML = todas.map(({ x, c }) => {
      const cup = cupones.find((k) => k.embajador_id === x.id);
      const susPedidos = pedidos.filter((p) => p.embajador_id === x.id);
      const susPagos = pagos.filter((g) => g.embajador_id === x.id);
      const ig = x.instagram ? x.instagram.replace(/^@?/, '@') : '';
      return `
      <article class="admin-item emb-item${x.activo ? '' : ' is-pausado'}" data-id="${x.id}">
        <div class="vip-avatar" aria-hidden="true">${e(x.nombre.trim().charAt(0).toUpperCase())}</div>
        <div class="admin-item-info">
          <h3>${e(x.nombre)} ${ig ? `<a class="admin-meta" href="https://instagram.com/${e(ig.slice(1))}" target="_blank" rel="noopener">${e(ig)}</a>` : ''} ${x.activo ? '' : '<span class="vip-est vip-est--off">Pausado</span>'}</h3>
          <p class="emb-cod">${cup ? `<code>${e(cup.codigo)}</code> <button type="button" class="link-btn" data-copiar="${e(cup.codigo)}">copiar</button> · cliente −${cup.valor}%${cup.minimo_compra ? ` desde ${dinero(cup.minimo_compra)}` : ''}` : '<span class="admin-meta">Sin código</span>'} · comisión <strong>${Number(x.comision_pct)}%</strong></p>
          <div class="emb-cifras">
            <span><b>${numero(c.pedidos)}</b> pedido${c.pedidos === 1 ? '' : 's'}</span>
            <span><b>${dinero(c.ventas)}</b> vendido</span>
            <span><b>${dinero(c.comision)}</b> comisión</span>
            <small class="admin-meta">${r[2]}</small>
          </div>
          <p class="admin-meta">Ganado en total ${dinero(c.ganado)} · pagado ${dinero(c.pagado)} · <strong class="${c.pendiente ? 'emb-pendiente' : ''}">por pagar ${dinero(c.pendiente)}</strong>${c.pendientesConfirmar ? ` · ${c.pendientesConfirmar} pedido${c.pendientesConfirmar === 1 ? '' : 's'} sin confirmar (aún no suman)` : ''}</p>
          <details class="emb-detalle">
            <summary>Ver pedidos (${susPedidos.length}) y pagos (${susPagos.length})</summary>
            ${susPedidos.length ? `<table class="ped-tabla emb-tabla"><thead><tr><th>Pedido</th><th>Estado</th><th>Total</th><th>Comisión</th></tr></thead><tbody>${susPedidos.slice(0, 50).map((p) => `
              <tr class="${VENDIDOS.has(p.estado) ? '' : 'emb-no-suma'}"><td>#${p.id} <span class="admin-meta">${e(fecha(p.fecha))}${p.cliente_nombre ? ' · ' + e(p.cliente_nombre) : ''}</span></td><td>${ESTADOS[p.estado] || p.estado}</td><td>${dinero(p.total)}</td><td>${VENDIDOS.has(p.estado) ? dinero(comisionDe(p)) : '—'} <span class="admin-meta">${Number(p.comision_pct)}%</span></td></tr>`).join('')}</tbody></table>` : '<p class="admin-meta">Aún no hay pedidos con su código.</p>'}
            ${susPagos.length ? `<p class="emb-sub">Pagos registrados</p><ul class="emb-pagos">${susPagos.map((g) => `<li><span>${e(fecha(g.fecha))}${g.nota ? ' · ' + e(g.nota) : ''}</span><span>${dinero(g.monto)} <button type="button" class="link-btn" data-borrar-pago="${g.id}">borrar</button></span></li>`).join('')}</ul>` : ''}
          </details>
        </div>
        <div class="admin-item-acciones">
          <button type="button" class="btn-primario" data-accion="pagar">Registrar pago</button>
          <button type="button" class="btn-secundario" data-accion="editar">Editar</button>
          ${x.celular ? `<a class="btn-secundario" href="https://wa.me/57${e(x.celular)}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        </div>
      </article>`;
    }).join('');
  }
  $('#embPeriodo').addEventListener('change', render);

  $('#embLista').addEventListener('click', async (ev) => {
    const cp = ev.target.closest('[data-copiar]');
    if (cp) { try { await navigator.clipboard.writeText(cp.dataset.copiar); core.toast(`Código ${cp.dataset.copiar} copiado`); } catch { /* */ } return; }
    const bp = ev.target.closest('[data-borrar-pago]');
    if (bp) {
      const g = pagos.find((x) => String(x.id) === bp.dataset.borrarPago); if (!g) return;
      if (!confirm(`¿Borrar el pago de ${dinero(g.monto)} del ${fecha(g.fecha)}?`)) return;
      const { error } = await core.sb.from('pagos_embajadores').delete().eq('id', g.id);
      if (error) { core.toast(core.traducir(error)); return; }
      pagos = pagos.filter((x) => x.id !== g.id); render(); core.toast('Pago borrado');
      return;
    }
    const b = ev.target.closest('[data-accion]'); if (!b) return;
    const x = embs.find((k) => String(k.id) === b.closest('[data-id]').dataset.id); if (!x) return;
    if (b.dataset.accion === 'editar') abrirEditor(x);
    if (b.dataset.accion === 'pagar') abrirPago(x);
  });

  // ---------- Crear / editar ----------
  function vistaComision() {
    const pct = pctNum($('#eComision').value);
    $('#eComisionVista').textContent = pct != null && pct > 0
      ? `Ejemplo: en un pedido de ${dinero(200000)} gana ${dinero(200000 * pct / 100)}.`
      : 'Sobre el total pagado de cada pedido con su código.';
  }
  function abrirEditor(x = null) {
    editando = x;
    const cup = x ? cupones.find((k) => k.embajador_id === x.id) : null;
    $('#embTitulo').textContent = x ? `Editar: ${x.nombre}` : 'Nuevo embajador';
    $('#eNombre').value = x?.nombre || '';
    $('#eInstagram').value = x?.instagram || '';
    $('#eCelular').value = x?.celular || '';
    $('#eCodigo').value = cup?.codigo || '';
    $('#eDescuento').value = cup?.valor || '';
    $('#eUsos').value = String(cup && 'usos_por_cliente' in cup ? cup.usos_por_cliente : 1);
    if (!$('#eUsos').value) $('#eUsos').value = '0';
    $('#eMinimo').value = cup?.minimo_compra ? numero(cup.minimo_compra) : '';
    $('#eComision').value = x ? Number(x.comision_pct) : '';
    $('#eNotas').value = x?.notas || '';
    $('#eActivo').checked = x ? !!x.activo : true;
    $('#btnBorrarEmb').classList.toggle('hidden', !x);
    core.errorEn('#embFormError', '');
    vistaComision();
    $('#embModal').classList.remove('hidden');
    $('#eNombre').focus();
  }
  const cerrarEditor = () => $('#embModal').classList.add('hidden');
  $('#btnNuevoEmb').addEventListener('click', () => abrirEditor());
  $('#cerrarEmb').addEventListener('click', cerrarEditor);
  $('#btnCancelarEmb').addEventListener('click', cerrarEditor);
  $('#embModal').addEventListener('click', (ev) => { if (ev.target.id === 'embModal') cerrarEditor(); });
  $('#eCodigo').addEventListener('input', (ev) => { ev.target.value = ev.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); });
  $('#eDescuento').addEventListener('input', (ev) => { ev.target.value = ev.target.value.replace(/\D/g, ''); });
  $('#eMinimo').addEventListener('input', (ev) => { const n = soloNumero(ev.target.value); ev.target.value = n == null ? '' : numero(n); });
  $('#eComision').addEventListener('input', vistaComision);

  $('#formEmb').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const err = (m) => core.errorEn('#embFormError', m);
    err('');
    const nombre = $('#eNombre').value.trim();
    const cel = $('#eCelular').value.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    const codigo = $('#eCodigo').value.trim();
    const desc = soloNumero($('#eDescuento').value);
    const com = pctNum($('#eComision').value);
    if (nombre.length < 2) return err('Escribe el nombre del embajador.');
    if (cel && !/^3\d{9}$/.test(cel)) return err('El WhatsApp debe ser un celular de 10 dígitos (o déjalo vacío).');
    if (!/^[A-Z0-9]{3,30}$/.test(codigo)) return err('El código debe tener de 3 a 30 letras o números, sin espacios.');
    if (codigo === 'JWDEV') return err('Ese código está reservado.');
    if (!desc || desc < 1 || desc > 90) return err('El descuento para el cliente debe estar entre 1% y 90%.');
    if (com == null || com < 0 || com > 50) return err('La comisión debe estar entre 0% y 50%.');
    const activo = $('#eActivo').checked;
    const filaEmb = { nombre, celular: cel || null, instagram: $('#eInstagram').value.trim() || null, comision_pct: com, notas: $('#eNotas').value.trim() || null, activo };
    const filaCup = {
      codigo, tipo: 'porcentaje', valor: desc, minimo_compra: soloNumero($('#eMinimo').value) || 0,
      usos_por_cliente: parseInt($('#eUsos').value, 10) || 0, activo, nota: `Embajador: ${nombre}`
    };
    const btn = $('#btnGuardarEmb'); btn.disabled = true;
    try {
      if (!editando) {
        const r1 = await core.sb.from('embajadores').insert(filaEmb).select().single();
        if (r1.error) return err(core.traducir(r1.error));
        const r2 = await core.sb.from('cupones').insert({ ...filaCup, embajador_id: r1.data.id });
        if (r2.error) {
          await core.sb.from('embajadores').delete().eq('id', r1.data.id);
          return err(/duplicate|23505/i.test(r2.error.message + r2.error.code) ? `El código ${codigo} ya existe. Elige otro.` : core.traducir(r2.error));
        }
        core.toast(`Embajador ${nombre} creado con el código ${codigo}`);
      } else {
        const r1 = await core.sb.from('embajadores').update(filaEmb).eq('id', editando.id);
        if (r1.error) return err(core.traducir(r1.error));
        const actual = cupones.find((k) => k.embajador_id === editando.id);
        const r2 = actual
          ? await core.sb.from('cupones').update(filaCup).eq('codigo', actual.codigo)
          : await core.sb.from('cupones').insert({ ...filaCup, embajador_id: editando.id });
        if (r2.error) return err(/duplicate|23505/i.test(r2.error.message + r2.error.code) ? `El código ${codigo} ya existe. Elige otro.` : core.traducir(r2.error));
        core.toast('Embajador actualizado');
      }
      cerrarEditor();
      await cargar();
    } finally { btn.disabled = false; }
  });

  $('#btnBorrarEmb').addEventListener('click', async () => {
    if (!editando) return;
    const n = pedidos.filter((p) => p.embajador_id === editando.id).length;
    const aviso = n
      ? `${editando.nombre} tiene ${n} pedido(s) con su código. Si lo eliminas se pierde su historial de comisiones y pagos.\n\nSi solo quieres que deje de funcionar su código, mejor desmarca «Activo».\n\n¿Eliminarlo de todas formas?`
      : `¿Eliminar a ${editando.nombre} y su código?`;
    if (!confirm(aviso)) return;
    await core.sb.from('cupones').delete().eq('embajador_id', editando.id);
    const { error } = await core.sb.from('embajadores').delete().eq('id', editando.id);
    if (error) { core.errorEn('#embFormError', core.traducir(error)); return; }
    cerrarEditor(); core.toast('Embajador eliminado'); cargar();
  });

  // ---------- Pagos ----------
  function abrirPago(x) {
    pagando = x;
    const c = cifras(x.id, rango());
    $('#pagoTitulo').textContent = `Registrar pago a ${x.nombre}`;
    $('#pagoPendiente').textContent = `Ganado en total ${dinero(c.ganado)} · ya pagado ${dinero(c.pagado)} · por pagar ${dinero(c.pendiente)}.`;
    $('#pgMonto').value = c.pendiente ? numero(c.pendiente) : '';
    $('#pgFecha').value = hoyCo(); $('#pgFecha').max = hoyCo();
    $('#pgNota').value = '';
    core.errorEn('#pagoError', '');
    $('#pagoModal').classList.remove('hidden');
    $('#pgMonto').focus();
  }
  const cerrarPago = () => $('#pagoModal').classList.add('hidden');
  $('#cerrarPago').addEventListener('click', cerrarPago);
  $('#btnCancelarPago').addEventListener('click', cerrarPago);
  $('#pagoModal').addEventListener('click', (ev) => { if (ev.target.id === 'pagoModal') cerrarPago(); });
  $('#pgMonto').addEventListener('input', (ev) => { const n = soloNumero(ev.target.value); ev.target.value = n == null ? '' : numero(n); });
  $('#formPago').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    const monto = soloNumero($('#pgMonto').value);
    if (!monto) { core.errorEn('#pagoError', 'Escribe el monto pagado.'); return; }
    const dia = $('#pgFecha').value || hoyCo();
    const fila = { embajador_id: pagando.id, monto, nota: $('#pgNota').value.trim() || null, fecha: dia === hoyCo() ? new Date().toISOString() : `${dia}T12:00:00-05:00` };
    const btn = $('#btnGuardarPago'); btn.disabled = true;
    const { data, error } = await core.sb.from('pagos_embajadores').insert(fila).select().single();
    btn.disabled = false;
    if (error) { core.errorEn('#pagoError', core.traducir(error)); return; }
    pagos.unshift(data);
    cerrarPago(); render();
    core.toast(`Pago de ${dinero(monto)} registrado a ${pagando.nombre}`);
  });

  document.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Escape') return;
    if (!$('#pagoModal').classList.contains('hidden')) cerrarPago();
    else if (!$('#embModal').classList.contains('hidden')) cerrarEditor();
  });
})();
