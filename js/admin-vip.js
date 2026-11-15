/* =========================================================
   INSANITY SOCIETY — Lista VIP (panel)
   Configuración (contenido -> 'vip'), suscriptores y sus códigos personales.
   ========================================================= */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  let core = null;
  let cargado = false;
  let subs = [];
  let codigos = {};   // codigo -> fila de cupones
  let usos = {};      // codigo -> { n, total }
  let cfg = {};
  let mostrarHasta = 100;

  const dinero = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO');
  const numero = (n) => Math.round(Number(n) || 0).toLocaleString('es-CO');
  const soloNumero = (v) => { const d = String(v ?? '').replace(/\D/g, ''); return d ? parseInt(d, 10) : null; };
  const fecha = (t) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });
  const e = (s) => core.esc(s);

  document.addEventListener('admin:listo', () => { core = window.AdminCore; });
  document.addEventListener('admin:seccion', (ev) => { if (ev.detail === 'vip') cargar(); });

  async function cargar() {
    core.errorEn('#vipError', '');
    if (!cargado) $('#vipLista').innerHTML = '<p class="admin-cargando">Cargando…</p>';
    const [rc, rs, rcu, rp] = await Promise.all([
      core.sb.from('contenido').select('valor').eq('clave', 'vip').maybeSingle(),
      core.sb.from('suscriptores').select('*').order('creado_en', { ascending: false }),
      core.sb.from('cupones').select('codigo, activo, vence, valor, minimo_compra').not('celular_vip', 'is', null),
      core.sb.from('pedidos').select('cupon, total, estado').like('cupon', 'VIP-%')
    ]);
    const err = rs.error || rc.error || rcu.error;
    if (err) {
      const falta = /suscriptores|celular_vip|suscribir_vip/i.test(err.message || '') && /does not exist|schema cache|could not find/i.test(err.message || '');
      core.errorEn('#vipError', falta ? 'Falta activar la Lista VIP: ejecuta supabase/cupones-preventa.sql y luego supabase/lista-vip.sql en Supabase (SQL Editor).' : core.traducir(err));
      $('#vipLista').innerHTML = '';
      return;
    }
    cfg = rc.data?.valor || {};
    subs = rs.data || [];
    codigos = Object.fromEntries((rcu.data || []).map((c) => [c.codigo, c]));
    usos = {};
    (rp.data || []).filter((p) => p.estado !== 'cancelado' && /^VIP-/.test(p.cupon || '')).forEach((p) => {
      const u = usos[p.cupon] || (usos[p.cupon] = { n: 0, total: 0 });
      u.n += 1; u.total += Number(p.total) || 0;
    });
    cargado = true;
    pintarConfig();
    render();
  }

  // ---------- Configuración ----------
  function pintarConfig() {
    $('#vCfgActivo').checked = !!cfg.activo;
    $('#vCfgTitulo').value = cfg.titulo || '';
    $('#vCfgTexto').value = cfg.texto || '';
    $('#vCfgRegalo').checked = !!cfg.regalo_activo;
    $('#vCfgPct').value = cfg.porcentaje || '';
    $('#vCfgMinimo').value = cfg.minimo_compra ? numero(cfg.minimo_compra) : '';
    $('#vCfgDias').value = cfg.dias_validez || '';
    $('#vCfgPausar').checked = !!cfg.codigos_pausados;
    avisoConfig();
    $('#vCfgEstado').textContent = '';
  }
  function avisoConfig() {
    const pct = soloNumero($('#vCfgPct').value);
    const regalo = $('#vCfgRegalo').checked;
    const activo = $('#vCfgActivo').checked;
    const min = soloNumero($('#vCfgMinimo').value);
    const dias = soloNumero($('#vCfgDias').value);
    let t;
    if (!activo) t = 'La invitación está apagada: nadie la ve en la web.';
    else if (!regalo) t = 'La gente se puede inscribir, pero sin código de descuento.';
    else if (!pct) t = '⚠ Falta el porcentaje: mientras esté vacío NO se entregan códigos (la gente se inscribe sin regalo).';
    else t = `Cada nuevo suscriptor recibe un código personal de ${pct}%${min ? ` para compras desde ${dinero(min)}` : ''}${dias ? `, válido por ${dias} día${dias === 1 ? '' : 's'}` : ', sin vencimiento'}. Un solo uso y solo con su celular.`;
    $('#vCfgAviso').textContent = t;
    $('#vCfgAviso').classList.toggle('vip-aviso-alerta', activo && regalo && !pct);
  }
  ['#vCfgActivo', '#vCfgRegalo', '#vCfgPausar'].forEach((s) => $(s).addEventListener('change', () => { avisoConfig(); $('#vCfgEstado').textContent = 'Cambios sin guardar'; }));
  ['#vCfgPct', '#vCfgDias'].forEach((s) => $(s).addEventListener('input', (ev) => { ev.target.value = ev.target.value.replace(/\D/g, ''); avisoConfig(); $('#vCfgEstado').textContent = 'Cambios sin guardar'; }));
  $('#vCfgMinimo').addEventListener('input', (ev) => { const n = soloNumero(ev.target.value); ev.target.value = n == null ? '' : numero(n); avisoConfig(); $('#vCfgEstado').textContent = 'Cambios sin guardar'; });
  ['#vCfgTitulo', '#vCfgTexto'].forEach((s) => $(s).addEventListener('input', () => { $('#vCfgEstado').textContent = 'Cambios sin guardar'; }));

  $('#vipConfig').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    core.errorEn('#vipError', '');
    const pct = soloNumero($('#vCfgPct').value);
    if (pct != null && (pct < 1 || pct > 90)) { core.errorEn('#vipError', 'El descuento debe estar entre 1% y 90% (o vacío).'); $('#vCfgPct').focus(); return; }
    const valor = {
      activo: $('#vCfgActivo').checked,
      regalo_activo: $('#vCfgRegalo').checked,
      porcentaje: pct || null,
      minimo_compra: soloNumero($('#vCfgMinimo').value) || 0,
      dias_validez: soloNumero($('#vCfgDias').value) || null,
      codigos_pausados: $('#vCfgPausar').checked,
      titulo: $('#vCfgTitulo').value.trim() || 'Únete a la Sociedad',
      texto: $('#vCfgTexto').value.trim() || 'Entérate primero de lanzamientos, preventas y ofertas exclusivas.'
    };
    const btn = $('#vCfgGuardar'); btn.disabled = true;
    const { error } = await core.sb.from('contenido').upsert({ clave: 'vip', valor });
    btn.disabled = false;
    if (error) { core.errorEn('#vipError', core.traducir(error)); return; }
    cfg = valor;
    $('#vCfgEstado').textContent = 'Guardado ✓';
    core.toast('Configuración de la Lista VIP guardada');
    render();
  });

  // ---------- Suscriptores ----------
  function estadoCodigo(s) {
    if (!s.codigo) return { txt: 'Sin código', cls: '' };
    const c = codigos[s.codigo];
    if (usos[s.codigo]?.n) return { txt: 'Usado', cls: 'vip-est--usado' };
    if (!c || !c.activo) return { txt: 'Desactivado', cls: 'vip-est--off' };
    if (c.vence && new Date(c.vence) <= new Date()) return { txt: 'Vencido', cls: 'vip-est--off' };
    if (cfg.codigos_pausados) return { txt: 'Pausado', cls: 'vip-est--off' };
    return { txt: 'Sin usar', cls: 'vip-est--libre' };
  }
  function filtrados() {
    const q = core.slug($('#vipBuscar').value.trim());
    const qn = $('#vipBuscar').value.replace(/\D/g, '');
    return subs.filter((s) => !q || core.slug([s.nombre, s.correo, s.codigo].join(' ')).includes(q) || (qn && String(s.celular).includes(qn)));
  }
  function render() {
    const conCodigo = subs.filter((s) => s.codigo);
    const usados = conCodigo.filter((s) => usos[s.codigo]?.n);
    const ventas = Object.values(usos).reduce((t, u) => t + u.total, 0);
    const conv = conCodigo.length ? Math.round((usados.length / conCodigo.length) * 100) : 0;
    $('#vipConteo').textContent = `${numero(subs.length)} suscriptor${subs.length === 1 ? '' : 'es'}`;
    $('#vipResumen').innerHTML = `
      <div class="inv-card"><strong>${numero(subs.length)}</strong><span>suscriptores</span></div>
      <div class="inv-card"><strong>${numero(conCodigo.length)}</strong><span>códigos entregados</span></div>
      <div class="inv-card"><strong>${numero(usados.length)}</strong><span>códigos usados${conCodigo.length ? ` (${conv}%)` : ''}</span></div>
      <div class="inv-card"><strong>${dinero(ventas)}</strong><span>en pedidos con código VIP</span></div>`;
    const lista = filtrados();
    $('#vipLista').innerHTML = lista.length ? lista.slice(0, mostrarHasta).map((s) => {
      const est = estadoCodigo(s);
      return `
      <article class="admin-item vip-item" data-id="${s.id}">
        <div class="vip-avatar" aria-hidden="true">${e((s.nombre || '?').trim().charAt(0).toUpperCase() || '?')}</div>
        <div class="admin-item-info">
          <h3>${e(s.nombre || 'Sin nombre')}</h3>
          <p class="admin-meta"><a href="https://wa.me/57${e(s.celular)}" target="_blank" rel="noopener">${e(s.celular.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3'))}</a>${s.correo ? ' · ' + e(s.correo) : ''} · ${e(fecha(s.creado_en))}${s.origen ? ' · ' + e(s.origen === 'popup' ? 'ventanita' : s.origen === 'pie' ? 'pie de página' : s.origen) : ''}</p>
          ${s.codigo ? `<p class="vip-cod"><code>${e(s.codigo)}</code> <span class="vip-est ${est.cls}">${est.txt}</span>${codigos[s.codigo] ? ` <span class="admin-meta">${codigos[s.codigo].valor}%${codigos[s.codigo].vence ? ' · vence ' + e(fecha(codigos[s.codigo].vence)) : ''}</span>` : ''}</p>` : '<p class="admin-meta">Se inscribió sin regalo</p>'}
        </div>
        <div class="admin-item-acciones">
          <button type="button" class="btn-secundario admin-peligro" data-accion="borrar">Eliminar</button>
        </div>
      </article>`;
    }).join('') : `<p class="admin-cargando">${subs.length ? 'Nadie coincide con la búsqueda.' : 'Aún no hay suscriptores. Activa la invitación arriba para empezar a recibirlos.'}</p>`;
    $('#vipMas').classList.toggle('hidden', lista.length <= mostrarHasta);
  }
  $('#vipBuscar').addEventListener('input', () => { mostrarHasta = 100; render(); });
  $('#vipMas').addEventListener('click', () => { mostrarHasta += 100; render(); });

  $('#vipLista').addEventListener('click', async (ev) => {
    const b = ev.target.closest('[data-accion="borrar"]'); if (!b) return;
    const s = subs.find((x) => String(x.id) === b.closest('[data-id]').dataset.id); if (!s) return;
    if (!confirm(`¿Eliminar a ${s.nombre || s.celular} de la Lista VIP?${s.codigo ? `\nSu código ${s.codigo} quedará desactivado.` : ''}\n\nHazlo, por ejemplo, si pidió darse de baja.`)) return;
    if (s.codigo) {
      const r = await core.sb.from('cupones').update({ activo: false }).eq('codigo', s.codigo);
      if (r.error) { core.toast(core.traducir(r.error)); return; }
    }
    const { error } = await core.sb.from('suscriptores').delete().eq('id', s.id);
    if (error) { core.toast(core.traducir(error)); return; }
    subs = subs.filter((x) => x.id !== s.id);
    if (s.codigo && codigos[s.codigo]) codigos[s.codigo].activo = false;
    render();
    core.toast('Suscriptor eliminado');
  });

  // ---------- Exportar (CSV que abre en Excel) ----------
  $('#vipExportar').addEventListener('click', () => {
    if (!subs.length) { core.toast('Aún no hay suscriptores para descargar.'); return; }
    const celda = (v) => {
      let t = String(v ?? '');
      if (/^[=+\-@]/.test(t)) t = "'" + t; // evita fórmulas al abrir en Excel
      return `"${t.replace(/"/g, '""')}"`;
    };
    const filas = [['Nombre', 'WhatsApp', 'Correo', 'Fecha', 'Origen', 'Código', 'Estado del código']]
      .concat(subs.map((s) => [s.nombre || '', '57' + s.celular, s.correo || '', fecha(s.creado_en), s.origen || '', s.codigo || '', estadoCodigo(s).txt]));
    const csv = '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `lista-vip-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  });
})();
