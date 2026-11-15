/* =========================================================
   INSANITY SOCIETY — Códigos de descuento (pestaña Cupones)
   ========================================================= */
(() => {
  'use strict';
  const $ = (s, c = document) => c.querySelector(s);
  let core = null;
  let cupones = [];
  let cargados = false;
  let editando = null;

  const dinero = (n) => '$' + Number(n || 0).toLocaleString('es-CO');
  const soloNumero = (v) => { const d = String(v || '').replace(/\D/g, ''); return d ? parseInt(d, 10) : null; };
  const vigente = (c) => c.activo && (!c.vence || new Date(c.vence) > new Date());
  const fecha = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' });
  const aFinDeDia = (d) => (d ? `${d}T23:59:59-05:00` : null);
  const aFechaInput = (iso) => { if (!iso) return ''; const d = new Date(new Date(iso).getTime() - 5 * 3600 * 1000); return d.toISOString().slice(0, 10); };
  const descripcion = (c) => (c.tipo === 'porcentaje' ? `${c.valor}% de descuento` : `${dinero(c.valor)} de descuento`)
    + (c.minimo_compra ? ` · en compras desde ${dinero(c.minimo_compra)}` : '');

  document.addEventListener('admin:listo', () => { core = window.AdminCore; });
  document.addEventListener('admin:seccion', (e) => { if (e.detail === 'cupones' && !cargados) cargar(); });

  async function cargar() {
    core.errorEn('#cuponesError', '');
    $('#listaCupones').innerHTML = '<p class="admin-cargando">Cargando…</p>';
    const { data, error } = await core.sb.from('cupones').select('*').order('creado_en', { ascending: false });
    if (error) { core.errorEn('#cuponesError', core.traducir(error)); $('#listaCupones').innerHTML = ''; return; }
    cupones = data || []; cargados = true;
    render();
  }

  function render() {
    const activos = cupones.filter(vigente).length;
    $('#cuponesConteo').textContent = `${activos} activo${activos === 1 ? '' : 's'} de ${cupones.length}`;
    const e = core.esc;
    $('#listaCupones').innerHTML = cupones.length ? cupones.map((c) => {
      const vencido = c.vence && new Date(c.vence) <= new Date();
      const estado = vencido ? 'Vencido' : c.activo ? 'Activo' : 'Pausado';
      return `
      <article class="admin-item admin-cupon ${vigente(c) ? '' : 'is-oculto'}" data-codigo="${e(c.codigo)}">
        <div class="admin-cupon-codigo">${e(c.codigo)}</div>
        <div class="admin-item-info">
          <h3>${e(descripcion(c))}</h3>
          <p class="admin-meta">${c.vence ? `${vencido ? 'Venció' : 'Vence'} el ${e(fecha(c.vence))}` : 'Sin fecha de vencimiento'}${c.nota ? ' · ' + e(c.nota) : ''}</p>
        </div>
        <div class="admin-item-acciones">
          <label class="admin-switch" title="Activo">
            <input type="checkbox" data-accion="activo" ${c.activo ? 'checked' : ''} />
            <span>${estado}</span>
          </label>
          <button type="button" class="btn-secundario" data-accion="copiar" title="Copiar código">Copiar</button>
          <button type="button" class="btn-secundario" data-accion="editar">Editar</button>
        </div>
      </article>`;
    }).join('') : '<p class="admin-cargando">Aún no hay códigos. Crea el primero con “+ Nuevo código”.</p>';
  }

  $('#listaCupones').addEventListener('click', async (ev) => {
    const b = ev.target.closest('button[data-accion]'); if (!b) return;
    const codigo = b.closest('[data-codigo]').dataset.codigo;
    if (b.dataset.accion === 'editar') abrir(cupones.find((c) => c.codigo === codigo));
    if (b.dataset.accion === 'copiar') {
      try { await navigator.clipboard.writeText(codigo); core.toast(`Código ${codigo} copiado`); } catch { core.toast(codigo); }
    }
  });
  $('#listaCupones').addEventListener('change', async (ev) => {
    if (ev.target.dataset.accion !== 'activo') return;
    const codigo = ev.target.closest('[data-codigo]').dataset.codigo;
    const activo = ev.target.checked;
    const { error } = await core.sb.from('cupones').update({ activo }).eq('codigo', codigo);
    if (error) { core.toast(core.traducir(error)); ev.target.checked = !activo; return; }
    cupones.find((c) => c.codigo === codigo).activo = activo;
    render();
    core.toast(activo ? `Código ${codigo} activado` : `Código ${codigo} pausado`);
  });

  // ---------- Editor ----------
  const modal = $('#cuponModal');
  function abrir(c) {
    editando = c || null;
    $('#cuponTitulo').textContent = c ? 'Editar código' : 'Nuevo código';
    $('#cCodigo').value = c?.codigo || '';
    $('#cCodigo').disabled = !!c;
    $('#cTipo').value = c?.tipo || 'porcentaje';
    $('#cValor').value = c?.valor ? Number(c.valor).toLocaleString('es-CO') : '';
    $('#cMinimo').value = c?.minimo_compra ? Number(c.minimo_compra).toLocaleString('es-CO') : '';
    $('#cVence').value = aFechaInput(c?.vence);
    $('#cNota').value = c?.nota || '';
    $('#cActivo').checked = c ? c.activo : true;
    $('#btnBorrarCupon').classList.toggle('hidden', !c);
    core.errorEn('#cuponError', '');
    vista();
    modal.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    (c ? $('#cValor') : $('#cCodigo')).focus();
  }
  function cerrar() { modal.classList.add('hidden'); document.body.classList.remove('no-scroll'); editando = null; }
  $('#btnNuevoCupon').addEventListener('click', () => abrir(null));
  $('#cerrarCupon').addEventListener('click', cerrar);
  $('#btnCancelarCupon').addEventListener('click', cerrar);
  modal.addEventListener('click', (e) => { if (e.target === modal) cerrar(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !modal.classList.contains('hidden')) cerrar(); });

  $('#cCodigo').addEventListener('input', (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); vista(); });
  ['#cValor', '#cMinimo'].forEach((s) => $(s).addEventListener('input', (e) => {
    const n = soloNumero(e.target.value); e.target.value = n == null ? '' : n.toLocaleString('es-CO'); vista();
  }));
  $('#cTipo').addEventListener('change', vista);

  function vista() {
    const valor = soloNumero($('#cValor').value);
    const tipo = $('#cTipo').value;
    $('#cValor').placeholder = tipo === 'porcentaje' ? 'Ej: 15' : 'Ej: 20.000';
    const codigo = $('#cCodigo').value || 'CÓDIGO';
    $('#cVista').textContent = valor ? `Vista previa: con ${codigo}, el cliente obtiene ${descripcion({ tipo, valor, minimo_compra: soloNumero($('#cMinimo').value) })}.` : '';
  }

  $('#formCupon').addEventListener('submit', async (e) => {
    e.preventDefault();
    core.errorEn('#cuponError', '');
    const codigo = $('#cCodigo').value.trim().toUpperCase();
    const tipo = $('#cTipo').value;
    const valor = soloNumero($('#cValor').value);
    const fallo =
      !/^[A-Z0-9]{3,30}$/.test(codigo) ? 'El código debe tener entre 3 y 30 letras o números, sin espacios.' :
      !valor ? 'Escribe el valor del descuento.' :
      tipo === 'porcentaje' && valor > 90 ? 'El porcentaje máximo es 90%.' : null;
    if (fallo) { core.errorEn('#cuponError', fallo); return; }
    const fila = {
      tipo, valor,
      minimo_compra: soloNumero($('#cMinimo').value) || 0,
      vence: aFinDeDia($('#cVence').value),
      nota: $('#cNota').value.trim() || null,
      activo: $('#cActivo').checked
    };
    const btn = $('#btnGuardarCupon');
    btn.disabled = true; btn.textContent = 'Guardando…';
    const { error } = editando
      ? await core.sb.from('cupones').update(fila).eq('codigo', editando.codigo)
      : await core.sb.from('cupones').insert({ codigo, ...fila });
    btn.disabled = false; btn.textContent = 'Guardar';
    if (error) {
      core.errorEn('#cuponError', /duplicate key|already exists/i.test(error.message || '') ? `Ya existe un código ${codigo}.` : core.traducir(error));
      return;
    }
    core.toast(editando ? 'Código actualizado' : `Código ${codigo} creado`);
    cerrar();
    cargar();
  });

  $('#btnBorrarCupon').addEventListener('click', async () => {
    if (!editando) return;
    if (!window.confirm(`¿Eliminar el código ${editando.codigo}?\n\nSi solo quieres que deje de funcionar por un tiempo, mejor desmarca "Activo".`)) return;
    const { error } = await core.sb.from('cupones').delete().eq('codigo', editando.codigo);
    if (error) { core.errorEn('#cuponError', core.traducir(error)); return; }
    core.toast('Código eliminado');
    cerrar();
    cargar();
  });
})();
