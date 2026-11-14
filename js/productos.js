/* =========================================================
   CATÁLOGO INSANITY SOCIETY — Agosto 2026
   ---------------------------------------------------------
   Si conectaste Supabase (js/config.js), los productos se editan
   desde admin.html y esta lista queda solo como RESPALDO por si
   Supabase no responde. Si no lo has conectado, se edita aquí.

   Campos de cada producto:
   - id, nombre, coleccion, categoria, material
   - tallas:    ['S','M','L','XL']
   - colores:   ['Negro','Blanco', ...]
   - precio:    número en pesos. null = "Consultar precio"
   - variantes: (opcional) [{ nombre: 'Burda', precio: 167000 }, ...]
   - imagenes:  (opcional) { Negro: { frente: 'ruta', espalda: 'ruta' } }
   ========================================================= */

const IMG = 'img/productos/';
const T_S_XL = ['S', 'M', 'L', 'XL'];
const T_S_2XL = ['S', 'M', 'L', 'XL', '2XL'];
const T_XS_3XL = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL'];
const T_S_4XL = ['S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];
const QATAR = 'Qatar Premium 240 g';
const LICRADO = 'Licrado · liviano y fresco · secado rápido';
const BURDA_SUD = 'Burda · liviana y fresca';
const COL_COMP = ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Rojo'];
const COL_CAMISILLA = ['Negro', 'Blanco', 'Gris', 'Rojo', 'Azul oscuro', 'Verde militar'];
const img = (frente, espalda) => (espalda ? { frente: IMG + frente + '.webp', espalda: IMG + espalda + '.webp' } : { frente: IMG + frente + '.webp' });

const PRODUCTOS = [
  // ---- THE TRUTH BEHIND THE MASK ----
  { id: 'control-vs-chaos', nombre: 'Chaqueta CONTROL VS CHAOS', coleccion: 'THE TRUTH BEHIND THE MASK', categoria: 'chaqueta',
    material: 'Burda', tallas: T_XS_3XL, colores: ['Negro', 'Blanco', 'Gris'], precio: 217000,
    imagenes: { Negro: img('control-vs-chaos-negro-frente', 'control-vs-chaos-negro-espalda') } },
  { id: 'untamed', nombre: 'Camiseta Oversize UNTAMED', coleccion: 'THE TRUTH BEHIND THE MASK', categoria: 'camiseta',
    material: QATAR, tallas: T_XS_3XL, colores: ['Negro', 'Blanco', 'Arena', 'Rojo'], precio: 133000,
    imagenes: { Negro: img('untamed-negro-frente') } },
  { id: 'revelation', nombre: 'Camiseta Oversize REVELATION', coleccion: 'THE TRUTH BEHIND THE MASK', categoria: 'camiseta',
    material: QATAR, tallas: T_XS_3XL, colores: ['Negro', 'Blanco', 'Arena', 'Rojo'], precio: 147000,
    imagenes: { Negro: img('revelation-negro-frente', 'revelation-negro-espalda') } },
  { id: 'awakening', nombre: 'Camiseta Oversize AWAKENING', coleccion: 'THE TRUTH BEHIND THE MASK', categoria: 'camiseta',
    material: QATAR, tallas: T_XS_3XL, colores: ['Negro'], precio: 147000,
    imagenes: { Negro: img('awakening-negro-frente', 'awakening-negro-espalda') } },
  { id: 'path-of-masks', nombre: 'Sudadera THE PATH OF MASKS', coleccion: 'THE TRUTH BEHIND THE MASK', categoria: 'sudadera',
    material: QATAR, tallas: T_XS_3XL, colores: ['Negro'], precio: 165000,
    imagenes: { Negro: img('path-of-masks-negro-frente') } },

  // ---- DARK REBIRTH (camisetas) ----
  { id: 'dark-rebirth-1', nombre: 'Camiseta Oversize DARK REBIRTH I', coleccion: 'DARK REBIRTH', categoria: 'camiseta',
    material: QATAR + ' · también en Acid Wash', tallas: T_S_4XL, colores: ['Negro'], precio: 140000,
    imagenes: { Negro: img('dark-rebirth-1-negro-frente', 'dark-rebirth-1-negro-espalda') } },
  { id: 'dark-rebirth-2', nombre: 'Camiseta Oversize DARK REBIRTH II', coleccion: 'DARK REBIRTH', categoria: 'camiseta',
    material: QATAR + ' · también en Acid Wash', tallas: T_S_4XL, colores: ['Negro'], precio: 140000,
    imagenes: { Negro: img('dark-rebirth-2-negro-frente', 'dark-rebirth-2-negro-espalda') } },
  { id: 'dark-rebirth-3', nombre: 'Camiseta Oversize DARK REBIRTH III', coleccion: 'DARK REBIRTH', categoria: 'camiseta',
    material: QATAR + ' · también en Acid Wash', tallas: T_S_4XL, colores: ['Negro'], precio: 100000,
    imagenes: { Negro: img('dark-rebirth-3-negro-frente') } },
  { id: 'dark-rebirth-4', nombre: 'Camiseta Oversize DARK REBIRTH IV', coleccion: 'DARK REBIRTH', categoria: 'camiseta',
    material: QATAR + ' · también en Acid Wash', tallas: T_S_4XL, colores: ['Negro', 'Gris', 'Blanco'], precio: 100000,
    imagenes: { Negro: img('dark-rebirth-4-negro-frente', 'dark-rebirth-4-negro-espalda') } },

  // ---- DARK REBIRTH (sudaderas) ----
  ...[1, 2, 3, 4, 5, 6, 7].map((n) => ({
    id: 'dr-sudadera-' + n, nombre: 'Sudadera Oversize DARK REBIRTH ' + ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII'][n - 1],
    coleccion: 'DARK REBIRTH', categoria: 'sudadera', material: 'Burda 200 g', tallas: T_S_XL,
    colores: n === 4 || n === 5 ? ['Negro', 'Gris', 'Blanco'] : ['Negro'], precio: 150000,
    imagenes: { Negro: img('dr-sudadera-' + n + '-negro') }
  })),

  // ---- CLASSIC ----
  { id: 'classic-oversize', nombre: 'Camiseta Oversize CLASSIC', coleccion: 'CLASSIC', categoria: 'camiseta',
    material: 'Qatar Premium 240 g, Texturizado 230 g o Acid Wash (Acid Wash: Negro, Gris, Rojo, Rosado, Beige)',
    tallas: T_S_2XL, colores: ['Negro', 'Blanco', 'Gris', 'Verde militar', 'Beige', 'Café', 'Azul', 'Rojo', 'Rosado'], precio: 100000,
    variantes: [{ nombre: 'Qatar Premium 240 g', precio: 100000 }, { nombre: 'Texturizado 230 g', precio: 100000 }, { nombre: 'Acid Wash', precio: 108000 }],
    imagenes: { Negro: img('classic-negro-frente'), Blanco: img('classic-blanco-frente') } },

  // ---- INSANE ----
  { id: 'insane-premium', nombre: 'Camiseta Oversize INSANE Premium', coleccion: 'INSANE', categoria: 'camiseta',
    material: QATAR + ' · también en Acid Wash', tallas: T_S_4XL,
    colores: ['Negro', 'Gris', 'Blanco', 'Verde militar', 'Rojo', 'Beige'], precio: 172000,
    imagenes: { Negro: img('insane-premium-negro-frente', 'insane-premium-negro-espalda'), Blanco: img('insane-premium-blanco-frente', 'insane-premium-blanco-espalda') } },
  { id: 'insane-oversize', nombre: 'Camiseta Oversize INSANE', coleccion: 'INSANE', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: T_S_XL,
    colores: ['Negro', 'Gris oscuro', 'Blanco', 'Verde militar', 'Beige', 'Café', 'Azul', 'Rojo'], precio: 145000,
    imagenes: { Negro: img('insane-negro-frente', 'insane-negro-espalda') } },

  // ---- BAKI-INSPIRED ----
  { id: 'baki-hanma', nombre: 'Camiseta Oversize Baki Hanma', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: QATAR, tallas: T_S_2XL, colores: ['Negro'], precio: 163000,
    imagenes: { Negro: img('baki-hanma-frente', 'baki-hanma-espalda') } },
  { id: 'baki-hanma-2', nombre: 'Camiseta Oversize Baki Hanma 2', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: QATAR, tallas: T_S_XL, colores: ['Negro'], precio: 163000,
    imagenes: { Negro: img('baki-hanma-2-frente', 'baki-hanma-2-espalda') } },
  { id: 'jack-hanma', nombre: 'Camiseta Oversize Jack Hanma', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: T_S_XL, colores: ['Negro'], precio: 163000,
    imagenes: { Negro: img('jack-hanma-frente', 'jack-hanma-espalda') } },
  { id: 'yujiro-hanma', nombre: 'Camiseta Oversize Yujiro Hanma', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: QATAR, tallas: T_S_XL, colores: ['Negro'], precio: 163000,
    imagenes: { Negro: img('yujiro-hanma-frente', 'yujiro-hanma-espalda') } },

  // ---- REMEMBER / VERSUS ----
  { id: 'remember-oversize', nombre: 'Camiseta Oversize REMEMBER', coleccion: 'REMEMBER', categoria: 'camiseta', material: QATAR, tallas: T_S_XL, colores: ['Negro'], precio: 130000,
    imagenes: { Negro: img('remember-frente', 'remember-espalda') } },
  { id: 'versus-oversize', nombre: 'Camiseta Oversize VERSUS', coleccion: 'VERSUS', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: T_S_XL, colores: ['Negro', 'Blanco'], precio: 145000,
    imagenes: { Negro: img('versus-frente', 'versus-espalda') } },

  // ---- SUDADERAS BOTA RECTA ----
  { id: 'classic-sudadera', nombre: 'Sudadera bota recta oversize CLASSIC', coleccion: 'CLASSIC', categoria: 'sudadera',
    material: BURDA_SUD, tallas: T_S_XL, colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto'], precio: 110000,
    imagenes: { Negro: img('classic-sudadera-negro') } },
  { id: 'insane-sudadera', nombre: 'Sudadera bota recta oversize INSANE', coleccion: 'INSANE', categoria: 'sudadera',
    material: BURDA_SUD, tallas: T_S_XL, colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro'], precio: 133000,
    imagenes: { Negro: img('insane-sudadera-negro') } },
  { id: 'iron-sudadera', nombre: 'Sudadera bota recta oversize IRON', coleccion: 'IRON', categoria: 'sudadera',
    material: BURDA_SUD, tallas: T_S_XL, colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto'], precio: 133000,
    imagenes: { Negro: img('iron-sudadera-negro') } },
  { id: 'omen-sudadera', nombre: 'Sudadera bota recta oversize OMEN SOCIETY', coleccion: 'OMEN SOCIETY', categoria: 'sudadera',
    material: 'Burda o algodón perchado de alto gramaje', tallas: T_S_XL, colores: ['Negro'], precio: 167000,
    variantes: [{ nombre: 'Burda', precio: 167000 }, { nombre: 'Algodón perchado (alto gramaje)', precio: 200000 }],
    imagenes: { Negro: img('omen-sudadera-negro') } },
  { id: 'redemption-sudadera', nombre: 'Sudadera bota recta oversize REDEMPTION', coleccion: 'REDEMPTION', categoria: 'sudadera',
    material: 'Burda o algodón perchado de alto gramaje', tallas: T_S_XL, colores: ['Negro'], precio: 167000,
    variantes: [{ nombre: 'Burda', precio: 167000 }, { nombre: 'Algodón perchado (alto gramaje)', precio: 200000 }],
    imagenes: { Negro: img('redemption-sudadera-negro') } },
  { id: 'super-oversize-cargo', nombre: 'Sudadera SUPER OVERSIZE CARGO', coleccion: 'SUPER OVERSIZE CARGO', categoria: 'sudadera',
    material: 'Algodón perchado de alto gramaje · bolsillos cargo', tallas: T_S_XL,
    colores: ['Negro', 'Blanco', 'Beige', 'Gris', 'Vinotinto'], precio: 197000,
    imagenes: { Negro: img('cargo-negro-frente', 'cargo-negro-espalda') } },

  // ---- JOGGERS ----
  // Revisa: el catálogo muestra $147.000 y $120.000; aquí se tomó $120.000 liso y $147.000 con diseño.
  { id: 'jogger', nombre: 'Sudadera JOGGER', coleccion: 'JOGGERS', categoria: 'jogger',
    material: 'Burda · ajuste en tobillos · todos los diseños de sudadera oversize disponibles', tallas: T_S_XL,
    colores: ['Negro', 'Blanco', 'Gris claro', 'Beige', 'Verde militar', 'Vinotinto'], precio: 120000,
    variantes: [{ nombre: 'Liso', precio: 120000 }, { nombre: 'Con diseño', precio: 147000 }],
    imagenes: { Negro: img('jogger-negro', 'jogger-diseno-negro') } },

  // ---- COMPRESIÓN ----
  { id: 'insanity-order-compresion', nombre: 'Camiseta de compresión INSANITY ORDER', coleccion: 'INSANITY ORDER', categoria: 'compresion',
    material: LICRADO, tallas: T_S_XL, colores: COL_COMP, precio: 75000, imagenes: { Negro: img('insanity-order-negro') } },
  { id: 'no-mercy-compresion', nombre: 'Camiseta de compresión NO MERCY', coleccion: 'NO MERCY', categoria: 'compresion',
    material: LICRADO, tallas: T_S_XL, colores: COL_COMP, precio: 70000, imagenes: { Negro: img('no-mercy-negro') } },
  { id: 'classic-compresion', nombre: 'Camiseta de compresión CLASSIC', coleccion: 'CLASSIC', categoria: 'compresion',
    material: LICRADO, tallas: T_S_XL, colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto', 'Rojo'], precio: 65000,
    imagenes: { Negro: img('classic-compresion-negro') } },
  { id: 'rebelion-compresion', nombre: 'Camiseta de compresión REBELION', coleccion: 'REBELION', categoria: 'compresion',
    material: LICRADO, tallas: T_S_XL, colores: COL_COMP, precio: 75000, imagenes: { Negro: img('rebelion-compresion-negro') } },
  { id: 'berserk-compresion', nombre: 'Camiseta de compresión BERSERK', coleccion: 'BERSERK', categoria: 'compresion',
    material: LICRADO, tallas: T_S_XL, colores: COL_COMP, precio: 65000, imagenes: { Blanco: img('berserk-compresion-blanco') } },
  { id: 'buzo-compresion', nombre: 'Buzo de compresión', coleccion: 'CLASSIC', categoria: 'compresion',
    material: LICRADO + ' · disponible en todos los diseños de compresión', tallas: T_S_XL,
    colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto'], precio: 75000, imagenes: { Negro: img('buzo-compresion-negro') } },
  { id: 'rebelion-buzo', nombre: 'Buzo de compresión REBELION', coleccion: 'REBELION', categoria: 'compresion',
    material: LICRADO, tallas: T_S_XL, colores: ['Negro'], precio: 90000, imagenes: { Negro: img('rebelion-buzo-negro') } },
  { id: 'esqueleto-classic', nombre: 'Esqueleto de compresión CLASSIC', coleccion: 'CLASSIC', categoria: 'camisilla',
    material: LICRADO + ' · disponible con diseños de compresión', tallas: T_S_XL,
    colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto', 'Rojo'], precio: 50000, imagenes: { Negro: img('esqueleto-classic') } },

  // ---- CAMISILLAS ----
  // Revisa tallas: el catálogo no las indica.
  { id: 'crypt-camisilla', nombre: 'Camisilla CRYPT', coleccion: 'CRYPT', categoria: 'camisilla',
    material: 'Camisilla', tallas: T_S_XL, colores: COL_CAMISILLA, precio: 75000,
    imagenes: { Negro: img('crypt-negro'), Blanco: img('crypt-blanco'), Gris: img('crypt-gris'), Rojo: img('crypt-rojo') } },
  { id: 'death-ascent-camisilla', nombre: 'Camisilla DEATH ASCENT', coleccion: 'DEATH ASCENT', categoria: 'camisilla',
    material: 'Camisilla', tallas: T_S_XL, colores: COL_CAMISILLA, precio: 75000,
    imagenes: { Negro: img('death-ascent-negro'), Blanco: img('death-ascent-blanco') } },

  // ---- SENKI (mujer) ----
  // Revisa tallas: el catálogo no las indica.
  { id: 'senki-guardiana', nombre: 'SENKI — La Guardiana del Instinto', coleccion: 'SENKI', categoria: 'camiseta',
    material: QATAR, tallas: T_S_XL, colores: ['Blanco'], precio: 133000, imagenes: { Blanco: img('senki-guardiana-frente', 'senki-guardiana-espalda') } },
  { id: 'senki-elegida', nombre: 'SENKI — La Elegida del Filo', coleccion: 'SENKI', categoria: 'camiseta',
    material: QATAR, tallas: T_S_XL, colores: ['Blanco'], precio: 133000, imagenes: { Blanco: img('senki-elegida-frente', 'senki-elegida-espalda') } },
  { id: 'senki-serenidad', nombre: 'SENKI — La Serenidad del Poder', coleccion: 'SENKI', categoria: 'camiseta',
    material: QATAR, tallas: T_S_XL, colores: ['Blanco'], precio: 133000, imagenes: { Blanco: img('senki-serenidad-frente', 'senki-serenidad-espalda') } },

  // ---- MUJER / SPORT ----
  { id: 'crop-top-classic', nombre: 'Crop Top Oversize CLASSIC', coleccion: 'CLASSIC', categoria: 'top',
    material: 'Algodón premium 190 g', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Blanco', 'Gris claro'], precio: 75000,
    imagenes: { Negro: img('crop-classic-negro') } },
  { id: 'crop-top-primera', nombre: 'Crop Top Oversize (Primera Edición)', coleccion: 'PRIMERA EDICIÓN', categoria: 'top',
    material: 'Algodón premium 190 g', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Blanco', 'Gris claro'], precio: 80000,
    imagenes: { Negro: img('crop-primera-frente', 'crop-primera-espalda') } },
  { id: 'sport-camiseta', nombre: 'Camiseta SPORT', coleccion: 'SPORT', categoria: 'camiseta',
    material: 'Licra', tallas: ['Única'], colores: ['Negro', 'Blanco', 'Gris oscuro', 'Vinotinto', 'Verde militar', 'Gris claro'], precio: 60000,
    imagenes: { Blanco: img('sport-camiseta-blanco') } },
  { id: 'sport-chaqueta', nombre: 'Chaqueta SPORT', coleccion: 'SPORT', categoria: 'chaqueta',
    material: 'Licra', tallas: T_S_XL, colores: ['Negro', 'Blanco', 'Gris oscuro', 'Vinotinto', 'Verde militar', 'Gris claro', 'Mora leche', 'Verde pastel'], precio: 105000,
    imagenes: { Negro: img('sport-chaqueta-negro') } },
  { id: 'runner-pantaloneta', nombre: 'Pantaloneta RUNNER', coleccion: 'RUNNER', categoria: 'pantaloneta',
    material: 'Bolsillos laterales y ranuras a los lados (opcional con licra por debajo)', tallas: ['S', 'M', 'L'],
    colores: ['Negro', 'Blanco', 'Gris', 'Beige', 'Verde militar', 'Café'], precio: 90000,
    variantes: [{ nombre: 'Burda', precio: 90000 }, { nombre: 'Semi impermeable', precio: 90000 }],
    imagenes: { Beige: img('runner-beige') } },
  { id: 'short-licra', nombre: 'Short LICRA clásico', coleccion: 'SHORT LICRA', categoria: 'short',
    material: 'Licra', tallas: T_S_XL, colores: ['Negro', 'Gris', 'Verde militar', 'Blanco', 'Vinotinto', 'Rojo'], precio: 55000,
    imagenes: { Negro: img('short-licra-negro') } },
  // Revisa tallas y colores: el catálogo no los indica (se tomaron de las fotos).
  { id: 'top-deportivo', nombre: 'Top deportivo', coleccion: 'TOPS', categoria: 'top',
    material: 'Nylon de alta resistencia y elasticidad · doble tela, cero transparencias', tallas: ['S', 'M', 'L'],
    colores: ['Negro', 'Vinotinto'], precio: 55000,
    imagenes: { Negro: img('top-negro'), Vinotinto: img('top-rojo') } }
];

const CATEGORIAS = {
  camiseta: 'Camisetas',
  compresion: 'Compresión',
  camisilla: 'Camisillas',
  sudadera: 'Sudaderas',
  jogger: 'Joggers',
  chaqueta: 'Chaquetas',
  top: 'Tops',
  pantaloneta: 'Pantalonetas',
  short: 'Shorts'
};

// Productos que ya no están en el catálogo (se ocultan en la tienda)
const PRODUCTOS_DESCONTINUADOS = [
  'kyoki-oversize', 'shoka-oversize', 'shugo-oversize', 'blood-and-steel-202', 'raijin-oversize',
  'raw-society-oversize', 'break-your-limits', 'still-your-best', 'rift-pantaloneta',
  'sixfold-nin', 'sixfold-ha', 'sixfold-retsu', 'sixfold-mamoru', 'sixfold-yami', 'sixfold-tamashii'
];

// Número de WhatsApp que recibe los pedidos (formato internacional, sin +)
const WHATSAPP_NUMERO = '573241457674';

// Respaldo: la tienda usa esta lista si Supabase no está configurado o no responde
window.PRODUCTOS_LOCAL = PRODUCTOS;
