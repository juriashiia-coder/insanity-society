/* =========================================================
   INSANITY SOCIETY — lógica del sitio
   Requiere js/productos.js (PRODUCTOS, CATEGORIAS, WHATSAPP_NUMERO)
   ========================================================= */
(async () => {
  'use strict';

  // ---------- Utilidades ----------
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
  const dinero = (n) => '$' + (Number(n) || 0).toLocaleString('es-CO', { maximumFractionDigits: 0 });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const slug = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const storage = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } }
  };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const toastEl = $('#toast');
  let toastTimer;
  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 2600);
  }

  const anio = $('#anio');
  if (anio) anio.textContent = new Date().getFullYear();

  // ---------- Navbar: altura dinámica ----------
  const navbar = $('#navbar');
  function updateHeaderOffset() {
    if (!navbar) return;
    document.documentElement.style.setProperty('--header-offset', Math.ceil(navbar.getBoundingClientRect().height) + 'px');
  }
  updateHeaderOffset();
  if ('ResizeObserver' in window && navbar) new ResizeObserver(updateHeaderOffset).observe(navbar);
  window.addEventListener('scroll', () => navbar && navbar.classList.toggle('shrink', window.scrollY > 20), { passive: true });

  // ---------- Menú móvil ----------
  const menuToggle = $('#mobileMenuToggle');
  const mobileMenu = $('#mobileMenu');
  function setMenu(open) {
    if (!mobileMenu) return;
    mobileMenu.classList.toggle('hidden', !open);
    menuToggle?.setAttribute('aria-expanded', String(open));
    menuToggle?.classList.toggle('open', open);
  }
  menuToggle?.addEventListener('click', (e) => { e.stopPropagation(); setMenu(mobileMenu.classList.contains('hidden')); });
  document.addEventListener('click', (e) => {
    if (mobileMenu && !mobileMenu.contains(e.target) && !menuToggle?.contains(e.target)) setMenu(false);
  });

  // ---------- Pestañas con URL (#inicio, #tienda...) ----------
  const secciones = $$('.tab-content');
  const idsValidos = secciones.map((s) => s.id);

  function mostrarSeccion(id, { scroll = true } = {}) {
    if (!idsValidos.includes(id)) id = 'home';
    secciones.forEach((s) => {
      const activa = s.id === id;
      s.hidden = !activa;
      s.classList.toggle('active', activa);
      if (activa && !reduceMotion) { s.classList.remove('fade-in'); void s.offsetWidth; s.classList.add('fade-in'); }
    });
    $$('.tab-link').forEach((a) => {
      const activo = a.dataset.tab === id;
      a.classList.toggle('active', activo);
      if (activo) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    setMenu(false);
    if (scroll) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    const titulos = { home: 'Insanity Society — Ropa de entrenamiento con carácter', colecciones: 'Colecciones', sociedad: 'La Sociedad', tienda: 'Tienda', blog: 'Comunidad' };
    document.title = id === 'home' ? titulos.home : `${titulos[id]} | Insanity Society`;
  }
  // Admite #tienda/RAIJIN para abrir la tienda filtrada por colección
  const leerHash = () => {
    const [id, col] = decodeURIComponent(location.hash.slice(1)).split('/');
    return { id: id || 'home', col: col || null };
  };
  let filtrarColeccionDesdeHash = () => {}; // se define en la sección de filtros
  window.addEventListener('hashchange', () => {
    const { id, col } = leerHash();
    mostrarSeccion(id);
    if (id === 'tienda' && col) filtrarColeccionDesdeHash(col);
  });
  mostrarSeccion(leerHash().id, { scroll: false });

  // ---------- Video de portada: solo en conexiones/pantallas que lo aguanten ----------
  const heroVideo = $('.hero-video');
  if (heroVideo && heroVideo.dataset.src) {
    const conn = navigator.connection || {};
    const ligero = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
    if (!reduceMotion && !ligero && window.matchMedia('(min-width: 768px)').matches) {
      heroVideo.src = heroVideo.dataset.src;
      heroVideo.play().catch(() => {});
    }
  }

  // =========================================================
  // CATÁLOGO
  // =========================================================
  const catalogo = $('#catalogo');

  // ---------- Datos desde Supabase (js/config.js) con respaldo local ----------
  const cfgSb = window.INSANITY_CONFIG || {};
  const conSupabase = !!(cfgSb.supabaseUrl && cfgSb.supabaseKey);
  async function leerTabla(consulta) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 7000);
    try {
      const r = await fetch(`${cfgSb.supabaseUrl.replace(/\/+$/, '')}/rest/v1/${consulta}`, { headers: { apikey: cfgSb.supabaseKey }, signal: ctrl.signal });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.json();
    } finally { clearTimeout(timer); }
  }
  async function cargarProductos() {
    const local = window.PRODUCTOS_LOCAL || [];
    if (!conSupabase) return local;
    if (catalogo) catalogo.innerHTML = '<p class="cargando-catalogo">Cargando productos…</p>';
    try {
      const data = await leerTabla('productos?select=*&activo=eq.true&order=orden.asc,nombre.asc');
      return data.map((p) => ({ ...p, variantes: p.variantes || undefined, imagenes: p.imagenes || undefined }));
    } catch (err) {
      console.warn('No se pudo leer Supabase; se usa el catálogo local.', err);
      return local;
    }
  }
  async function cargarContenido() {
    if (!conSupabase) return {};
    try {
      const filas = await leerTabla('contenido?select=clave,valor');
      return Object.fromEntries(filas.map((f) => [f.clave, f.valor]));
    } catch (err) {
      console.warn('No se pudo leer el contenido; se usan los textos del HTML.', err);
      return {};
    }
  }
  const [PRODUCTOS, CONTENIDO] = await Promise.all([cargarProductos(), cargarContenido()]);

  // ---------- Aplicar textos editables (si existen en Supabase) ----------
  let numeroWa = WHATSAPP_NUMERO;
  const conSaltos = (t) => esc(t).replace(/\n/g, '<br />');
  const enlaceSeguro = (u) => {
    const v = String(u || '').trim();
    return v && !/^\s*(javascript|data|vbscript):/i.test(v) ? v : '';
  };
  const esExterno = (u) => /^https?:\/\//i.test(u);
  const setTexto = (sel, v) => { const el = $(sel); if (el && typeof v === 'string' && v.trim()) el.textContent = v; };

  function aplicarContenido(c) {
    const ini = c.inicio;
    if (ini) {
      if (ini.titulo?.trim()) $('#home-title').innerHTML = conSaltos(ini.titulo);
      setTexto('#home-sub', ini.subtitulo);
      setTexto('#home-btn-tienda', ini.boton_tienda);
      setTexto('#home-btn-colecciones', ini.boton_colecciones);
      if (Array.isArray(ini.franja)) {
        const f = ini.franja.filter((x) => x && (x.titulo || x.texto));
        $('#homeStrip').innerHTML = f.map((x) => `<div><strong>${esc(x.titulo)}</strong><span>${esc(x.texto)}</span></div>`).join('');
        $('#homeStrip').style.setProperty('--cols', f.length || 1);
        $('#homeStrip').hidden = !f.length;
      }
      const img = enlaceSeguro(ini.imagen_portada);
      if (img) {
        $('.hero').style.backgroundImage = `url("${img.replace(/"/g, '%22')}")`;
        $('.hero-video')?.setAttribute('poster', img);
      }
    }
    const soc = c.sociedad;
    if (soc) {
      if (soc.intro?.trim()) $('#sociedadIntro').innerHTML = `<p>${conSaltos(soc.intro)}</p>`;
      setTexto('#sociedadListaTitulo', soc.lista_titulo);
      if (Array.isArray(soc.puntos)) {
        $('#sociedadPuntos').innerHTML = soc.puntos.filter((x) => x && (x.titulo || x.texto))
          .map((x) => `<li>${x.titulo ? `<strong>${esc(x.titulo)}:</strong> ` : ''}${esc(x.texto)}</li>`).join('');
      }
      setTexto('#manifiestoTitulo', soc.manifiesto_titulo);
      if (soc.manifiesto?.trim()) $('#manifiestoTexto').innerHTML = conSaltos(soc.manifiesto);
    }
    const col = c.colecciones;
    if (col) {
      if (col.intro?.trim()) $('#coleccionesIntro').innerHTML = `<p>${conSaltos(col.intro)}</p>`;
      if (Array.isArray(col.items)) {
        $('#coleccionesGrid').innerHTML = col.items.filter((x) => x && x.visible !== false && x.nombre).map((x) => {
          const link = enlaceSeguro(x.enlace);
          const extra = x.leyenda || link
            ? `<div class="raijin-legend">
                 ${x.leyenda_titulo ? `<h4>${esc(x.leyenda_titulo)}</h4>` : ''}
                 ${x.leyenda ? `<p>${conSaltos(x.leyenda)}</p>` : ''}
                 ${link ? `<a class="btn-primario" href="${esc(link)}"${esExterno(link) ? ' target="_blank" rel="noopener"' : ''}>${esc(x.enlace_texto || 'Ver más')}</a>` : ''}
               </div>` : '';
          return `<article class="col-card${x.destacada ? ' col-card--destacada' : ''}" data-coleccion="${esc(x.nombre)}">
              <h3>${esc(x.nombre)}${x.jp ? ` <span class="jp">${esc(x.jp)}</span>` : ''}</h3>
              ${x.descripcion ? `<p>${conSaltos(x.descripcion)}</p>` : ''}
              ${extra}
            </article>`;
        }).join('');
      }
    }
    if (c.tienda?.intro?.trim()) $('#tiendaIntro').innerHTML = `<p>${conSaltos(c.tienda.intro)}</p>`;
    const com = c.comunidad;
    if (com && Array.isArray(com.items)) {
      $('#blogGrid').innerHTML = com.items.filter((x) => x && x.visible !== false && x.titulo).map((x) => {
        const link = enlaceSeguro(x.enlace);
        const img = enlaceSeguro(x.imagen);
        const tag = x.etiqueta ? `<span class="tag${x.etiqueta_gris ? ' tag--muted' : ''}">${esc(x.etiqueta)}</span>` : '';
        const cuerpo = `
          ${img ? `<img class="blog-thumb" src="${esc(img)}" alt="${esc(x.titulo)}" loading="lazy" decoding="async" />` : ''}
          ${tag}
          <h3>${esc(x.titulo)}</h3>
          ${x.fecha ? `<p class="blog-fecha">${esc(x.fecha)}</p>` : ''}
          ${x.resumen ? `<p>${conSaltos(x.resumen)}</p>` : ''}
          ${link ? `<span class="blog-mas">${esc(x.enlace_texto || 'Ver más')} →</span>` : ''}`;
        const clases = ['blog-card', x.destacada ? 'blog-card--evento' : '', img ? 'blog-card--img' : ''].filter(Boolean).join(' ');
        return link
          ? `<article class="${clases}"><a class="blog-link" href="${esc(link)}"${esExterno(link) ? ' target="_blank" rel="noopener"' : ''}>${cuerpo}</a></article>`
          : `<article class="${clases}">${cuerpo}</article>`;
      }).join('');
    }
    const gen = c.general;
    if (gen) {
      if (/^57\d{10}$/.test(gen.whatsapp || '')) {
        numeroWa = gen.whatsapp;
        const a = $('#footerWhatsapp');
        if (a) { a.href = `https://wa.me/${numeroWa}`; a.textContent = `WhatsApp +57 ${numeroWa.slice(2, 5)} ${numeroWa.slice(5, 8)} ${numeroWa.slice(8)}`; }
      }
      setTexto('#footerTexto', gen.pie);
    }
  }
  try { aplicarContenido(CONTENIDO); } catch (err) { console.warn('Contenido con formato inesperado; se mantienen los textos del HTML.', err); }

  const productosPorId = new Map(PRODUCTOS.map((p) => [p.id, p]));

  function imagenesDe(p, color) {
    if (!p.imagenes) return null;
    if (p.imagenes[color]) return { ...p.imagenes[color], referencia: false };
    const primera = Object.keys(p.imagenes)[0];
    return primera ? { ...p.imagenes[primera], referencia: true, colorRef: primera } : null;
  }
  function precioDe(p, varianteNombre) {
    const v = p.variantes?.find((x) => x.nombre === varianteNombre);
    return v ? v.precio : p.precio;
  }

  function chips(nombre, valores, tipo, seleccionado) {
    return valores.map((v) => `
      <label class="chip chip--${tipo}">
        <input type="radio" name="${nombre}" value="${esc(v)}" ${v === seleccionado ? 'checked' : ''} />
        <span>${tipo === 'color' ? `<i class="swatch" style="--sw:${colorCss(v)}"></i>` : ''}${esc(v)}</span>
      </label>`).join('');
  }
  function colorCss(c) {
    const m = { negro: '#111', blanco: '#f2f2f2', gris: '#8a8a8a', 'gris claro': '#c4c4c4', 'gris oscuro': '#4a4a4a', 'verde militar': '#4b5320', 'azul turqui': '#1b2a4a', beige: '#d8c3a5', vinotinto: '#5e0b1a', rojo: '#c1121f' };
    return m[slug(c).replace(/-/g, ' ')] || '#666';
  }

  function tarjetaProducto(p) {
    const colorIni = p.colores[0];
    const varIni = p.variantes?.[0]?.nombre;
    const imgs = imagenesDe(p, colorIni);
    const precio = precioDe(p, varIni);
    const sinPrecio = p.precio == null;

    const media = imgs
      ? `<img class="product-img" src="${esc(imgs.frente)}" alt="${esc(p.nombre)} — frente" width="900" height="900" loading="lazy" decoding="async" />`
      : '';
    const vista = imgs?.espalda
      ? `<div class="view-toggle" role="group" aria-label="Vista">
           <button type="button" class="view-btn active" data-view="frente" aria-pressed="true">Frente</button>
           <button type="button" class="view-btn" data-view="espalda" aria-pressed="false">Espalda</button>
         </div>` : '';

    return `
      <article class="card producto" data-id="${esc(p.id)}">
        <div class="product-media ${imgs ? '' : 'sin-foto'}" data-label="${esc(p.coleccion)}">
          ${media}
          <span class="foto-ref ${imgs?.referencia ? '' : 'hidden'}">Foto de referencia</span>
          ${vista}
        </div>
        <div class="producto-info">
          <p class="producto-col">${esc(p.coleccion)}</p>
          <h4 class="producto-nombre">${esc(p.nombre)}</h4>
          <p class="producto-material">${esc(p.material)}</p>
          <p class="precio">${sinPrecio ? 'Precio por confirmar' : dinero(precio)}</p>
          ${sinPrecio ? `
            <a class="btn-secundario btn-bloque" target="_blank" rel="noopener"
               href="https://wa.me/${numeroWa}?text=${encodeURIComponent(`Hola, quiero información y precio de: ${p.nombre}`)}">Consultar por WhatsApp</a>`
          : `
            ${p.variantes ? `<fieldset class="opciones"><legend>Material</legend>${chips('var-' + p.id, p.variantes.map((v) => v.nombre), 'var', varIni)}</fieldset>` : ''}
            <fieldset class="opciones"><legend>Color${p.colores.length > 1 ? '' : ': ' + esc(colorIni)}</legend>${p.colores.length > 1 ? chips('color-' + p.id, p.colores, 'color', colorIni) : `<input type="hidden" name="color-${esc(p.id)}" value="${esc(colorIni)}">`}</fieldset>
            <fieldset class="opciones"><legend>Talla</legend>${chips('talla-' + p.id, p.tallas, 'talla', p.tallas.length === 1 ? p.tallas[0] : null)}</fieldset>
            <p class="opciones-error hidden" role="alert">Elige tu talla.</p>
            <button type="button" class="agregar-carrito btn-primario btn-bloque">Agregar al carrito</button>`}
        </div>
      </article>`;
  }

  function renderCatalogo() {
    if (!catalogo) return;
    catalogo.innerHTML = `<div class="productos">${PRODUCTOS.map(tarjetaProducto).join('')}</div>`;
  }
  renderCatalogo();

  // Imagen que no carga → recuadro con el nombre de la colección
  catalogo?.addEventListener('error', (e) => {
    if (e.target.matches?.('.product-img')) {
      const media = e.target.closest('.product-media');
      e.target.remove();
      media.classList.add('sin-foto');
      media.querySelector('.view-toggle')?.remove();
    }
  }, true);

  // Interacciones de tarjeta (delegadas)
  catalogo?.addEventListener('click', (e) => {
    const card = e.target.closest('.producto');
    if (!card) return;
    const p = productosPorId.get(card.dataset.id);

    const vb = e.target.closest('.view-btn');
    if (vb) {
      $$('.view-btn', card).forEach((b) => { b.classList.toggle('active', b === vb); b.setAttribute('aria-pressed', String(b === vb)); });
      actualizarImagen(card, p);
      return;
    }
    if (e.target.closest('.agregar-carrito')) agregarDesdeTarjeta(card, p);
  });
  catalogo?.addEventListener('change', (e) => {
    const card = e.target.closest('.producto');
    if (!card) return;
    const p = productosPorId.get(card.dataset.id);
    if (e.target.name.startsWith('color-')) actualizarImagen(card, p);
    if (e.target.name.startsWith('var-')) $('.precio', card).textContent = dinero(precioDe(p, e.target.value));
    if (e.target.name.startsWith('talla-')) $('.opciones-error', card)?.classList.add('hidden');
  });

  const valorSel = (card, name) => (card.querySelector(`input[name="${CSS.escape(name)}"]:checked`) || card.querySelector(`input[type=hidden][name="${CSS.escape(name)}"]`))?.value || null;

  function actualizarImagen(card, p) {
    const img = $('.product-img', card);
    if (!img) return;
    const color = valorSel(card, 'color-' + p.id) || p.colores[0];
    const imgs = imagenesDe(p, color);
    if (!imgs) return;
    const vista = $('.view-btn.active', card)?.dataset.view || 'frente';
    const src = imgs[vista] || imgs.frente;
    if (img.getAttribute('src') !== src) img.src = src;
    img.alt = `${p.nombre} — ${vista}`;
    $('.foto-ref', card)?.classList.toggle('hidden', !imgs.referencia);
  }

  // =========================================================
  // CARRITO
  // =========================================================
  const CLAVE_CARRITO = 'insanity-carrito-v2';
  const carritoPanel = $('#carrito');
  const carritoOverlay = $('#carritoOverlay');
  const listaCarrito = $('#lista-carrito');
  const totalEl = $('#total');
  const contador = $('#contadorCarrito');
  const btnPedido = $('#realizarPedido');
  const btnCarrito = $('#toggleCarrito');

  // Cargar y validar contra el catálogo actual (precios siempre vigentes)
  let carrito = (storage.get(CLAVE_CARRITO) || []).filter((it) => {
    const p = productosPorId.get(it.id);
    if (!p || p.precio == null) return false;
    it.precio = precioDe(p, it.variante);
    it.nombre = p.nombre;
    it.cantidad = Math.max(1, Math.min(20, parseInt(it.cantidad, 10) || 1));
    return true;
  });

  function agregarDesdeTarjeta(card, p) {
    const talla = valorSel(card, 'talla-' + p.id);
    if (!talla) {
      $('.opciones-error', card)?.classList.remove('hidden');
      card.querySelector(`input[name="${CSS.escape('talla-' + p.id)}"]`)?.focus();
      return;
    }
    const color = valorSel(card, 'color-' + p.id) || p.colores[0];
    const variante = p.variantes ? valorSel(card, 'var-' + p.id) : null;
    const key = [p.id, color, talla, variante || ''].join('|');
    const existente = carrito.find((i) => i.key === key);
    if (existente) existente.cantidad = Math.min(20, existente.cantidad + 1);
    else carrito.push({ key, id: p.id, nombre: p.nombre, coleccion: p.coleccion, color, talla, variante, precio: precioDe(p, variante), cantidad: 1 });
    guardarYRender();
    toast(`Agregado: ${p.nombre} · ${color} · ${talla}`);
    btnCarrito?.classList.remove('pulse'); void btnCarrito?.offsetWidth; btnCarrito?.classList.add('pulse');
  }

  const totalCarrito = () => carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  const detalleItem = (i) => [i.variante, `Color: ${i.color}`, `Talla: ${i.talla}`].filter(Boolean).join(' · ');

  function guardarYRender() {
    storage.set(CLAVE_CARRITO, carrito);
    const unidades = carrito.reduce((s, i) => s + i.cantidad, 0);
    listaCarrito.innerHTML = carrito.map((i) => `
      <li class="item-carrito" data-key="${esc(i.key)}">
        <div class="item-info">
          <strong>${esc(i.nombre)}</strong>
          <small>${esc(detalleItem(i))}</small>
          <small>${dinero(i.precio)} c/u</small>
        </div>
        <div class="item-acciones">
          <div class="qty" role="group" aria-label="Cantidad">
            <button type="button" data-accion="menos" aria-label="Quitar una unidad">−</button>
            <span>${i.cantidad}</span>
            <button type="button" data-accion="mas" aria-label="Agregar una unidad">+</button>
          </div>
          <span class="item-subtotal">${dinero(i.precio * i.cantidad)}</span>
          <button type="button" class="item-quitar" data-accion="quitar" aria-label="Eliminar ${esc(i.nombre)}">Eliminar</button>
        </div>
      </li>`).join('');
    $('#carritoVacio')?.classList.toggle('hidden', carrito.length > 0);
    totalEl.textContent = dinero(totalCarrito());
    contador.textContent = unidades;
    contador.classList.toggle('hidden', unidades === 0);
    btnPedido.disabled = carrito.length === 0;
  }

  listaCarrito?.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-accion]');
    if (!btn) return;
    const key = btn.closest('.item-carrito').dataset.key;
    const item = carrito.find((i) => i.key === key);
    if (!item) return;
    if (btn.dataset.accion === 'mas') item.cantidad = Math.min(20, item.cantidad + 1);
    if (btn.dataset.accion === 'menos') item.cantidad -= 1;
    if (btn.dataset.accion === 'quitar' || item.cantidad < 1) carrito = carrito.filter((i) => i.key !== key);
    guardarYRender();
  });

  let ultimoFoco = null;
  function setCarrito(open) {
    if (open) ultimoFoco = document.activeElement;
    carritoPanel.classList.toggle('active', open);
    carritoPanel.setAttribute('aria-hidden', String(!open));
    carritoOverlay.classList.toggle('hidden', !open);
    btnCarrito?.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
    if (open) $('#cerrarCarrito')?.focus(); else ultimoFoco?.focus?.();
  }
  btnCarrito?.addEventListener('click', () => setCarrito(!carritoPanel.classList.contains('active')));
  $('#cerrarCarrito')?.addEventListener('click', () => setCarrito(false));
  carritoOverlay?.addEventListener('click', () => setCarrito(false));

  guardarYRender();

  // =========================================================
  // FILTROS
  // =========================================================
  const filtros = { categoria: new Set(), coleccion: new Set(), talla: new Set(), color: new Set() };
  const panel = $('#filtersPanel');
  const filtersOverlay = $('#filtersOverlay');
  const btnFiltros = $('#openFilters');

  const valoresDe = {
    categoria: (p) => [p.categoria],
    coleccion: (p) => [p.coleccion],
    talla: (p) => p.tallas,
    color: (p) => p.colores
  };
  const etiqueta = (grupo, v) => (grupo === 'categoria' ? CATEGORIAS[v] || v : v);
  const ORDEN_TALLAS = ['S', 'M', 'L', 'XL', 'Única'];

  function opcionesUnicas(grupo) {
    const set = new Set();
    PRODUCTOS.forEach((p) => valoresDe[grupo](p).forEach((v) => set.add(v)));
    const arr = Array.from(set);
    if (grupo === 'talla') return arr.sort((a, b) => ORDEN_TALLAS.indexOf(a) - ORDEN_TALLAS.indexOf(b));
    if (grupo === 'coleccion') return arr; // orden del catálogo
    return arr.sort((a, b) => etiqueta(grupo, a).localeCompare(etiqueta(grupo, b), 'es'));
  }

  function renderOpcionesFiltro() {
    const conts = { categoria: '#filtroCategoria', coleccion: '#filtroColeccion', talla: '#filtroTalla', color: '#filtroColor' };
    Object.entries(conts).forEach(([g, sel]) => {
      const cont = $(sel);
      if (!cont) return;
      cont.innerHTML = opcionesUnicas(g).map((v) => `
        <label class="chip">
          <input type="checkbox" name="f-${g}" value="${esc(v)}" ${filtros[g].has(v) ? 'checked' : ''} />
          <span>${g === 'color' ? `<i class="swatch" style="--sw:${colorCss(v)}"></i>` : ''}${esc(etiqueta(g, v))}</span>
        </label>`).join('');
    });
  }

  const coincide = (p) => Object.entries(filtros).every(([g, set]) => !set.size || valoresDe[g](p).some((v) => set.has(v)));

  function aplicarFiltros() {
    let visibles = 0;
    $$('.producto', catalogo).forEach((card) => {
      const ok = coincide(productosPorId.get(card.dataset.id));
      card.hidden = !ok;
      if (ok) visibles++;
    });
    $('#noResultados')?.classList.toggle('hidden', visibles > 0);
    const activos = Object.values(filtros).reduce((s, set) => s + set.size, 0);
    const badge = $('#filtrosActivos');
    if (badge) { badge.textContent = activos; badge.classList.toggle('hidden', activos === 0); }
    const txt = $('#resultadosTxt');
    if (txt) txt.textContent = activos ? `${visibles} producto${visibles === 1 ? '' : 's'}` : '';
    const ap = $('#applyFilters');
    if (ap) ap.textContent = `Ver ${visibles} resultado${visibles === 1 ? '' : 's'}`;
  }

  panel?.addEventListener('change', (e) => {
    const m = e.target.name?.match(/^f-(.+)$/);
    if (!m) return;
    filtros[m[1]][e.target.checked ? 'add' : 'delete'](e.target.value);
    aplicarFiltros();
  });

  function limpiarFiltros() { Object.values(filtros).forEach((s) => s.clear()); renderOpcionesFiltro(); aplicarFiltros(); }
  function setPanel(open) {
    panel.classList.toggle('open', open);
    panel.setAttribute('aria-hidden', String(!open));
    filtersOverlay.classList.toggle('hidden', !open);
    btnFiltros?.setAttribute('aria-expanded', String(open));
    document.body.classList.toggle('no-scroll', open);
    if (open) $('#closeFilters')?.focus();
  }
  btnFiltros?.addEventListener('click', () => setPanel(true));
  $('#closeFilters')?.addEventListener('click', () => setPanel(false));
  $('#applyFilters')?.addEventListener('click', () => setPanel(false));
  filtersOverlay?.addEventListener('click', () => setPanel(false));
  $('#resetFilters')?.addEventListener('click', limpiarFiltros);
  $('#clearFilters')?.addEventListener('click', limpiarFiltros);

  renderOpcionesFiltro();
  aplicarFiltros();

  // Filtrar por colección (desde #tienda/COLECCION o botones "Ver productos")
  const coleccionesConProductos = new Set(PRODUCTOS.map((p) => p.coleccion));
  filtrarColeccionDesdeHash = (col) => {
    const real = Array.from(coleccionesConProductos).find((c) => slug(c) === slug(col));
    if (!real) return;
    Object.values(filtros).forEach((s) => s.clear());
    filtros.coleccion.add(real);
    renderOpcionesFiltro();
    aplicarFiltros();
  };
  { const { id, col } = leerHash(); if (id === 'tienda' && col) filtrarColeccionDesdeHash(col); }

  const slugsConProductos = new Map(Array.from(coleccionesConProductos, (c) => [slug(c), c]));
  $$('.col-card[data-coleccion]').forEach((card) => {
    const col = slugsConProductos.get(slug(card.dataset.coleccion));
    if (!col) return;
    const btn = document.createElement('a');
    btn.href = '#tienda/' + encodeURIComponent(col);
    btn.className = 'col-cta';
    btn.textContent = 'Ver productos →';
    card.appendChild(btn);
  });

  // =========================================================
  // CHECKOUT → WHATSAPP
  // =========================================================
  const CIUDADES_CO = {
    'Amazonas': ['Leticia', 'Puerto Nariño'],
    'Antioquia': ['Medellín', 'Bello', 'Envigado', 'Itagüí', 'Sabaneta', 'Rionegro', 'La Ceja', 'Apartadó', 'Turbo', 'Caucasia'],
    'Arauca': ['Arauca', 'Saravena', 'Tame'],
    'Atlántico': ['Barranquilla', 'Soledad', 'Malambo', 'Galapa', 'Sabanalarga', 'Puerto Colombia'],
    'Bogotá D.C.': ['Bogotá'],
    'Bolívar': ['Cartagena', 'Magangué', 'Turbaco'],
    'Boyacá': ['Tunja', 'Duitama', 'Sogamoso', 'Chiquinquirá'],
    'Caldas': ['Manizales', 'Villamaría', 'Chinchiná'],
    'Caquetá': ['Florencia', 'San Vicente del Caguán'],
    'Casanare': ['Yopal', 'Aguazul', 'Villanueva', 'Tauramena', 'Monterrey', 'Paz de Ariporo', 'Maní'],
    'Cauca': ['Popayán', 'Santander de Quilichao'],
    'Cesar': ['Valledupar', 'Aguachica'],
    'Chocó': ['Quibdó', 'Istmina'],
    'Córdoba': ['Montería', 'Lorica', 'Cereté', 'Sahagún'],
    'Cundinamarca': ['Soacha', 'Chía', 'Zipaquirá', 'Facatativá', 'Girardot', 'Fusagasugá', 'Cajicá', 'Mosquera', 'Madrid', 'Funza'],
    'Guainía': ['Inírida'],
    'Guaviare': ['San José del Guaviare'],
    'Huila': ['Neiva', 'Pitalito', 'Garzón'],
    'La Guajira': ['Riohacha', 'Maicao', 'Uribia'],
    'Magdalena': ['Santa Marta', 'Ciénaga', 'Fundación'],
    'Meta': ['Villavicencio', 'Acacías', 'Granada', 'Puerto López'],
    'Nariño': ['Pasto', 'Ipiales', 'Tumaco'],
    'Norte de Santander': ['Cúcuta', 'Ocaña', 'Villa del Rosario', 'Los Patios'],
    'Putumayo': ['Mocoa', 'Puerto Asís', 'Orito'],
    'Quindío': ['Armenia', 'Calarcá', 'La Tebaida', 'Montenegro'],
    'Risaralda': ['Pereira', 'Dosquebradas', 'Santa Rosa de Cabal', 'La Virginia'],
    'San Andrés y Providencia': ['San Andrés', 'Providencia'],
    'Santander': ['Bucaramanga', 'Floridablanca', 'Girón', 'Piedecuesta', 'Barrancabermeja', 'San Gil'],
    'Sucre': ['Sincelejo', 'Corozal'],
    'Tolima': ['Ibagué', 'Espinal', 'Honda'],
    'Valle del Cauca': ['Cali', 'Palmira', 'Jamundí', 'Yumbo', 'Buenaventura', 'Tuluá', 'Cartago', 'Buga'],
    'Vaupés': ['Mitú'],
    'Vichada': ['Puerto Carreño']
  };
  const OTRA = 'Otro municipio';

  const checkoutModal = $('#checkoutModal');
  const form = $('#checkoutForm');
  const f = {
    nombre: $('#nombreApellido'), cedula: $('#cedula'), celular: $('#celular'),
    dep: $('#departamento'), ciudad: $('#ciudad'), ciudadOtra: $('#ciudadOtra'),
    direccion: $('#direccion'), barrio: $('#barrio'), notas: $('#notas'), autorizo: $('#autorizo')
  };

  Object.keys(CIUDADES_CO).sort((a, b) => a.localeCompare(b, 'es')).forEach((d) => f.dep.add(new Option(d, d)));
  f.dep.addEventListener('change', () => {
    f.ciudad.innerHTML = '';
    f.ciudad.add(new Option('Selecciona', '', true, true));
    f.ciudad.options[0].disabled = true;
    [...(CIUDADES_CO[f.dep.value] || []), OTRA].forEach((c) => f.ciudad.add(new Option(c, c)));
    f.ciudad.disabled = false;
    f.ciudadOtra.classList.add('hidden');
  });
  f.ciudad.addEventListener('change', () => {
    const otra = f.ciudad.value === OTRA;
    f.ciudadOtra.classList.toggle('hidden', !otra);
    if (otra) f.ciudadOtra.focus();
  });
  // Solo dígitos en cédula y celular
  [f.cedula, f.celular].forEach((el) => el.addEventListener('input', () => { el.value = el.value.replace(/\D/g, '').slice(0, 12); }));

  const reglas = {
    nombre: () => f.nombre.value.trim().split(/\s+/).length >= 2 && f.nombre.value.trim().length >= 5,
    cedula: () => /^\d{5,12}$/.test(f.cedula.value),
    celular: () => /^3\d{9}$/.test(f.celular.value),
    dep: () => !!f.dep.value,
    ciudad: () => !!f.ciudad.value && (f.ciudad.value !== OTRA || f.ciudadOtra.value.trim().length >= 3),
    direccion: () => f.direccion.value.trim().length >= 6,
    barrio: () => f.barrio.value.trim().length >= 3,
    autorizo: () => f.autorizo.checked
  };
  function validarCampo(k, mostrar) {
    const ok = reglas[k]();
    const row = f[k].closest('.form-row, .check-row');
    if (mostrar) row?.classList.toggle('invalido', !ok);
    f[k].setAttribute('aria-invalid', String(!ok));
    return ok;
  }
  form.addEventListener('focusout', (e) => {
    const k = Object.keys(f).find((key) => f[key] === e.target || (key === 'ciudad' && e.target === f.ciudadOtra));
    if (k && reglas[k]) validarCampo(k, true);
  });
  form.addEventListener('input', (e) => {
    const row = e.target.closest('.invalido');
    if (row) { const k = Object.keys(reglas).find((key) => row.contains(f[key])); if (k) validarCampo(k, true); }
  });
  form.addEventListener('change', (e) => { if (e.target === f.autorizo) validarCampo('autorizo', true); });

  function resumenHtml() {
    return `<ul>${carrito.map((i) => `<li><span>${esc(i.nombre)} <small>${esc(detalleItem(i))} · x${i.cantidad}</small></span><strong>${dinero(i.precio * i.cantidad)}</strong></li>`).join('')}</ul>`;
  }
  function setCheckout(open) {
    checkoutModal.classList.toggle('hidden', !open);
    document.body.classList.toggle('no-scroll', open || carritoPanel.classList.contains('active'));
    if (open) {
      $('#checkoutResumen').innerHTML = resumenHtml();
      $('#checkoutTotal').textContent = 'Total productos: ' + dinero(totalCarrito()) + ' (envío por confirmar)';
      const guardado = storage.get('insanity-cliente');
      if (guardado) Object.entries(guardado).forEach(([k, v]) => { if (f[k] && k !== 'autorizo' && !f[k].value) f[k].value = v; });
      if (guardado?.dep) { f.dep.dispatchEvent(new Event('change')); f.ciudad.value = guardado.ciudad || ''; if (f.ciudad.value === OTRA) f.ciudadOtra.classList.remove('hidden'); }
      f.nombre.focus();
    }
  }
  btnPedido.addEventListener('click', () => { if (carrito.length) { setCarrito(false); setCheckout(true); } });
  $('#cerrarCheckout').addEventListener('click', () => { setCheckout(false); setCarrito(true); });
  $('#cerrarCheckoutModal').addEventListener('click', () => setCheckout(false));
  checkoutModal.addEventListener('click', (e) => { if (e.target === checkoutModal) setCheckout(false); });

  $('#enviarWhatsapp').addEventListener('click', () => {
    if (!carrito.length) return;
    const fallos = Object.keys(reglas).filter((k) => !validarCampo(k, true));
    if (fallos.length) { (f[fallos[0]] || f.nombre).focus(); toast('Revisa los campos marcados.'); return; }

    const ciudad = f.ciudad.value === OTRA ? f.ciudadOtra.value.trim() : f.ciudad.value;
    storage.set('insanity-cliente', {
      nombre: f.nombre.value.trim(), celular: f.celular.value, dep: f.dep.value, ciudad: f.ciudad.value,
      ciudadOtra: f.ciudadOtra.value.trim(), direccion: f.direccion.value.trim(), barrio: f.barrio.value.trim()
    });

    const lineas = carrito.map((i) => `• ${i.nombre}\n   ${detalleItem(i)} · Cant: ${i.cantidad} · ${dinero(i.precio * i.cantidad)}`);
    const mensaje = [
      '*NUEVO PEDIDO — INSANITY SOCIETY*', '',
      ...lineas, '',
      `*Total productos: ${dinero(totalCarrito())}*`, '',
      '*Datos de envío*',
      `Nombre: ${f.nombre.value.trim()}`,
      `Cédula: ${f.cedula.value}`,
      `Celular: ${f.celular.value}`,
      `Ciudad: ${ciudad}, ${f.dep.value}`,
      `Dirección: ${f.direccion.value.trim()}`,
      `Barrio: ${f.barrio.value.trim()}`,
      f.notas.value.trim() ? `Notas: ${f.notas.value.trim()}` : null
    ].filter((l) => l !== null).join('\n');

    const url = `https://wa.me/${numeroWa}?text=${encodeURIComponent(mensaje)}`;
    const win = window.open(url, '_blank');
    if (win) win.opener = null; else location.href = url; // si el navegador bloquea la ventana

    carrito = [];
    guardarYRender();
    form.reset();
    setCheckout(false);
    toast('¡Pedido listo! Envía el mensaje en WhatsApp para confirmarlo.');
  });

  // ---------- Tecla Escape cierra lo que esté abierto ----------
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!checkoutModal.classList.contains('hidden')) setCheckout(false);
    else if (panel.classList.contains('open')) setPanel(false);
    else if (carritoPanel.classList.contains('active')) setCarrito(false);
    else setMenu(false);
  });
})();
