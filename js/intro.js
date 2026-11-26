// Intro oficial de Insanity Society.
// Se carga justo después de <div id="intro"> para decidir al instante (sin parpadeo)
// si se muestra. Elige el video según la pantalla: horizontal (PC) o vertical (celular),
// y una versión ligera si la conexión es lenta o la pantalla pequeña.
(function () {
  var intro = document.getElementById('intro');
  if (!intro) return;
  var raiz = document.documentElement;
  var CLAVE = 'insanity-intro';

  function guardarVista() { try { sessionStorage.setItem(CLAVE, '1'); } catch (e) {} }
  function yaVista() { try { return sessionStorage.getItem(CLAVE) === '1'; } catch (e) { return false; } }

  // No mostrar: ya se vio en esta visita, viene de un enlace de cuenta (confirmar correo,
  // recuperar contraseña) o la persona pidió reducir el movimiento.
  var h = location.hash || '';
  var enlaceCuenta = /access_token=|type=recovery|type=signup|error_description=/.test(h);
  var menosMovimiento = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (yaVista() || enlaceCuenta || menosMovimiento) { intro.remove(); return; }

  raiz.classList.add('con-intro');
  var video = intro.querySelector('.intro-video');
  var btnSaltar = intro.querySelector('.intro-saltar');
  var btnEntrar = intro.querySelector('.intro-entrar');
  var terminado = false;

  function conexionLenta() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && (c.saveData || /(^|-)2g|3g/.test(c.effectiveType || '')));
  }
  function conexionRapida() {
    var c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    return !!(c && c.effectiveType === '4g' && (c.downlink || 0) >= 10 && !c.saveData);
  }
  function variante() {
    var vertical = window.innerHeight > window.innerWidth * 1.05;
    var dpr = window.devicePixelRatio || 1;
    var ancho = Math.max(window.innerWidth, window.innerHeight) * dpr;   // lado largo en píxeles reales
    // Celular: versión 720p (3,4 MB) salvo que el navegador confirme una conexión rápida.
    // PC: versión 1080p (9,6 MB) salvo conexión lenta o pantalla pequeña.
    var ligero = vertical ? !conexionRapida() || ancho < 1100
                          : conexionLenta() || ancho < 1400;
    return (vertical ? 'movil' : 'pc') + (ligero ? '-ligero' : '');
  }
  var actual = '';
  function cargar(v, desde) {
    actual = v;
    var base = v.replace('-ligero', '');
    video.poster = 'vid/intro-' + base + '-inicio.jpg';
    // #t= indica al navegador desde qué segundo empezar (para continuar al girar la pantalla)
    video.src = 'vid/intro-' + v + '.mp4' + (desde ? '#t=' + desde.toFixed(2) : '');
    if (desde) video.addEventListener('loadedmetadata', function f() {
      video.removeEventListener('loadedmetadata', f);
      try { if (video.currentTime < desde - 0.5) video.currentTime = desde; } catch (e) {}
    });
    // 1) Intenta reproducir CON sonido. 2) Si el navegador no lo permite (regla de todos los
    //    navegadores: no hay sonido sin una interacción previa), sigue en silencio y el sonido
    //    se enciende solo con el primer toque, clic o tecla.
    video.muted = false;
    var p = video.play();
    if (p && p.catch) p.catch(function () {
      video.muted = true;
      var p2 = video.play();
      if (p2 && p2.catch) p2.catch(function () {
        // Ni siquiera en silencio (p. ej. modo ahorro en iPhone): botón para entrar.
        intro.classList.add('sin-autoplay');
      });
    });
  }

  function activarSonido() {
    if (terminado || !video.muted) return;
    video.muted = false;
    if (video.paused && !intro.classList.contains('sin-autoplay')) video.play().catch(function () {});
  }
  ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) {
    document.addEventListener(ev, activarSonido, { capture: true, passive: true });
  });

  function terminar() {
    if (terminado) return;
    terminado = true;
    guardarVista();
    intro.classList.add('saliendo');
    raiz.classList.remove('con-intro');
    document.removeEventListener('keydown', alTeclado);
    ['pointerdown', 'touchend', 'keydown'].forEach(function (ev) {
      document.removeEventListener(ev, activarSonido, { capture: true });
    });
    window.removeEventListener('resize', alCambiarTamano);
    setTimeout(function () {
      try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
      intro.remove();
      document.dispatchEvent(new CustomEvent('intro:fin'));
    }, 900);
  }

  function alTeclado(e) { if (e.key === 'Escape') terminar(); }
  var espera;
  function alCambiarTamano() {
    // Si giran el celular o cambian el tamaño de la ventana, cambia al video que corresponde
    // y continúa en el mismo segundo.
    clearTimeout(espera);
    espera = setTimeout(function () {
      var v = variante();
      if (v.replace('-ligero', '') !== actual.replace('-ligero', '')) cargar(v, video.currentTime || 0);
    }, 250);
  }

  video.addEventListener('ended', terminar);
  video.addEventListener('error', function () { if (!terminado) terminar(); });
  btnSaltar.addEventListener('click', terminar);
  btnEntrar.addEventListener('click', function () {
    intro.classList.remove('sin-autoplay');
    video.muted = false;
    var p = video.play();
    if (p && p.catch) p.catch(terminar);
  });
  document.addEventListener('keydown', alTeclado);
  window.addEventListener('resize', alCambiarTamano);

  // Seguro: si el video no logra arrancar en 6 s (red muy lenta), se entra directo a la web.
  setTimeout(function () {
    if (!terminado && video.currentTime === 0 && !intro.classList.contains('sin-autoplay')) terminar();
  }, 6000);
  // Seguro final: una vez arranca, nunca más de 25 s de intro (por si el video se congela).
  video.addEventListener('playing', function f() { video.removeEventListener('playing', f); setTimeout(terminar, 25000); });

  cargar(variante());
})();
