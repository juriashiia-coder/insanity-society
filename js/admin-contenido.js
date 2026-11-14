/* =========================================================
   INSANITY SOCIETY — Editor de secciones (Inicio, Colecciones,
   La Sociedad, Tienda, Comunidad, General)
   Cada sección se guarda como un documento en la tabla "contenido".
   ========================================================= */
(() => {
  'use strict';

  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => Array.from(c.querySelectorAll(s));

  // ---------- Definición de cada sección ----------
  const TXT = (k, l, extra = {}) => ({ k, l, t: 'text', ...extra });
  const AREA = (k, l, extra = {}) => ({ k, l, t: 'textarea', ...extra });
  const CHECK = (k, l, extra = {}) => ({ k, l, t: 'check', ...extra });
  const IMG = (k, l, extra = {}) => ({ k, l, t: 'imagen', ...extra });

  const ESQUEMAS = {
    inicio: {
      titulo: 'Inicio', ver: 'index.html#home',
      ayuda: 'La portada: lo primero que ve un cliente al entrar.',
      campos: [
        AREA('titulo', 'Título principal', { filas: 2, ayuda: 'Pulsa Enter para partirlo en dos líneas.' }),
        AREA('subtitulo', 'Subtítulo', { filas: 2 }),
        TXT('boton_tienda', 'Texto del botón principal (va a la tienda)'),
        TXT('boton_colecciones', 'Texto del botón secundario (va a colecciones)'),
        IMG('imagen_portada', 'Imagen de portada', { ayuda: 'Se ve en celulares y mientras carga el video. Vacío = foto actual de la sentadilla.' }),
        { k: 'franja', l: 'Franja de beneficios (debajo de la portada)', t: 'lista', item: 'Beneficio', tituloDe: 'titulo', max: 4,
          campos: [TXT('titulo', 'Título', { req: true }), TXT('texto', 'Texto')] }
      ]
    },
    colecciones: {
      titulo: 'Colecciones', ver: 'index.html#colecciones',
      ayuda: 'El nombre de cada colección debe coincidir con la "Colección" de sus productos para que aparezca el botón "Ver productos".',
      campos: [
        AREA('intro', 'Texto de introducción', { filas: 3 }),
        { k: 'items', l: 'Colecciones', t: 'lista', item: 'Colección', tituloDe: 'nombre',
          nuevo: { visible: true, destacada: false },
          campos: [
            TXT('nombre', 'Nombre', { req: true }),
            TXT('jp', 'Nombre en japonés (opcional)', { placeholder: 'Ej: 狂気' }),
            AREA('descripcion', 'Descripción', { filas: 3 }),
            CHECK('visible', 'Visible en la web'),
            CHECK('destacada', 'Tarjeta destacada (más grande)'),
            TXT('leyenda_titulo', 'Título del bloque extra (opcional)', { placeholder: 'Ej: Leyenda' }),
            AREA('leyenda', 'Texto del bloque extra (opcional)', { filas: 3 }),
            TXT('enlace', 'Enlace del botón (opcional)', { placeholder: 'Ej: raijin.html' }),
            TXT('enlace_texto', 'Texto del botón (opcional)', { placeholder: 'Ej: Leer la leyenda completa' })
          ] }
      ]
    },
    sociedad: {
      titulo: 'La Sociedad', ver: 'index.html#sociedad',
      ayuda: 'Quiénes son, qué representan y el manifiesto.',
      campos: [
        AREA('intro', 'Texto de introducción', { filas: 4 }),
        TXT('lista_titulo', 'Título de la lista'),
        { k: 'puntos', l: 'Puntos de la lista', t: 'lista', item: 'Punto', tituloDe: 'titulo',
          campos: [TXT('titulo', 'Título (en rojo)', { req: true }), AREA('texto', 'Texto', { filas: 2 })] },
        TXT('manifiesto_titulo', 'Título del manifiesto'),
        AREA('manifiesto', 'Manifiesto', { filas: 4 })
      ]
    },
    tienda: {
      titulo: 'Tienda', ver: 'index.html#tienda',
      ayuda: 'El texto de arriba de la tienda. Los productos se editan en la pestaña Productos.',
      campos: [AREA('intro', 'Texto de introducción', { filas: 3 })]
    },
    comunidad: {
      titulo: 'Comunidad', ver: 'index.html#blog',
      ayuda: 'Eventos, rutinas, historias y anuncios. La primera publicación aparece primero.',
      campos: [
        { k: 'items', l: 'Publicaciones', t: 'lista', item: 'Publicación', tituloDe: 'titulo', alInicio: true,
          nuevo: { visible: true, destacada: false, etiqueta_gris: false },
          campos: [
            TXT('titulo', 'Título', { req: true }),
            TXT('etiqueta', 'Etiqueta', { placeholder: 'Ej: Evento, Rutina, Próximamente' }),
            CHECK('etiqueta_gris', 'Etiqueta en gris (para "Próximamente")'),
            TXT('fecha', 'Fecha / lugar (opcional)', { placeholder: 'Ej: 21 de septiembre de 2025 · Aguazul, Casanare' }),
            AREA('resumen', 'Texto', { filas: 3 }),
            IMG('imagen', 'Imagen (opcional)'),
            TXT('enlace', 'Enlace (opcional)', { placeholder: 'Ej: power-meet-2025.html o https://instagram.com/...' }),
            TXT('enlace_texto', 'Texto del enlace', { placeholder: 'Ej: Ver el evento' }),
            CHECK('destacada', 'Destacada (más grande)'),
            CHECK('visible', 'Visible en la web')
          ] }
      ]
    },
    general: {
      titulo: 'General', ver: 'index.html',
      ayuda: 'Datos que se usan en toda la web.',
      campos: [
        TXT('whatsapp', 'Número de WhatsApp para pedidos', { req: true, ayuda: 'Con indicativo 57 y sin espacios ni +. Ej: 573241457674', numerico: true }),
        AREA('pie', 'Frase del pie de página', { filas: 2 })
      ]
    }
  };

  // ---------- Estado ----------
  let core = null;
  let documentos = {};      // clave -> valor guardado en Supabase
  let seccion = 'productos';
  let datos = null;         // copia de trabajo de la sección abierta
  let original = '';
  let cargado = false;

  const clonar = (o) => JSON.parse(JSON.stringify(o ?? {}));
  const hayCambios = () => datos && JSON.stringify(datos) !== original;

  function leerRuta(obj, ruta) { return ruta.split('.').reduce((o, k) => (o == null ? o : o[k]), obj); }
  function escribirRuta(obj, ruta, v) {
    const p = ruta.split('.'); const ult = p.pop();
    const destino = p.reduce((o, k) => (o[k] ??= {}), obj); destino[ult] = v;
  }

  // ---------- Pestañas ----------
  $('#adminTabs').addEventListener('click', (e) => {
    const b = e.target.closest('.admin-tab'); if (!b || b.dataset.seccion === seccion) return;
    if (hayCambios() && !window.confirm('Tienes cambios sin guardar en esta sección. ¿Salir sin guardar?')) return;
    abrirSeccion(b.dataset.seccion);
  });

  function abrirSeccion(id) {
    seccion = id;
    $$('.admin-tab').forEach((t) => t.classList.toggle('active', t.dataset.seccion === id));
    const esProductos = id === 'productos';
    $('#subProductos').classList.toggle('hidden', !esProductos);
    $('#subContenido').classList.toggle('hidden', esProductos);
    datos = null; original = '';
    if (esProductos) return;
    const esq = ESQUEMAS[id];
    $('#contenidoTitulo').textContent = esq.titulo;
    $('#contenidoAyuda').textContent = esq.ayuda || '';
    $('#contenidoVer').href = esq.ver;
    if (!cargado) { $('#formContenido').innerHTML = '<p class="admin-cargando">Cargando…</p>'; return; }
    datos = clonar(documentos[id]);
    original = JSON.stringify(datos);
    renderFormulario();
    actualizarEstado();
  }

  // ---------- Carga ----------
  document.addEventListener('admin:listo', async () => {
    core = window.AdminCore;
    const { data, error } = await core.sb.from('contenido').select('clave, valor');
    if (error) {
      const falta = /contenido|PGRST205|42P01|does not exist|schema cache/i.test(error.message || '');
      core.errorEn('#contenidoError', falta ? 'Falta crear la tabla de contenido: ejecuta supabase/contenido.sql en Supabase (SQL Editor).' : core.traducir(error));
      cargado = false;
      return;
    }
    documentos = Object.fromEntries((data || []).map((r) => [r.clave, r.valor]));
    cargado = true;
    if (seccion !== 'productos') abrirSeccion(seccion);
  });

  // ---------- Formulario ----------
  const e = (s) => core.esc(s);

  function htmlCampo(c, ruta, valor) {
    const id = 'c_' + ruta.replace(/\./g, '_');
    const ayuda = c.ayuda ? `<small class="admin-hint">${e(c.ayuda)}</small>` : '';
    const ph = c.placeholder ? ` placeholder="${e(c.placeholder)}"` : '';
    if (c.t === 'check') {
      return `<label class="check-row admin-check"><input type="checkbox" id="${id}" data-ruta="${ruta}" ${valor ? 'checked' : ''} /><span>${e(c.l)}</span></label>`;
    }
    if (c.t === 'textarea') {
      return `<div class="form-row"><label for="${id}">${e(c.l)}${c.req ? ' *' : ''}</label>
        <textarea id="${id}" data-ruta="${ruta}" rows="${c.filas || 3}"${ph}>${e(valor ?? '')}</textarea>${ayuda}</div>`;
    }
    if (c.t === 'imagen') {
      const url = valor || '';
      return `<div class="form-row admin-campo-img" data-ruta-img="${ruta}"><label>${e(c.l)}</label>
        <div class="admin-img-fila">
          <div class="admin-slot-img admin-slot-img--mini">${url ? `<img src="${e(url)}" alt="" />` : '<span>Sin imagen</span>'}</div>
          <div class="admin-img-acciones">
            <label class="btn-secundario admin-subir">${url ? 'Cambiar' : 'Subir imagen'}<input type="file" accept="image/*" hidden data-subir="${ruta}" /></label>
            ${url ? `<button type="button" class="admin-quitar-foto" data-quitar-img="${ruta}">Quitar</button>` : ''}
          </div>
        </div>${ayuda}</div>`;
    }
    if (c.t === 'lista') return htmlLista(c, ruta, Array.isArray(valor) ? valor : []);
    return `<div class="form-row"><label for="${id}">${e(c.l)}${c.req ? ' *' : ''}</label>
      <input type="text" id="${id}" data-ruta="${ruta}" value="${e(valor ?? '')}"${ph}${c.numerico ? ' inputmode="numeric"' : ''} />${ayuda}</div>`;
  }

  function htmlLista(c, ruta, items) {
    const lleno = c.max && items.length >= c.max;
    return `<fieldset class="admin-fieldset admin-lista-campo" data-lista="${ruta}">
      <legend>${e(c.l)} <small>(${items.length})</small></legend>
      ${items.map((it, i) => {
        const titulo = (it && it[c.tituloDe]) || `${c.item} sin título`;
        const oculto = it && it.visible === false;
        return `<details class="admin-item-lista${oculto ? ' is-oculto' : ''}" data-i="${i}" ${abiertos.has(ruta + '.' + i) ? 'open' : ''}>
          <summary>
            <span class="admin-item-titulo">${e(titulo)}${oculto ? ' <small>(oculta)</small>' : ''}</span>
            <span class="admin-item-botones">
              <button type="button" class="icon-btn" data-mover="-1" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>↑</button>
              <button type="button" class="icon-btn" data-mover="1" aria-label="Bajar" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>
              <button type="button" class="icon-btn admin-borrar-item" data-borrar aria-label="Eliminar">✕</button>
            </span>
          </summary>
          <div class="admin-item-campos">
            ${c.campos.map((sc) => htmlCampo(sc, `${ruta}.${i}.${sc.k}`, it?.[sc.k])).join('')}
          </div>
        </details>`;
      }).join('')}
      <button type="button" class="btn-secundario" data-agregar ${lleno ? 'disabled' : ''}>+ Agregar ${e(c.item.toLowerCase())}</button>
    </fieldset>`;
  }

  const abiertos = new Set();
  function renderFormulario() {
    const esq = ESQUEMAS[seccion];
    $('#formContenido').innerHTML = esq.campos.map((c) => htmlCampo(c, c.k, datos[c.k])).join('');
  }
  function campoDeRutaLista(ruta) {
    // "items" o "franja" -> definición del campo lista
    return ESQUEMAS[seccion].campos.find((c) => c.k === ruta);
  }

  const form = $('#formContenido');
  form.addEventListener('input', (ev) => {
    const el = ev.target; const ruta = el.dataset.ruta; if (!ruta) return;
    let v = el.type === 'checkbox' ? el.checked : el.value;
    const def = buscarDef(ruta);
    if (def?.numerico) { v = v.replace(/\D/g, ''); el.value = v; }
    escribirRuta(datos, ruta, v);
    // Actualiza el título visible del elemento de la lista
    const det = el.closest('details');
    if (det) {
      const lista = det.closest('[data-lista]').dataset.lista; const c = campoDeRutaLista(lista);
      if (ruta.endsWith('.' + c.tituloDe)) det.querySelector('.admin-item-titulo').firstChild.textContent = v || `${c.item} sin título`;
    }
    actualizarEstado();
  });
  form.addEventListener('toggle', (ev) => {
    const d = ev.target; if (!d.matches?.('details')) return;
    const clave = d.closest('[data-lista]').dataset.lista + '.' + d.dataset.i;
    d.open ? abiertos.add(clave) : abiertos.delete(clave);
  }, true);

  function buscarDef(ruta) {
    const partes = ruta.split('.');
    let def = ESQUEMAS[seccion].campos.find((c) => c.k === partes[0]);
    if (def?.t === 'lista' && partes.length >= 3) def = def.campos.find((c) => c.k === partes[2]);
    return def;
  }

  form.addEventListener('click', (ev) => {
    const listaEl = ev.target.closest('[data-lista]');
    const btn = ev.target.closest('button');
    if (!btn || !listaEl) return;
    const ruta = listaEl.dataset.lista; const c = campoDeRutaLista(ruta);
    const items = (datos[ruta] = Array.isArray(datos[ruta]) ? datos[ruta] : []);
    if (btn.hasAttribute('data-agregar')) {
      const nuevo = { ...Object.fromEntries(c.campos.map((sc) => [sc.k, sc.t === 'check' ? false : ''])), ...(c.nuevo || {}) };
      const idx = c.alInicio ? 0 : items.length;
      items.splice(idx, 0, nuevo);
      reindexarAbiertos(ruta, (i) => (c.alInicio ? i + 1 : i));
      abiertos.add(`${ruta}.${idx}`);
      renderFormulario(); actualizarEstado();
      $(`[data-lista="${ruta}"] details[data-i="${idx}"] input, [data-lista="${ruta}"] details[data-i="${idx}"] textarea`)?.focus();
      return;
    }
    const det = btn.closest('details'); if (!det) return;
    ev.preventDefault();
    const i = +det.dataset.i;
    if (btn.hasAttribute('data-mover')) {
      const j = i + (+btn.dataset.mover); if (j < 0 || j >= items.length) return;
      [items[i], items[j]] = [items[j], items[i]];
      const ai = abiertos.has(`${ruta}.${i}`), aj = abiertos.has(`${ruta}.${j}`);
      abiertos.delete(`${ruta}.${i}`); abiertos.delete(`${ruta}.${j}`);
      if (ai) abiertos.add(`${ruta}.${j}`); if (aj) abiertos.add(`${ruta}.${i}`);
    } else if (btn.hasAttribute('data-borrar')) {
      const nombre = items[i]?.[c.tituloDe] || c.item.toLowerCase();
      if (!window.confirm(`¿Eliminar "${nombre}"? Se aplica al guardar.`)) return;
      items.splice(i, 1);
      reindexarAbiertos(ruta, (k) => (k > i ? k - 1 : k === i ? -1 : k));
    } else return;
    renderFormulario(); actualizarEstado();
  });

  function reindexarAbiertos(ruta, f) {
    const actuales = [...abiertos].filter((k) => k.startsWith(ruta + '.'));
    actuales.forEach((k) => abiertos.delete(k));
    actuales.forEach((k) => { const n = f(+k.split('.').pop()); if (n >= 0) abiertos.add(`${ruta}.${n}`); });
  }

  // Imágenes
  form.addEventListener('change', async (ev) => {
    const el = ev.target; if (!el.dataset.subir || !el.files[0]) return;
    const ruta = el.dataset.subir;
    const cont = el.closest('.admin-campo-img');
    cont.querySelector('.admin-slot-img').innerHTML = '<span>Subiendo…</span>';
    try {
      const url = await core.subirImagen(el.files[0], 'contenido/' + seccion);
      escribirRuta(datos, ruta, url);
      core.toast('Imagen subida. Recuerda pulsar Guardar cambios.');
    } catch (err) {
      core.errorEn('#contenidoError', 'No se pudo subir la imagen: ' + core.traducir(err));
    }
    renderFormulario(); actualizarEstado();
  });
  form.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-quitar-img]'); if (!b) return;
    escribirRuta(datos, b.dataset.quitarImg, '');
    renderFormulario(); actualizarEstado();
  });

  // ---------- Guardar / descartar ----------
  function actualizarEstado() {
    const cambios = hayCambios();
    $('#contenidoEstado').textContent = cambios ? 'Cambios sin guardar' : 'Sin cambios';
    $('#contenidoEstado').classList.toggle('admin-pendiente', cambios);
    $('#btnGuardarContenido').disabled = !cambios;
    $('#btnDescartar').disabled = !cambios;
  }

  function validar() {
    for (const c of ESQUEMAS[seccion].campos) {
      if (c.req && !String(datos[c.k] ?? '').trim()) return `Completa "${c.l}".`;
      if (c.t === 'lista') {
        for (const [i, it] of (datos[c.k] || []).entries()) {
          for (const sc of c.campos) if (sc.req && !String(it?.[sc.k] ?? '').trim()) return `${c.item} #${i + 1}: completa "${sc.l}".`;
        }
      }
    }
    if (seccion === 'general' && !/^57\d{10}$/.test(datos.whatsapp || '')) return 'El WhatsApp debe tener 57 seguido de los 10 dígitos del celular. Ej: 573241457674';
    return null;
  }

  $('#btnGuardarContenido').addEventListener('click', async () => {
    core.errorEn('#contenidoError', '');
    const fallo = validar();
    if (fallo) { core.errorEn('#contenidoError', fallo); return; }
    const btn = $('#btnGuardarContenido');
    btn.disabled = true; btn.textContent = 'Guardando…';
    const { error } = await core.sb.from('contenido').upsert({ clave: seccion, valor: datos });
    btn.textContent = 'Guardar cambios';
    if (error) { core.errorEn('#contenidoError', core.traducir(error)); actualizarEstado(); return; }
    documentos[seccion] = clonar(datos);
    original = JSON.stringify(datos);
    actualizarEstado();
    core.toast('Guardado. Ya se ve en la web.');
  });
  $('#btnDescartar').addEventListener('click', () => {
    if (!window.confirm('¿Descartar los cambios sin guardar?')) return;
    datos = clonar(documentos[seccion]); original = JSON.stringify(datos);
    renderFormulario(); actualizarEstado();
  });

  window.addEventListener('beforeunload', (ev) => { if (hayCambios()) { ev.preventDefault(); ev.returnValue = ''; } });
})();
