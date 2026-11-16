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
  const soloCelular = (v) => { const d = String(v || '').replace(/\D/g, ''); return (/^57\d{10}$/.test(d) ? d.slice(2) : d).slice(0, 10); };
  // Tiempo de confección (editable en el panel: General)
  const CONFECCION_DEF = 'Prendas hechas sobre pedido: se despachan de 2 a 3 días hábiles.';
  const textoConfeccion = () => CONTENIDO?.general?.tiempo_confeccion?.trim() || CONFECCION_DEF; // se usa después de cargar el contenido
  const ENVIO_DEF = 'El envío no está incluido en el total: su costo depende de la ciudad y te lo confirmamos por WhatsApp.';
  const textoEnvio = () => CONTENIDO?.general?.nota_envio?.trim() || ENVIO_DEF;
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
    $$('.btn-nav-icono').forEach((a) => a.classList.toggle('active', a.dataset.tab === id));
    setMenu(false);
    if (scroll) window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    const titulos = { home: 'Insanity Society — Ropa de entrenamiento con carácter', colecciones: 'Colecciones', sociedad: 'La Sociedad', tienda: 'Tienda', blog: 'Comunidad', favoritos: 'Favoritos', mispedidos: 'Mis pedidos', preventa: 'Preventa' };
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
      setTexto('#destacadosTitulo', ini.destacados_titulo);
      const bar = $('#promoBar');
      let cerrada = false; try { cerrada = sessionStorage.getItem('insanity-promo-cerrada') === (ini.promo_texto || ''); } catch { /* */ }
      if (bar && ini.promo_activa && ini.promo_texto?.trim() && !cerrada) {
        const link = enlaceSeguro(ini.promo_enlace);
        $('#promoTexto').innerHTML = link
          ? `<a href="${esc(link)}"${esExterno(link) ? ' target="_blank" rel="noopener"' : ''}>${esc(ini.promo_texto)} <span aria-hidden="true">→</span></a>`
          : esc(ini.promo_texto);
        bar.hidden = false;
        $('#cerrarPromo')?.addEventListener('click', () => { bar.hidden = true; try { sessionStorage.setItem('insanity-promo-cerrada', ini.promo_texto || ''); } catch { /* */ } });
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
  // Ofertas: % de descuento por producto, con fecha de fin opcional
  const ofertaActiva = (p) => {
    const pct = Number(p.oferta_pct) || 0;
    return pct > 0 && pct <= 90 && (!p.oferta_hasta || new Date(p.oferta_hasta) > new Date()) ? pct : 0;
  };
  const redondear = (n) => Math.round(n / 100) * 100;
  // Preventa: se aparta antes del lanzamiento hasta la fecha de cierre
  const enPreventa = (p) => !!p?.preventa && (!p.preventa_hasta || new Date(p.preventa_hasta) > new Date());
  const preventaCerrada = (p) => !!p?.preventa && !!p.preventa_hasta && new Date(p.preventa_hasta) <= new Date();
  function faltaPara(fecha) {
    const ms = new Date(fecha) - Date.now();
    if (ms <= 0) return null;
    const min = Math.floor(ms / 60000), h = Math.floor(min / 60), d = Math.floor(h / 24);
    return d >= 1 ? `${d} d ${h % 24} h` : h >= 1 ? `${h} h ${min % 60} min` : `${Math.max(1, min)} min`;
  }
  const textoCierre = (p) => {
    if (!p.preventa_hasta) return 'Cupos limitados';
    const f = faltaPara(p.preventa_hasta);
    return f ? `Cierra en ${f}` : 'Preventa cerrada';
  };
  const spanCierre = (p) => `<span${p.preventa_hasta ? ` data-cierre="${esc(p.preventa_hasta)}"` : ''}>${esc(textoCierre(p))}</span>`;
  function precioBaseDe(p, varianteNombre) {
    const v = p.variantes?.find((x) => x.nombre === varianteNombre);
    return v ? v.precio : p.precio;
  }
  function precioDe(p, varianteNombre) {
    const base = precioBaseDe(p, varianteNombre);
    const pct = ofertaActiva(p);
    return base == null || !pct ? base : redondear(base * (1 - pct / 100));
  }
  function precioHtml(p, varianteNombre) {
    const pct = ofertaActiva(p);
    if (!pct) return dinero(precioBaseDe(p, varianteNombre));
    return `<span class="precio-antes">${dinero(precioBaseDe(p, varianteNombre))}</span> <span class="precio-oferta">${dinero(precioDe(p, varianteNombre))}</span>`;
  }
  // Inventario por color y talla: p.stock = { "Negro|M": 4, ... }. Sin stock = sin control (ilimitado)
  const conInventario = (p) => !!p.stock && typeof p.stock === 'object' && !Array.isArray(p.stock);
  const stockDe = (p, color, talla) => (conInventario(p) ? Math.max(0, parseInt(p.stock[`${color}|${talla}`], 10) || 0) : Infinity);
  const colorDisponible = (p, c) => !conInventario(p) || p.tallas.some((t) => stockDe(p, c, t) > 0);
  const agotado = (p) => conInventario(p) && !p.colores.some((c) => colorDisponible(p, c));
  const fechaCorta = (f) => new Date(f).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });

  function chips(nombre, valores, tipo, seleccionado) {
    return valores.map((v) => `
      <label class="chip chip--${tipo}" title="${esc(v)}">
        <input type="radio" name="${nombre}" value="${esc(v)}" ${v === seleccionado ? 'checked' : ''} />
        <span>${tipo === 'color' ? `<i class="swatch" style="--sw:${colorCss(v)}"></i>` : ''}<span class="chip-txt">${esc(v)}</span></span>
      </label>`).join('');
  }
  function colorCss(c) {
    const m = { negro: '#111', blanco: '#f2f2f2', gris: '#8a8a8a', 'gris claro': '#c4c4c4', 'gris oscuro': '#4a4a4a', 'verde militar': '#4b5320', 'azul turqui': '#1b2a4a', azul: '#1f3a8a', 'azul oscuro': '#14213d', beige: '#d8c3a5', arena: '#c9b48f', cafe: '#5b3a24', vinotinto: '#5e0b1a', rojo: '#c1121f', rosado: '#e86ca8', 'mora leche': '#b79fc4', 'verde pastel': '#a8d5ba' };
    return m[slug(c).replace(/-/g, ' ')] || '#666';
  }

  // ---------- Favoritos (se guardan en este dispositivo) ----------
  const CLAVE_FAV = 'insanity-favoritos';
  let favoritos = new Set((storage.get(CLAVE_FAV) || []).filter((x) => typeof x === 'string'));
  const esFavorito = (id) => favoritos.has(id);
  const botonFav = (p, extra = '') => `<button type="button" class="btn-fav ${extra}" data-fav="${esc(p.id)}" aria-pressed="${esFavorito(p.id)}" aria-label="${esFavorito(p.id) ? 'Quitar de favoritos' : 'Agregar a favoritos'}: ${esc(p.nombre)}" title="Favoritos"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.6 4.2 13A5 5 0 0 1 12 6.6 5 5 0 0 1 19.8 13Z"/></svg></button>`;

  function tarjetaProducto(p, pref = 't') {
    const uid = `${pref}-${p.id}`;
    const pct = ofertaActiva(p);
    const colorIni = p.colores.find((c) => colorDisponible(p, c)) || p.colores[0];
    const varIni = p.variantes?.[0]?.nombre;
    const imgs = imagenesDe(p, colorIni);
    const sinPrecio = p.precio == null;
    const sinUnidades = agotado(p);

    const media = imgs
      ? `<img class="product-img" src="${esc(imgs.frente)}" alt="${esc(p.nombre)} — frente" width="900" height="900" loading="lazy" decoding="async" />`
      : '';
    const vista = imgs?.espalda
      ? `<div class="view-toggle" role="group" aria-label="Vista">
           <button type="button" class="view-btn active" data-view="frente" aria-pressed="true">Frente</button>
           <button type="button" class="view-btn" data-view="espalda" aria-pressed="false">Espalda</button>
         </div>` : '';

    return `
      <article class="card producto" data-id="${esc(p.id)}" data-uid="${esc(uid)}">
        <div class="product-media ${imgs ? '' : 'sin-foto'}" data-label="${esc(p.coleccion)}">
          ${media}
          ${pct ? `<span class="badge-oferta">-${pct}%</span>` : ''}
          ${sinUnidades ? '<span class="badge-agotado">Agotado</span>' : ''}
          <span class="foto-ref ${imgs?.referencia ? '' : 'hidden'}">Foto de referencia</span>
          ${vista}
        </div>
        <div class="producto-info">
          <p class="producto-col">${esc(p.coleccion)}</p>
          <div class="nombre-fila"><h4 class="producto-nombre">${esc(p.nombre)}</h4>${botonFav(p, 'btn-fav--inline')}</div>
          <p class="producto-material">${esc(p.material)}</p>
          <p class="precio">${sinPrecio ? 'Precio por confirmar' : precioHtml(p, varIni)}</p>
          ${pct && p.oferta_hasta ? `<p class="oferta-hasta">Oferta hasta el ${esc(fechaCorta(p.oferta_hasta))}</p>` : ''}
          ${p.preventa ? `
            <div class="preventa-info${preventaCerrada(p) ? ' is-cerrada' : ''}">
              <strong>⏳ Preventa</strong>
              ${preventaCerrada(p) ? '<span>La preventa ya cerró.</span>' : `<span class="preventa-cierre">${spanCierre(p)}</span>`}
              ${p.preventa_entrega ? `<span>Entrega estimada: <b>${esc(p.preventa_entrega)}</b></span>` : ''}
              ${p.stock && !preventaCerrada(p) ? '<span>Unidades limitadas</span>' : ''}
              ${preventaCerrada(p) ? '' : '<small>Apártala ahora: te confirmamos el pago y la entrega por WhatsApp.</small>'}
            </div>` : ''}
          ${p.preventa ? '' : `<p class="aviso-confeccion"><span aria-hidden="true">🧵</span> ${esc(textoConfeccion())}</p>`}
          <p class="nota-envio"><span aria-hidden="true">🚚</span> ${esc(textoEnvio())}</p>
          ${preventaCerrada(p) ? `
            <p class="stock-agotado">La preventa cerró. Muy pronto estará disponible.</p>
            <a class="btn-secundario btn-bloque" target="_blank" rel="noopener"
               href="https://wa.me/${numeroWa}?text=${encodeURIComponent(`Hola, quiero saber cuándo sale: ${p.nombre}`)}">Avísame cuando salga</a>`
          : sinUnidades ? `
            <p class="stock-agotado">Por ahora este producto está agotado.</p>
            <a class="btn-secundario btn-bloque" target="_blank" rel="noopener"
               href="https://wa.me/${numeroWa}?text=${encodeURIComponent(`Hola, ¿cuándo vuelve a estar disponible: ${p.nombre}?`)}">Avísame cuando vuelva</a>`
          : sinPrecio ? `
            <a class="btn-secundario btn-bloque" target="_blank" rel="noopener"
               href="https://wa.me/${numeroWa}?text=${encodeURIComponent(`Hola, quiero información y precio de: ${p.nombre}`)}">Consultar por WhatsApp</a>`
          : `
            ${p.variantes ? `<fieldset class="opciones"><legend>Material</legend>${chips('var-' + uid, p.variantes.map((v) => v.nombre), 'var', varIni)}</fieldset>` : ''}
            <fieldset class="opciones"><legend>Color: <span class="color-sel">${esc(colorIni)}</span></legend>${p.colores.length > 1 ? chips('color-' + uid, p.colores, 'color', colorIni) : `<input type="hidden" name="color-${esc(uid)}" value="${esc(colorIni)}">`}</fieldset>
            <fieldset class="opciones"><legend>Talla <button type="button" class="guia-link" data-guia>Guía de tallas</button></legend>${chips('talla-' + uid, p.tallas, 'talla', p.tallas.length === 1 ? p.tallas[0] : null)}</fieldset>
            <p class="stock-msg" aria-live="polite"></p>
            <p class="opciones-error hidden" role="alert">Elige tu talla.</p>
            <button type="button" class="agregar-carrito btn-primario btn-bloque">${enPreventa(p) ? 'Apartar<span class="add-extra"> en preventa</span>' : 'Agregar<span class="add-extra"> al carrito</span>'}</button>`}
        </div>
      </article>`;
  }

  // Resumen de tallas: "XS – 3XL", "S · M · L" o "Talla única"
  function resumenTallas(t) {
    if (!t?.length) return '';
    if (t.length === 1) return t[0] === 'Única' ? 'Talla única' : `Talla ${t[0]}`;
    return t.length > 3 ? `Tallas ${t[0]} – ${t[t.length - 1]}` : `Tallas ${t.join(' · ')}`;
  }
  function tarjetaMini(p) {
    const pct = ofertaActiva(p);
    const imgs = imagenesDe(p, p.colores[0]);
    const max = 5;
    const swatches = p.colores.slice(0, max).map((c) => `<i class="swatch" style="--sw:${colorCss(c)}" title="${esc(c)}"></i>`).join('')
      + (p.colores.length > max ? `<span class="mini-mas">+${p.colores.length - max}</span>` : '');
    const precio = p.precio == null ? 'Precio por confirmar'
      : (p.variantes?.length > 1 && new Set(p.variantes.map((v) => v.precio)).size > 1 ? '<span class="mini-desde">Desde</span> ' : '') + precioHtml(p, p.variantes?.length ? p.variantes.reduce((a, b) => (b.precio < a.precio ? b : a)).nombre : undefined);
    return `
      <article class="card producto producto-mini${agotado(p) || preventaCerrada(p) ? ' is-agotado' : ''}${pct ? ' con-oferta' : ''}${p.preventa ? ' con-preventa' : ''}" data-id="${esc(p.id)}">
        ${botonFav(p)}
        <button type="button" class="product-media mini-media ${imgs ? '' : 'sin-foto'}" data-label="${esc(p.coleccion)}" data-abrir aria-label="Ver detalles de ${esc(p.nombre)}">
          ${imgs ? `<img class="product-img" src="${esc(imgs.frente)}" alt="${esc(p.nombre)}" width="900" height="900" loading="lazy" decoding="async" />` : ''}
          ${imgs?.espalda ? `<img class="mini-img-alt" src="${esc(imgs.espalda)}" alt="" width="900" height="900" loading="lazy" decoding="async" aria-hidden="true" />` : ''}
          ${pct ? `<span class="badge-oferta">-${pct}%</span>` : ''}
          ${agotado(p) && !p.preventa ? '<span class="badge-agotado">Agotado</span>' : ''}
          ${p.preventa ? `<span class="badge-preventa">${preventaCerrada(p) ? 'Preventa cerrada' : agotado(p) ? 'Preventa · agotada' : 'Preventa'}</span>` : ''}
        </button>
        <div class="producto-info mini-info">
          <p class="producto-col">${esc(p.coleccion)}</p>
          <h4 class="producto-nombre">${esc(p.nombre)}</h4>
          <p class="precio">${precio}</p>
          <p class="mini-resumen"><span class="mini-colores" aria-label="${p.colores.length} color${p.colores.length === 1 ? '' : 'es'}">${swatches}</span><span class="mini-tallas">${esc(resumenTallas(p.tallas))}</span></p>
          ${enPreventa(p) ? `<p class="mini-preventa">⏳ ${spanCierre(p)}${p.preventa_entrega ? ` · <span class="mini-entrega">Entrega: ${esc(p.preventa_entrega)}</span>` : ''}</p>` : ''}
          <button type="button" class="btn-primario btn-bloque mini-btn" data-abrir>Ver detalles</button>
        </div>
      </article>`;
  }

  function renderCatalogo() {
    if (!catalogo) return;
    catalogo.innerHTML = `<div class="productos">${PRODUCTOS.map(tarjetaMini).join('')}</div>`;
  }
  renderCatalogo();

  // Destacados en Inicio (los elige el administrador; máximo 12)
  // Carrusel infinito: si hay más productos de los que caben, la lista se repite
  // 5 veces y, al detenerse, el scroll se recoloca en la copia central sin que se note.
  const destacadosGrid = $('#destacadosGrid');
  const carruselWrap = $('#destacadosWrap');
  const COPIAS = 5, CENTRAL = 2;
  let listaDest = [], bucle = false, anchoSet = 0, pasoCard = 0, objetivo = null;

  function medirCarrusel() {
    const items = destacadosGrid.children;
    const n = listaDest.length;
    pasoCard = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : (items[0]?.offsetWidth || 0);
    anchoSet = bucle && items.length >= n * COPIAS ? items[n].offsetLeft - items[0].offsetLeft : 0;
  }
  function cabenTodos() {
    const card = destacadosGrid.firstElementChild;
    if (!card) return true;
    const gap = parseFloat(getComputedStyle(destacadosGrid).columnGap) || 0;
    const visibles = Math.floor((destacadosGrid.clientWidth + gap + 2) / (card.offsetWidth + gap));
    return listaDest.length <= visibles;
  }
  function montarCarrusel(indice = 0) {
    const html = listaDest.map(tarjetaMini).join('');
    destacadosGrid.innerHTML = html;
    bucle = false; objetivo = null;
    destacadosGrid.classList.remove('en-bucle');
    carruselWrap?.classList.remove('con-flechas');
    if (!destacadosGrid.clientWidth || cabenTodos()) { medirCarrusel(); return; }
    const clon = html.replace(/<article /g, '<article aria-hidden="true" data-clon ');
    destacadosGrid.innerHTML = Array.from({ length: COPIAS }, (_, i) => (i === CENTRAL ? html : clon)).join('');
    destacadosGrid.querySelectorAll('[data-clon] button, [data-clon] a').forEach((el) => { el.tabIndex = -1; });
    bucle = true;
    destacadosGrid.classList.add('en-bucle');
    carruselWrap?.classList.add('con-flechas');
    medirCarrusel();
    destacadosGrid.scrollLeft = CENTRAL * anchoSet + indice * pasoCard;
  }
  function renderDestacados() {
    const sec = $('#destacados');
    if (!destacadosGrid || !sec) return;
    listaDest = PRODUCTOS.filter((p) => p.destacado).slice(0, 12);
    sec.hidden = !listaDest.length;
    montarCarrusel();
  }
  // Lleva la posición a la copia central (mismo contenido, salto invisible)
  function desfaseCentral(x) {
    const min = CENTRAL * anchoSet;
    return x - (min + ((((x - min) % anchoSet) + anchoSet) % anchoSet));
  }
  let caducaObjetivo;
  function recolocar() {
    if (!bucle || !anchoSet) return;
    // Si una flecha está llevando el carrusel a un destino, se espera a que llegue
    if (objetivo !== null && Math.abs(destacadosGrid.scrollLeft - objetivo) > 2) return;
    objetivo = null;
    const d = desfaseCentral(destacadosGrid.scrollLeft);
    if (Math.abs(d) > 1) destacadosGrid.scrollLeft -= d;
  }
  const pasoCarrusel = (dir) => {
    if (!bucle || !anchoSet) return;
    const gap = parseFloat(getComputedStyle(destacadosGrid).columnGap) || 0;
    const visibles = Math.max(1, Math.floor((destacadosGrid.clientWidth + gap + 2) / pasoCard));
    let destino = (objetivo ?? destacadosGrid.scrollLeft) + dir * visibles * pasoCard;
    const d = desfaseCentral(destino);
    if (Math.abs(d) > 1) { destacadosGrid.scrollLeft -= d; destino -= d; }
    objetivo = destino;
    clearTimeout(caducaObjetivo);
    caducaObjetivo = setTimeout(() => { objetivo = null; recolocar(); }, 1500);
    destacadosGrid.scrollTo({ left: destino, behavior: reduceMotion ? 'auto' : 'smooth' });
  };
  // Si cambia el tamaño (o la sección estaba oculta al cargar), se vuelve a armar
  function revisarCarrusel() {
    if (!destacadosGrid || !listaDest.length || !destacadosGrid.clientWidth) return;
    const indice = bucle && pasoCard ? Math.round((destacadosGrid.scrollLeft - CENTRAL * anchoSet) / pasoCard) : 0;
    const n = listaDest.length;
    montarCarrusel(((indice % n) + n) % n);
  }
  $('#destacadosPrev')?.addEventListener('click', () => pasoCarrusel(-1));
  $('#destacadosNext')?.addEventListener('click', () => pasoCarrusel(1));
  // Si la persona arrastra o usa la rueda, manda ella (se olvida el destino de la flecha)
  ['pointerdown', 'wheel', 'touchstart'].forEach((ev) => destacadosGrid?.addEventListener(ev, () => { objetivo = null; }, { passive: true }));
  let finScroll;
  if ('onscrollend' in window) destacadosGrid?.addEventListener('scrollend', recolocar);
  else destacadosGrid?.addEventListener('scroll', () => { clearTimeout(finScroll); finScroll = setTimeout(recolocar, 160); }, { passive: true });
  let anchoPrevio = destacadosGrid?.clientWidth || 0, finResize;
  window.addEventListener('resize', () => {
    clearTimeout(finResize);
    finResize = setTimeout(() => {
      if (destacadosGrid.clientWidth !== anchoPrevio) { anchoPrevio = destacadosGrid.clientWidth; revisarCarrusel(); }
    }, 150);
  });
  window.addEventListener('hashchange', () => setTimeout(() => {
    if (destacadosGrid && destacadosGrid.clientWidth && destacadosGrid.clientWidth !== anchoPrevio) { anchoPrevio = destacadosGrid.clientWidth; revisarCarrusel(); }
  }, 50));
  renderDestacados();
  const productoModal = $('#productoModal');
  const productoBody = $('#productoModalBody');
  let focoAntesProducto = null;
  function abrirProducto(id) {
    const p = productosPorId.get(id);
    if (!p || !productoModal) return;
    focoAntesProducto = document.activeElement;
    productoBody.innerHTML = tarjetaProducto(p, 'm');
    productoBody.firstElementChild.classList.add('producto--detalle');
    actualizarDisponibilidad(productoBody.firstElementChild, p);
    productoModal.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    productoBody.scrollTop = 0;
    $('#cerrarProducto')?.focus();
  }
  function cerrarProducto() {
    if (!productoModal || productoModal.classList.contains('hidden')) return;
    productoModal.classList.add('hidden');
    productoBody.innerHTML = '';
    document.body.classList.remove('no-scroll');
    focoAntesProducto?.focus?.();
  }
  [catalogo, destacadosGrid].filter(Boolean).forEach((cont) => cont.addEventListener('click', (e) => {
    const card = e.target.closest('.producto-mini');
    if (card && (e.target.closest('[data-abrir]') || !e.target.closest('button, a'))) abrirProducto(card.dataset.id);
  }));
  $('#cerrarProducto')?.addEventListener('click', cerrarProducto);
  productoModal?.addEventListener('click', (e) => { if (e.target === productoModal) cerrarProducto(); });
  const contenedoresTarjetas = [productoBody].filter(Boolean);

  // ---------- Favoritos: corazón, contador y sección #favoritos ----------
  function renderFavoritos() {
    const n = [...favoritos].filter((id) => productosPorId.has(id)).length;
    const cont = $('#contadorFav');
    if (cont) { cont.textContent = n; cont.classList.toggle('hidden', !n); }
    const grid = $('#favoritosGrid'); if (!grid) return;
    const lista = PRODUCTOS.filter((p) => favoritos.has(p.id));
    $('#favoritosVacio')?.classList.toggle('hidden', lista.length > 0);
    grid.innerHTML = lista.map(tarjetaMini).join('');
  }
  function alternarFavorito(id) {
    const p = productosPorId.get(id); if (!p) return;
    if (favoritos.has(id)) favoritos.delete(id); else favoritos.add(id);
    storage.set(CLAVE_FAV, [...favoritos]);
    const activo = favoritos.has(id);
    $$(`.btn-fav[data-fav="${CSS.escape(id)}"]`).forEach((b) => {
      b.setAttribute('aria-pressed', activo);
      b.setAttribute('aria-label', `${activo ? 'Quitar de favoritos' : 'Agregar a favoritos'}: ${p.nombre}`);
      if (activo && !reduceMotion) { b.classList.remove('latido'); void b.offsetWidth; b.classList.add('latido'); }
    });
    toast(activo ? `♥ Guardado en favoritos: ${p.nombre}` : `Quitado de favoritos: ${p.nombre}`);
    renderFavoritos();
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('.btn-fav[data-fav]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    alternarFavorito(b.dataset.fav);
  }, true);
  $('#favoritosGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.producto-mini');
    if (card && (e.target.closest('[data-abrir]') || !e.target.closest('button, a'))) abrirProducto(card.dataset.id);
  });
  renderFavoritos();

  // ---------- Preventa: sección, aviso en Inicio y cuenta regresiva ----------
  function renderPreventa() {
    const lista = PRODUCTOS.filter(enPreventa);
    $$('.nav-preventa').forEach((a) => { a.hidden = !lista.length; });
    const banner = $('#preventaBanner');
    if (banner) {
      banner.hidden = !lista.length;
      if (lista.length) {
        const conCierre = lista.filter((p) => p.preventa_hasta).sort((a, b) => new Date(a.preventa_hasta) - new Date(b.preventa_hasta));
        $('#preventaBannerTxt').innerHTML = `${lista.length === 1 ? esc(lista[0].nombre) : `${lista.length} prendas antes que nadie`}`
          + (conCierre.length ? ` · ${spanCierre(conCierre[0])}` : '');
      }
    }
    const grid = $('#preventaGrid'); if (!grid) return;
    $('#preventaVacio')?.classList.toggle('hidden', lista.length > 0);
    grid.innerHTML = lista.map(tarjetaMini).join('');
  }
  $('#preventaGrid')?.addEventListener('click', (e) => {
    const card = e.target.closest('.producto-mini');
    if (card && (e.target.closest('[data-abrir]') || !e.target.closest('button, a'))) abrirProducto(card.dataset.id);
  });
  renderPreventa();
  // Actualiza los "Cierra en…" cada minuto; si alguna preventa cierra, se vuelve a pintar todo
  setInterval(() => {
    let cerro = false;
    $$('[data-cierre]').forEach((el) => {
      const f = faltaPara(el.dataset.cierre);
      if (!f) cerro = true;
      el.textContent = f ? `Cierra en ${f}` : 'Preventa cerrada';
    });
    if (cerro) { renderPreventa(); renderCatalogo(); aplicarFiltros(); renderDestacados(); renderFavoritos(); }
  }, 60000);

  // ---------- Mis pedidos: seguimiento sin cuentas ----------
  // Los pedidos hechos en este dispositivo se guardan aquí (número + celular).
  // El estado se consulta en Supabase con ese par; sin él, no se ve nada.
  const CLAVE_MIS_PEDIDOS = 'insanity-mis-pedidos';
  const misPedidos = () => (storage.get(CLAVE_MIS_PEDIDOS) || []).filter((x) => x && x.id && x.celular);
  function recordarPedido(id, celular) {
    const lista = misPedidos().filter((x) => String(x.id) !== String(id));
    lista.unshift({ id: Number(id), celular: soloCelular(celular) });
    storage.set(CLAVE_MIS_PEDIDOS, lista.slice(0, 20));
  }
  const ESTADO_CLIENTE = {
    pendiente: { txt: 'Recibido', det: 'Te escribiremos por WhatsApp para confirmar el pago.', paso: 0 },
    confirmado: { txt: 'Pago confirmado', get det() { return `Estamos confeccionando tu pedido. ${textoConfeccion()}`; }, paso: 1 },
    enviado: { txt: 'Enviado', det: 'Tu pedido va en camino.', paso: 2 },
    entregado: { txt: 'Entregado', det: '¡Gracias por ser parte de la Sociedad!', paso: 3 },
    cancelado: { txt: 'Cancelado', det: 'Este pedido fue cancelado. Si es un error, escríbenos.', paso: -1 }
  };
  const PASOS = ['Recibido', 'Pago confirmado', 'Enviado', 'Entregado'];
  const fechaPedido = (t) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'America/Bogota' });

  async function consultarPedidos(pares) {
    const r = await fetch(`${cfgSb.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/consultar_pedidos`, {
      method: 'POST', headers: { apikey: cfgSb.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_consultas: pares.map((x) => ({ id: x.id, celular: x.celular })) })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }
  function tarjetaPedido(p) {
    const est = ESTADO_CLIENTE[p.estado] || ESTADO_CLIENTE.pendiente;
    const pasos = est.paso < 0 ? '' : `<ol class="pedido-pasos" aria-label="Progreso del pedido">${PASOS.map((t, i) =>
      `<li class="${i < est.paso ? 'hecho' : i === est.paso ? 'actual' : ''}"${i === est.paso ? ' aria-current="step"' : ''}><span></span>${t}</li>`).join('')}</ol>`;
    const msg = `Hola, quiero saber de mi pedido #${p.id}`;
    return `
      <article class="pedido-card estado-${esc(p.estado)}" data-pedido="${p.id}">
        <header class="pedido-head">
          <div><h3>Pedido #${p.id}</h3><p class="pedido-fecha">${esc(fechaPedido(p.fecha))}${p.ciudad ? ' · ' + esc(p.ciudad) : ''}</p></div>
          <span class="pedido-estado">${esc(est.txt)}</span>
        </header>
        ${pasos}
        <p class="pedido-det">${esc(est.det)}</p>
        ${p.guia ? `<p class="pedido-guia">Guía de envío: <strong>${esc(p.guia)}</strong></p>` : ''}
        <ul class="pedido-items">${(p.items || []).map((i) => `<li><span>${i.cantidad}× ${esc(i.nombre)} <small>${i.preventa ? `<b class="tag-preventa">Preventa${i.entrega ? ' · entrega ' + esc(i.entrega) : ''}</b> ` : ''}${esc([i.variante, i.color, i.talla].filter(Boolean).join(' · '))}</small></span><span>${dinero(i.precio * i.cantidad)}</span></li>`).join('')}</ul>
        <p class="pedido-total">${p.descuento ? `<small>Descuento ${p.cupon ? esc(p.cupon) : ''}: −${dinero(p.descuento)}</small>` : ''}<span>Total</span> <strong>${dinero(p.total)}</strong></p>
        <div class="pedido-acciones">
          <a class="btn-secundario" target="_blank" rel="noopener" href="https://wa.me/${numeroWa}?text=${encodeURIComponent(msg)}">Preguntar por WhatsApp</a>
          <button type="button" class="link-btn" data-olvidar="${p.id}">Quitar de esta lista</button>
        </div>
      </article>`;
  }
  let cargandoMisPedidos = false;
  async function renderMisPedidos() {
    const cont = $('#misPedidosLista'); if (!cont) return;
    const pares = misPedidos();
    if (!conSupabase) { cont.innerHTML = '<p class="mis-pedidos-vacio">El seguimiento de pedidos no está disponible en este momento. Escríbenos por WhatsApp.</p>'; return; }
    if (!pares.length) { cont.innerHTML = '<p class="mis-pedidos-vacio">Aún no hay pedidos guardados en este dispositivo. Cuando hagas uno, aparecerá aquí con su estado.</p>'; return; }
    if (cargandoMisPedidos) return;
    cargandoMisPedidos = true;
    cont.innerHTML = '<p class="mis-pedidos-vacio">Consultando tus pedidos…</p>';
    try {
      const data = await consultarPedidos(pares);
      cont.innerHTML = data.length ? data.map(tarjetaPedido).join('')
        : '<p class="mis-pedidos-vacio">No encontramos los pedidos guardados. Si crees que es un error, escríbenos por WhatsApp.</p>';
    } catch {
      cont.innerHTML = '<p class="mis-pedidos-vacio">No pudimos consultar tus pedidos ahora. Revisa tu conexión e intenta de nuevo.</p>';
    } finally { cargandoMisPedidos = false; }
  }
  $('#misPedidosLista')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-olvidar]'); if (!b) return;
    storage.set(CLAVE_MIS_PEDIDOS, misPedidos().filter((x) => String(x.id) !== b.dataset.olvidar));
    b.closest('.pedido-card')?.remove();
    if (!misPedidos().length) renderMisPedidos();
  });
  $('#buscarPedidoForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = $('#bpNumero').value.replace(/\D/g, '');
    const cel = soloCelular($('#bpCelular').value);
    const msg = $('#bpMsg');
    const decir = (t, cls) => { msg.textContent = t; msg.className = `cupon-msg ${cls}`; };
    if (!id || cel.length < 10) { decir('Escribe el número de pedido y el celular (10 dígitos) con el que lo hiciste.', 'cupon-msg--error'); return; }
    if (!conSupabase) { decir('El seguimiento no está disponible ahora. Escríbenos por WhatsApp.', 'cupon-msg--error'); return; }
    const btn = e.submitter || $('#buscarPedidoForm button'); btn.disabled = true;
    try {
      const data = await consultarPedidos([{ id, celular: cel }]);
      if (!data.length) { decir('No encontramos un pedido con esos datos. Revisa el número y el celular.', 'cupon-msg--error'); return; }
      recordarPedido(id, cel);
      decir(`Pedido #${id} encontrado.`, 'cupon-msg--ok');
      $('#buscarPedidoForm').reset();
      renderMisPedidos();
    } catch { decir('No pudimos consultar ahora. Intenta de nuevo.', 'cupon-msg--error'); }
    finally { btn.disabled = false; }
  });
  window.addEventListener('hashchange', () => {
    const { id } = leerHash();
    if (id === 'mispedidos') renderMisPedidos();
    if (id === 'favoritos') renderFavoritos();
    if (id === 'preventa') renderPreventa();
  });
  if (leerHash().id === 'mispedidos') renderMisPedidos();

  // Imagen que no carga → recuadro con el nombre de la colección
  [catalogo, destacadosGrid, productoBody].filter(Boolean).forEach((cont) => cont.addEventListener('error', (e) => {
    if (e.target.matches?.('.mini-img-alt')) { e.target.remove(); return; }
    if (e.target.matches?.('.product-img')) {
      const media = e.target.closest('.product-media');
      e.target.remove();
      media.classList.add('sin-foto');
      media.querySelector('.view-toggle')?.remove();
    }
  }, true));

  // Interacciones de tarjeta (delegadas)
  contenedoresTarjetas.forEach((cont) => cont.addEventListener('click', (e) => {
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
  }));
  contenedoresTarjetas.forEach((cont) => cont.addEventListener('change', (e) => {
    const card = e.target.closest('.producto');
    if (!card) return;
    const p = productosPorId.get(card.dataset.id);
    if (e.target.name.startsWith('color-')) { actualizarImagen(card, p); const cs = $('.color-sel', card); if (cs) cs.textContent = e.target.value; actualizarDisponibilidad(card, p); }
    if (e.target.name.startsWith('var-')) $('.precio', card).innerHTML = precioHtml(p, e.target.value);
    if (e.target.name.startsWith('talla-')) { $('.opciones-error', card)?.classList.add('hidden'); mensajeStock(card, p); }
  }));

  function actualizarDisponibilidad(card, p) {
    if (!conInventario(p) || agotado(p)) return;
    const uid = card.dataset.uid;
    const color = valorSel(card, 'color-' + uid) || p.colores[0];
    card.querySelectorAll(`input[type=radio][name="${CSS.escape('color-' + uid)}"]`).forEach((i) => {
      const ok = colorDisponible(p, i.value);
      i.disabled = !ok;
      i.closest('label').classList.toggle('is-agotada', !ok);
      i.closest('label').title = ok ? i.value : `${i.value}: agotado`;
    });
    card.querySelectorAll(`input[name="${CSS.escape('talla-' + uid)}"]`).forEach((i) => {
      const n = stockDe(p, color, i.value);
      i.disabled = n <= 0;
      i.closest('label').classList.toggle('is-agotada', n <= 0);
      i.closest('label').title = n <= 0 ? `${i.value}: agotada en ${color}` : i.value;
      if (i.checked && n <= 0) i.checked = false;
    });
    mensajeStock(card, p);
  }
  function mensajeStock(card, p) {
    const el = $('.stock-msg', card);
    if (!el) return;
    if (!conInventario(p)) { el.textContent = ''; return; }
    const uid = card.dataset.uid;
    const color = valorSel(card, 'color-' + uid) || p.colores[0];
    const talla = valorSel(card, 'talla-' + uid);
    const n = talla ? stockDe(p, color, talla) : null;
    el.className = 'stock-msg';
    if (n == null) {
      const agotadas = p.tallas.filter((t) => stockDe(p, color, t) <= 0).length;
      el.textContent = agotadas ? `Tallas tachadas: agotadas en ${color}.` : '';
    } else if (n <= 3) {
      el.textContent = `¡Últimas ${n} unidad${n === 1 ? '' : 'es'} en ${color} · ${talla}!`;
      el.classList.add('stock-msg--pocas');
    } else {
      el.textContent = 'Disponible';
      el.classList.add('stock-msg--ok');
    }
  }

  const valorSel = (card, name) => (card.querySelector(`input[name="${CSS.escape(name)}"]:checked`) || card.querySelector(`input[type=hidden][name="${CSS.escape(name)}"]`))?.value || null;

  function actualizarImagen(card, p) {
    const img = $('.product-img', card);
    if (!img) return;
    const color = valorSel(card, 'color-' + card.dataset.uid) || p.colores[0];
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
    if (!p || p.precio == null || preventaCerrada(p)) return false;
    it.preventa = enPreventa(p) || undefined;
    it.entrega = enPreventa(p) ? p.preventa_entrega || undefined : undefined;
    it.precio = precioDe(p, it.variante);
    it.oferta = ofertaActiva(p) || 0;
    it.nombre = p.nombre;
    it.cantidad = Math.max(1, Math.min(20, parseInt(it.cantidad, 10) || 1));
    const disp = stockDe(p, it.color, it.talla);
    if (disp <= 0) return false;
    it.cantidad = Math.min(it.cantidad, disp);
    return true;
  });

  function agregarDesdeTarjeta(card, p) {
    const uid = card.dataset.uid;
    const talla = valorSel(card, 'talla-' + uid);
    if (!talla) {
      $('.opciones-error', card)?.classList.remove('hidden');
      card.querySelector(`input[name="${CSS.escape('talla-' + uid)}"]`)?.focus();
      return;
    }
    const color = valorSel(card, 'color-' + uid) || p.colores[0];
    const variante = p.variantes ? valorSel(card, 'var-' + uid) : null;
    const key = [p.id, color, talla, variante || ''].join('|');
    const existente = carrito.find((i) => i.key === key);
    const disp = stockDe(p, color, talla);
    const yaEnCarrito = carrito.filter((i) => i.id === p.id && i.color === color && i.talla === talla).reduce((s, i) => s + i.cantidad, 0);
    if (yaEnCarrito + 1 > disp) {
      toast(disp <= 0 ? `La talla ${talla} en ${color} está agotada.` : `Solo hay ${disp} unidad${disp === 1 ? '' : 'es'} en ${color} · ${talla} y ya están en tu carrito.`);
      return;
    }
    if (existente) existente.cantidad = Math.min(20, existente.cantidad + 1);
    else carrito.push({ key, id: p.id, nombre: p.nombre, coleccion: p.coleccion, color, talla, variante, precio: precioDe(p, variante), oferta: ofertaActiva(p) || 0, cantidad: 1,
      preventa: enPreventa(p) || undefined, entrega: enPreventa(p) ? p.preventa_entrega || undefined : undefined });
    guardarYRender();
    toast(`${enPreventa(p) ? 'Apartado en preventa' : 'Agregado'}: ${p.nombre} · ${color} · ${talla}`);
    if (card.closest('#productoModal')) cerrarProducto();
    btnCarrito?.classList.remove('pulse'); void btnCarrito?.offsetWidth; btnCarrito?.classList.add('pulse');
  }

  // ---------- Códigos de descuento ----------
  const CLAVE_CUPON = 'insanity-cupon';
  let cupon = storage.get(CLAVE_CUPON); // { codigo, tipo, valor, minimo_compra }
  const subtotalCarrito = () => carrito.reduce((s, i) => s + i.precio * i.cantidad, 0);
  function descuentoCupon(sub = subtotalCarrito()) {
    if (!cupon || sub <= 0 || sub < (cupon.minimo_compra || 0)) return 0;
    const d = cupon.tipo === 'porcentaje' ? redondear(sub * cupon.valor / 100) : cupon.valor;
    return Math.min(d, sub);
  }
  const totalCarrito = () => subtotalCarrito() - descuentoCupon();
  const textoCupon = (c) => (c.tipo === 'porcentaje' ? `${c.valor}%` : dinero(c.valor));
  async function validarCupon(codigo) {
    if (!conSupabase) throw new Error('no-disponible');
    const r = await fetch(`${cfgSb.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/validar_cupon`, {
      method: 'POST', headers: { apikey: cfgSb.supabaseKey, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_codigo: codigo })
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const data = await r.json();
    return Array.isArray(data) ? data[0] || null : data;
  }
  const detalleItem = (i) => [i.preventa ? `PREVENTA${i.entrega ? ` (entrega: ${i.entrega})` : ''}` : '', i.variante, `Color: ${i.color}`, `Talla: ${i.talla}`, i.oferta ? `Oferta -${i.oferta}%` : ''].filter(Boolean).join(' · ');

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
    renderCupon();
    pintarAvisosConfeccion();
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
    if (btn.dataset.accion === 'mas') {
      const p = productosPorId.get(item.id);
      const disp = p ? stockDe(p, item.color, item.talla) : Infinity;
      const total = carrito.filter((i) => i.id === item.id && i.color === item.color && i.talla === item.talla).reduce((s, i) => s + i.cantidad, 0);
      if (total + 1 > disp) { toast(`Solo hay ${disp} unidad${disp === 1 ? '' : 'es'} disponibles de esa talla y color.`); return; }
      item.cantidad = Math.min(20, item.cantidad + 1);
    }
    if (btn.dataset.accion === 'menos') item.cantidad -= 1;
    if (btn.dataset.accion === 'quitar' || item.cantidad < 1) carrito = carrito.filter((i) => i.key !== key);
    guardarYRender();
  });

  function renderCupon() {
    const sub = subtotalCarrito();
    const desc = descuentoCupon(sub);
    const sub$ = $('#subtotal'); if (sub$) sub$.textContent = dinero(sub);
    $('#filaSubtotal')?.classList.toggle('hidden', !cupon);
    $('#filaDescuento')?.classList.toggle('hidden', !desc);
    const dv = $('#descuentoValor'); if (dv) dv.textContent = '−' + dinero(desc);
    const dt = $('#descuentoTxt'); if (dt && cupon) dt.textContent = `Código ${cupon.codigo} (${textoCupon(cupon)})`;
    $('#cuponForm')?.classList.toggle('hidden', !!cupon);
    const ap = $('#cuponAplicado');
    if (ap) {
      ap.classList.toggle('hidden', !cupon);
      if (cupon) $('#cuponCodigo').textContent = cupon.codigo;
    }
    const msg = $('#cuponMsg');
    if (msg && cupon && sub > 0 && sub < (cupon.minimo_compra || 0)) {
      msg.textContent = `El código ${cupon.codigo} aplica en compras desde ${dinero(cupon.minimo_compra)}.`;
      msg.className = 'cupon-msg cupon-msg--aviso';
    } else if (msg && (msg.classList.contains('cupon-msg--aviso') || (!cupon && msg.classList.contains('cupon-msg--ok')))) {
      // Ya cumple el mínimo, o el cupón se quitó/usó: se borra el "¡Listo!".
      // Los mensajes de error ("ese código no existe") se dejan para que la persona los lea.
      msg.className = 'cupon-msg hidden';
      msg.textContent = '';
    }
  }
  $('#cuponForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = $('#cuponInput'); const msg = $('#cuponMsg'); const btn = e.submitter || $('#cuponForm button');
    const codigo = input.value.trim().toUpperCase();
    if (!codigo) { input.focus(); return; }
    btn.disabled = true; btn.textContent = '…';
    try {
      const c = await validarCupon(codigo);
      if (!c) throw new Error('invalido');
      cupon = { codigo: c.codigo, tipo: c.tipo, valor: c.valor, minimo_compra: c.minimo_compra || 0 };
      storage.set(CLAVE_CUPON, cupon);
      input.value = '';
      msg.className = 'cupon-msg cupon-msg--ok'; msg.textContent = `¡Listo! ${textoCupon(cupon)} de descuento aplicado.`;
    } catch (err) {
      msg.className = 'cupon-msg cupon-msg--error';
      msg.textContent = err.message === 'no-disponible' ? 'Los códigos de descuento no están disponibles en este momento.'
        : err.message === 'invalido' ? 'Ese código no existe o ya venció.' : 'No pudimos validar el código. Intenta de nuevo.';
    }
    btn.disabled = false; btn.textContent = 'Aplicar';
    guardarYRender();
  });
  $('#quitarCupon')?.addEventListener('click', () => {
    cupon = null; storage.set(CLAVE_CUPON, null);
    const msg = $('#cuponMsg'); if (msg) msg.className = 'cupon-msg hidden';
    guardarYRender();
  });
  // Revalidar el cupón guardado (puede haber vencido o sido desactivado)
  if (cupon && conSupabase) {
    validarCupon(cupon.codigo).then((c) => {
      if (!c) { cupon = null; storage.set(CLAVE_CUPON, null); guardarYRender(); }
      else { cupon = { codigo: c.codigo, tipo: c.tipo, valor: c.valor, minimo_compra: c.minimo_compra || 0 }; storage.set(CLAVE_CUPON, cupon); guardarYRender(); }
    }).catch(() => {});
  } else if (cupon && !conSupabase) { cupon = null; storage.set(CLAVE_CUPON, null); }

  // ---------- Lista VIP: suscripción con código personal de bienvenida ----------
  // La configuración viene del panel (contenido -> 'vip'). Cada suscriptor recibe un
  // código único que solo funciona con su celular; se aplica solo en el carrito.
  const vipCfg = CONTENIDO?.vip || null;
  const CLAVE_VIP = 'insanity-vip';
  const vipActiva = conSupabase && !!vipCfg?.activo;
  const vipPct = Number(vipCfg?.porcentaje) || 0;
  const vipConRegalo = vipActiva && !!vipCfg?.regalo_activo && vipPct >= 1 && vipPct <= 90;
  const vipModal = $('#vipModal');

  function textoRegaloVip() {
    if (!vipConRegalo) return '';
    const min = Number(vipCfg.minimo_compra) || 0;
    return `Recibe ${vipPct}% de descuento en tu primera compra${min ? ` desde ${dinero(min)}` : ''}.`;
  }
  function pintarInvitacionVip() {
    $$('.vip-titulo').forEach((el) => { el.textContent = vipCfg?.titulo?.trim() || 'Únete a la Sociedad'; });
    $$('.vip-texto').forEach((el) => { el.textContent = vipCfg?.texto?.trim() || 'Entérate primero de lanzamientos, preventas y ofertas exclusivas.'; });
    $$('.vip-regalo').forEach((el) => { el.textContent = textoRegaloVip(); el.hidden = !vipConRegalo; });
    $$('.vip-barra-sub').forEach((el) => { el.textContent = textoRegaloVip() || vipCfg?.texto?.trim() || 'Entérate primero de lanzamientos, preventas y ofertas exclusivas.'; });
    const pie = $('#vipPie'); if (pie) pie.hidden = !vipActiva || storage.get(CLAVE_VIP)?.estado === 'suscrito';
  }
  pintarInvitacionVip();

  let vipAbierta = false;
  function abrirVip(origen = 'popup') {
    if (!vipModal) return;
    vipAbierta = true;
    const f = $('.vip-form', vipModal); if (f) f.dataset.origen = origen;
    vipModal.classList.remove('hidden');
    document.body.classList.add('no-scroll');
    $('.vip-form input[name="celular"]', vipModal)?.focus();
  }
  function cerrarVip(recordar = true) {
    if (!vipModal || vipModal.classList.contains('hidden')) return;
    vipModal.classList.add('hidden');
    if (![checkoutModal, $('#productoModal')].some((m) => m && !m.classList.contains('hidden')) && !carritoPanel.classList.contains('active')) document.body.classList.remove('no-scroll');
    if (recordar && storage.get(CLAVE_VIP)?.estado !== 'suscrito') storage.set(CLAVE_VIP, { estado: 'cerrado', t: Date.now() });
  }
  $('#cerrarVip')?.addEventListener('click', () => cerrarVip());
  // La barra del pie abre la misma ventana (queda registrada como "pie de página")
  $('#vipPieAbrir')?.addEventListener('click', () => abrirVip('pie'));
  vipModal?.addEventListener('click', (e) => { if (e.target === vipModal) cerrarVip(); });

  // La invitación aparece una sola vez: a los 15 s o al bajar más de la mitad de la página.
  // Si la cierran, no vuelve a salir en 30 días.
  if (vipActiva && vipModal) {
    const guardado = storage.get(CLAVE_VIP);
    const yaVista = guardado?.estado === 'suscrito' || (guardado?.estado === 'cerrado' && Date.now() - (guardado.t || 0) < 30 * 864e5);
    if (!yaVista) {
      let mostrada = false;
      const hayOtraVentana = () => [checkoutModal, $('#productoModal'), $('#guiaModal')].some((m) => m && !m.classList.contains('hidden')) || carritoPanel.classList.contains('active');
      const intentar = () => {
        if (mostrada || vipAbierta) return;
        if (hayOtraVentana()) { setTimeout(intentar, 8000); return; }
        mostrada = true; window.removeEventListener('scroll', alBajar); abrirVip();
      };
      const alBajar = () => { if (window.scrollY + innerHeight > document.documentElement.scrollHeight * 0.6) intentar(); };
      setTimeout(intentar, 15000);
      window.addEventListener('scroll', alBajar, { passive: true });
    }
  }

  async function suscribirVip(datos) {
    const r = await fetch(`${cfgSb.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/suscribir_vip`, {
      method: 'POST', headers: { apikey: cfgSb.supabaseKey, 'Content-Type': 'application/json' },
      body: JSON.stringify(datos)
    });
    const txt = await r.text();
    if (!r.ok) { const m = txt.match(/VIP_INACTIVO|CELULAR_INVALIDO|CORREO_INVALIDO|INTENTA_LUEGO/); throw new Error(m ? m[0] : 'ERROR'); }
    return JSON.parse(txt);
  }
  const fechaVence = (t) => new Date(t).toLocaleDateString('es-CO', { day: 'numeric', month: 'long', timeZone: 'America/Bogota' });

  $$('.vip-form').forEach((form) => form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const caja = form.closest('.vip-caja');
    const msg = $('.vip-msg', form);
    const decir = (t) => { msg.textContent = t; msg.className = 'vip-msg cupon-msg cupon-msg--error'; };
    const cel = form.celular.value.replace(/\D/g, '').replace(/^57(?=\d{10}$)/, '');
    const correo = form.correo.value.trim();
    if (!/^3\d{9}$/.test(cel)) { decir('Escribe tu WhatsApp: celular colombiano de 10 dígitos.'); form.celular.focus(); return; }
    if (correo && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) { decir('Revisa tu correo (o déjalo vacío).'); form.correo.focus(); return; }
    if (!form.autorizo.checked) { decir('Debes autorizar el uso de tus datos para unirte.'); return; }
    const btn = $('button[type=submit]', form); btn.disabled = true;
    try {
      const r = await suscribirVip({ p_nombre: form.nombre.value.trim(), p_celular: cel, p_correo: correo || null, p_origen: form.dataset.origen || 'web' });
      storage.set(CLAVE_VIP, { estado: 'suscrito', t: Date.now(), celular: cel, codigo: r.codigo || null });
      // Dejar el celular listo para el formulario de compra
      const cli = storage.get('insanity-cliente') || {};
      if (!cli.celular) storage.set('insanity-cliente', { ...cli, celular: cel, nombre: cli.nombre || form.nombre.value.trim() });
      let html;
      if (r.codigo && r.disponible) {
        let aplicado = false;
        try {
          const c = await validarCupon(r.codigo);
          if (c) { cupon = { codigo: c.codigo, tipo: c.tipo, valor: c.valor, minimo_compra: c.minimo_compra || 0 }; storage.set(CLAVE_CUPON, cupon); guardarYRender(); aplicado = true; }
        } catch { /* se muestra igual */ }
        html = `<p class="vip-ok-titulo">${r.nuevo ? '¡Bienvenido a la Sociedad!' : '¡Ya estabas en la Sociedad!'}</p>
          <p>Tu código personal de ${r.porcentaje}%:</p>
          <div class="vip-codigo"><strong>${esc(r.codigo)}</strong><button type="button" class="btn-secundario" data-copiar="${esc(r.codigo)}">Copiar</button></div>
          <p class="vip-condiciones">${[aplicado ? 'Ya quedó aplicado en tu carrito.' : 'Escríbelo en el carrito al comprar.',
            r.minimo_compra ? `Para compras desde ${dinero(r.minimo_compra)}.` : '',
            r.vence ? `Válido hasta el ${esc(fechaVence(r.vence))}.` : '',
            'Es de un solo uso y solo funciona con este celular.'].filter(Boolean).join(' ')}</p>`;
      } else if (r.codigo && r.usado) {
        html = `<p class="vip-ok-titulo">¡Ya eres parte de la Sociedad!</p><p>Ya usaste tu regalo de bienvenida. Igual serás de los primeros en enterarte de lanzamientos y preventas.</p>`;
      } else if (r.codigo) {
        html = `<p class="vip-ok-titulo">¡Ya eres parte de la Sociedad!</p><p>Tu código ${esc(r.codigo)} no está disponible en este momento. Te avisaremos por WhatsApp de lo nuevo.</p>`;
      } else {
        html = `<p class="vip-ok-titulo">${r.nuevo ? '¡Listo, ya eres parte de la Sociedad!' : '¡Ya estabas en la lista!'}</p><p>Te avisaremos por WhatsApp de lanzamientos, preventas y ofertas exclusivas.</p>`;
      }
      $('.vip-resultado', caja).innerHTML = html;
      $('.vip-resultado', caja).hidden = false;
      form.hidden = true;
      $$('.vip-pre', caja).forEach((el) => { el.hidden = true; });
      // Ya está suscrito: la invitación del pie sobra
      const pie = $('#vipPie'); if (pie) pie.hidden = true;
    } catch (err) {
      decir({ CELULAR_INVALIDO: 'Ese celular no es válido.', CORREO_INVALIDO: 'Ese correo no es válido.', VIP_INACTIVO: 'Las inscripciones están cerradas por ahora.', INTENTA_LUEGO: 'Hay muchas inscripciones en este momento. Intenta en un minuto.' }[err.message]
        || 'No pudimos inscribirte. Revisa tu conexión e intenta de nuevo.');
    } finally { btn.disabled = false; }
  }));
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copiar]'); if (!b) return;
    try { await navigator.clipboard.writeText(b.dataset.copiar); b.textContent = '¡Copiado!'; } catch { b.textContent = b.dataset.copiar; }
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
  const filtros = { oferta: new Set(), categoria: new Set(), coleccion: new Set(), talla: new Set(), color: new Set() };
  const panel = $('#filtersPanel');
  const filtersOverlay = $('#filtersOverlay');
  const btnFiltros = $('#openFilters');

  const valoresDe = {
    oferta: (p) => [...(ofertaActiva(p) ? ['En oferta'] : []), ...(enPreventa(p) ? ['Preventa'] : [])],
    categoria: (p) => [p.categoria],
    coleccion: (p) => [p.coleccion],
    talla: (p) => p.tallas,
    color: (p) => p.colores
  };
  const etiqueta = (grupo, v) => (grupo === 'categoria' ? CATEGORIAS[v] || v : v);
  const ORDEN_TALLAS = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', '3XL', '4XL', 'Única'];

  function opcionesUnicas(grupo) {
    const set = new Set();
    PRODUCTOS.forEach((p) => valoresDe[grupo](p).forEach((v) => set.add(v)));
    const arr = Array.from(set);
    if (grupo === 'talla') return arr.sort((a, b) => ORDEN_TALLAS.indexOf(a) - ORDEN_TALLAS.indexOf(b));
    if (grupo === 'coleccion') return arr; // orden del catálogo
    return arr.sort((a, b) => etiqueta(grupo, a).localeCompare(etiqueta(grupo, b), 'es'));
  }

  function renderOpcionesFiltro() {
    const conts = { oferta: '#filtroOferta', categoria: '#filtroCategoria', coleccion: '#filtroColeccion', talla: '#filtroTalla', color: '#filtroColor' };
    Object.entries(conts).forEach(([g, sel]) => {
      const cont = $(sel);
      if (!cont) return;
      const opciones = opcionesUnicas(g);
      cont.closest('fieldset')?.toggleAttribute('hidden', !opciones.length);
      cont.innerHTML = opciones.map((v) => `
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
  f.cedula.addEventListener('input', () => { f.cedula.value = f.cedula.value.replace(/\D/g, '').slice(0, 12); });
  // Celular: solo números; si el navegador autocompleta "+57 300…", se quita el 57
  f.celular.addEventListener('input', () => { f.celular.value = soloCelular(f.celular.value); });

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
  function pintarAvisosConfeccion() {
    const hay = carrito.some((i) => !i.preventa);
    $$('.aviso-confeccion--dinamico').forEach((el) => { el.hidden = !hay; el.innerHTML = `<span aria-hidden="true">🧵</span> ${esc(textoConfeccion())}`; });
    $$('.nota-envio--dinamica').forEach((el) => { el.innerHTML = `<span aria-hidden="true">🚚</span> ${esc(textoEnvio())}`; });
  }
  function pintarTotalCheckout() {
    pintarAvisosConfeccion();
    const desc = descuentoCupon();
    $('#checkoutTotal').innerHTML = (desc ? `<span class="checkout-desc">Subtotal ${dinero(subtotalCarrito())} · Código ${esc(cupon.codigo)}: −${dinero(desc)}</span>` : '')
      + 'Total productos: ' + dinero(totalCarrito()) + ' <small>(sin envío)</small>';
  }
  function setCheckout(open) {
    checkoutModal.classList.toggle('hidden', !open);
    document.body.classList.toggle('no-scroll', open || carritoPanel.classList.contains('active'));
    if (open) {
      $('#checkoutAviso')?.classList.add('hidden');
      $('#checkoutResumen').innerHTML = resumenHtml();
      pintarTotalCheckout();
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

  // Guarda el pedido en la base (para el panel y las estadísticas). Si falla, el pedido
  // igual se envía por WhatsApp: nunca se bloquea una venta por esto.
  async function registrarPedido(cliente) {
    if (!conSupabase) return null;
    const cuerpo = JSON.stringify({
      p_items: carrito.map((i) => ({ id: i.id, color: i.color, talla: i.talla, variante: i.variante || null, cantidad: i.cantidad })),
      p_cliente: cliente,
      p_cupon: descuentoCupon() ? cupon.codigo : null
    });
    for (let intento = 1; intento <= 2; intento++) {
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 8000);
        const r = await fetch(`${cfgSb.supabaseUrl.replace(/\/+$/, '')}/rest/v1/rpc/crear_pedido`, {
          method: 'POST', signal: ctrl.signal,
          headers: { apikey: cfgSb.supabaseKey, 'Content-Type': 'application/json' },
          body: cuerpo
        });
        clearTimeout(t);
        if (r.ok) return Number(await r.json()) || null;
        const txt = await r.text();
        // El código de descuento no se puede usar (ya lo usó esta persona o se agotó)
        if (/CUPON_YA_USADO/.test(txt)) return { cupon: 'usado' };
        if (/CUPON_NO_VALIDO/.test(txt)) return { cupon: 'invalido' };
        if (/CUPON_PERSONAL/.test(txt)) return { cupon: 'personal' };
        console.warn('[Insanity] No se pudo registrar el pedido:', r.status, txt);
        if (r.status < 500) return null; // error de datos: reintentar no ayuda
      } catch (err) {
        console.warn('[Insanity] No se pudo registrar el pedido (intento ' + intento + '):', err?.name || err);
      }
    }
    return null;
  }

  let enviando = false;
  $('#enviarWhatsapp').addEventListener('click', async () => {
    if (!carrito.length || enviando) return;
    const fallos = Object.keys(reglas).filter((k) => !validarCampo(k, true));
    if (fallos.length) { (f[fallos[0]] || f.nombre).focus(); toast('Revisa los campos marcados.'); return; }

    const ciudad = f.ciudad.value === OTRA ? f.ciudadOtra.value.trim() : f.ciudad.value;
    storage.set('insanity-cliente', {
      nombre: f.nombre.value.trim(), celular: f.celular.value, dep: f.dep.value, ciudad: f.ciudad.value,
      ciudadOtra: f.ciudadOtra.value.trim(), direccion: f.direccion.value.trim(), barrio: f.barrio.value.trim()
    });

    // La ventana se abre ya (dentro del clic) para que el navegador no la bloquee,
    // y se le pone la dirección de WhatsApp cuando el pedido queda guardado.
    const win = window.open('', '_blank');
    if (win) { win.opener = null; try { win.document.title = 'Abriendo WhatsApp…'; win.document.body.innerHTML = '<p style="font:16px system-ui;padding:2rem;color:#555">Abriendo WhatsApp…</p>'; } catch { /* sin acceso */ } }
    const btnEnviar = $('#enviarWhatsapp');
    enviando = true; btnEnviar.disabled = true; btnEnviar.dataset.texto ??= btnEnviar.textContent; btnEnviar.textContent = 'Enviando…';
    const resultado = await registrarPedido({
      nombre: f.nombre.value.trim(), celular: f.celular.value, cedula: f.cedula.value,
      departamento: f.dep.value, ciudad, direccion: f.direccion.value.trim(), barrio: f.barrio.value.trim(), notas: f.notas.value.trim()
    });
    enviando = false; btnEnviar.disabled = false; btnEnviar.textContent = btnEnviar.dataset.texto;
    if (resultado && typeof resultado === 'object' && resultado.cupon) {
      // No se envía nada: se quita el código y la persona decide si sigue sin él
      try { win?.close(); } catch { /* */ }
      const codigoQuitado = cupon?.codigo || '';
      cupon = null; storage.set(CLAVE_CUPON, null); guardarYRender();
      pintarTotalCheckout();
      const aviso = resultado.cupon === 'usado'
        ? `El código ${codigoQuitado} ya fue usado con este celular o cédula (es de un solo uso por persona). Lo quitamos: revisa el nuevo total y vuelve a enviar.`
        : resultado.cupon === 'personal'
          ? `El código ${codigoQuitado} es personal de la Lista VIP: solo funciona con el celular con el que se suscribió. Lo quitamos: revisa el nuevo total y vuelve a enviar.`
          : `El código ${codigoQuitado} ya no está disponible. Lo quitamos: revisa el nuevo total y vuelve a enviar.`;
      const av = $('#checkoutAviso');
      if (av) { av.textContent = aviso; av.classList.remove('hidden'); av.scrollIntoView({ block: 'nearest' }); }
      toast(resultado.cupon === 'usado' ? `El código ${codigoQuitado} ya fue usado. Revisa el nuevo total.` : resultado.cupon === 'personal' ? `El código ${codigoQuitado} es personal de otro celular.` : `El código ${codigoQuitado} ya no está disponible.`);
      return;
    }
    const numeroPedido = resultado;
    if (numeroPedido) recordarPedido(numeroPedido, f.celular.value);

    const lineas = carrito.map((i) => `• ${i.nombre}\n   ${detalleItem(i)} · Cant: ${i.cantidad} · ${dinero(i.precio * i.cantidad)}`);
    const mensaje = [
      `*NUEVO PEDIDO${numeroPedido ? ` #${numeroPedido}` : ''} — INSANITY SOCIETY*`, '',
      ...lineas, '',
      ...(carrito.some((i) => i.preventa) ? ['⏳ Incluye prendas en PREVENTA: se entregan en la fecha estimada.', ''] : []),
      ...(carrito.some((i) => !i.preventa) ? [`🧵 ${textoConfeccion()} (desde la confirmación del pago)`, ''] : []),
      ...(descuentoCupon() ? [`Subtotal: ${dinero(subtotalCarrito())}`, `Código de descuento ${cupon.codigo} (${textoCupon(cupon)}): −${dinero(descuentoCupon())}`] : []),
      `*Total productos: ${dinero(totalCarrito())}* (sin envío)`,
      `🚚 ${textoEnvio()}`, '',
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
    if (win && !win.closed) win.location.href = url;
    else location.href = url; // si el navegador bloqueó la ventana

    carrito = [];
    cupon = null; storage.set(CLAVE_CUPON, null);
    guardarYRender();
    form.reset();
    setCheckout(false);
    toast(numeroPedido ? `¡Pedido #${numeroPedido} listo! Envía el mensaje en WhatsApp. Puedes seguirlo en «Mis pedidos».` : '¡Pedido listo! Envía el mensaje en WhatsApp para confirmarlo.');
  });

  // ---------- Acceso secreto al panel ----------
  // Tocar 5 veces seguidas el logo del pie de página abre admin.html.
  // La seguridad real sigue estando en el inicio de sesión y en la base de datos.
  const logoPie = $('.footer-logo');
  if (logoPie) {
    let toques = 0, reinicio;
    logoPie.addEventListener('click', () => {
      toques += 1;
      clearTimeout(reinicio);
      reinicio = setTimeout(() => { toques = 0; }, 1500);
      if (toques >= 5) {
        toques = 0;
        navigator.vibrate?.(40);
        location.href = 'admin.html';
      }
    });
    // Si este dispositivo ya tiene sesión iniciada en el panel, mostrar un acceso discreto
    try {
      const conSesion = Object.keys(localStorage).some((k) => /^sb-.+-auth-token$/.test(k));
      if (conSesion) {
        const a = document.createElement('a');
        a.href = 'admin.html';
        a.className = 'footer-admin';
        a.textContent = 'Panel';
        logoPie.closest('.footer-inner')?.appendChild(a);
      }
    } catch { /* sin almacenamiento */ }
  }

  // ---------- Guía de tallas ----------
  const guiaModal = $('#guiaModal');
  function setGuia(open) {
    if (!guiaModal) return;
    guiaModal.classList.toggle('hidden', !open);
    document.body.classList.toggle('no-scroll', open || !productoModal?.classList.contains('hidden'));
    if (open) { $('#cerrarGuia')?.focus(); const a = $('#guiaWhatsapp'); if (a) a.href = `https://wa.me/${numeroWa}?text=${encodeURIComponent('Hola, necesito ayuda para elegir mi talla')}`; }
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-guia]')) { e.preventDefault(); setGuia(true); } });
  $('#cerrarGuia')?.addEventListener('click', () => setGuia(false));
  $('#cerrarGuia2')?.addEventListener('click', () => setGuia(false));
  guiaModal?.addEventListener('click', (e) => { if (e.target === guiaModal) setGuia(false); });

  // ---------- Ventanas abiertas: Escape y botón "atrás" las cierran ----------
  // Orden: de la que queda encima a la de abajo.
  const ventanas = [
    [vipModal, () => !vipModal.classList.contains('hidden'), () => cerrarVip()],
    [guiaModal, () => !guiaModal.classList.contains('hidden'), () => setGuia(false)],
    [productoModal, () => !productoModal.classList.contains('hidden'), () => cerrarProducto()],
    [checkoutModal, () => !checkoutModal.classList.contains('hidden'), () => setCheckout(false)],
    [panel, () => panel.classList.contains('open'), () => setPanel(false)],
    [carritoPanel, () => carritoPanel.classList.contains('active'), () => setCarrito(false)]
  ].filter(([el]) => el);
  const hayVentana = () => ventanas.some(([, abierta]) => abierta());
  function cerrarVentanaSuperior() {
    const v = ventanas.find(([, abierta]) => abierta());
    if (v) { v[2](); return true; }
    return false;
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    if (!cerrarVentanaSuperior()) setMenu(false);
  });

  // En el celular, "atrás" debe cerrar el producto/carrito abierto y no sacar a la persona
  // de la sección. Al abrir una ventana se añade una entrada al historial y "atrás" la consume
  // cerrando la ventana. Si se cierra con la ✕, esa entrada queda en desuso: se reutiliza al abrir
  // otra ventana y, si alguien vuelve a caer en ella con "atrás", se salta sola.
  const esEntradaVentana = () => !!history.state?.ventana;
  let entradaVentana = false, revisarPendiente = false;
  function sincronizarHistorial() {
    revisarPendiente = false;
    const hay = hayVentana();
    if (hay && !entradaVentana) {
      if (!esEntradaVentana()) history.pushState({ ventana: true }, '');
      entradaVentana = true;
    } else if (!hay) entradaVentana = false;
  }
  const observador = new MutationObserver(() => {
    if (revisarPendiente) return;
    revisarPendiente = true;
    setTimeout(sincronizarHistorial, 0); // cerrar un producto y abrir otro no debe tocar el historial
  });
  ventanas.forEach(([el]) => observador.observe(el, { attributes: true, attributeFilter: ['class', 'hidden'] }));
  window.addEventListener('popstate', () => {
    if (entradaVentana) {
      entradaVentana = false;
      cerrarVentanaSuperior(); // si queda otra abierta debajo, el observador vuelve a añadir la entrada
    } else if (esEntradaVentana() && !hayVentana()) history.back(); // entrada en desuso: saltarla
  });
})();
