/* =========================================================
   CATÁLOGO INSANITY SOCIETY
   ---------------------------------------------------------
   Si conectaste Supabase (js/config.js), los productos se editan
   desde admin.html y esta lista queda solo como RESPALDO por si
   Supabase no responde. Si no lo has conectado, se edita aquí.

   Campos de cada producto:
   - id:         identificador único (sin espacios)
   - nombre:     nombre visible
   - coleccion:  debe coincidir con data-coleccion de la tarjeta en "Colecciones"
   - categoria:  camiseta | sudadera | compresion | top | pantaloneta | short
   - material:   texto descriptivo
   - tallas:     ['S','M','L','XL']
   - colores:    ['Negro','Blanco', ...]
   - precio:     número en pesos (sin puntos). null = "Consultar precio"
   - variantes:  (opcional) [{ nombre: 'Burda', precio: 140000 }, ...]
                 si existe, el cliente elige una y se cobra ese precio
   - imagenes:   (opcional) por color: { Negro: { frente: 'ruta', espalda: 'ruta' } }
                 si un color no tiene imagen se usa la del primer color.
                 Sin imágenes se muestra un recuadro con el nombre de la colección.

   Para agregar fotos: guárdalas en img/productos/ con nombres
   en minúscula y sin espacios (ej: insane-negro-frente.webp)
   y añádelas en "imagenes".
   ========================================================= */

const TALLAS_STD = ['S', 'M', 'L', 'XL'];
const IMG = 'img/productos/';

const PRODUCTOS = [
  {
    id: 'kyoki-oversize', nombre: 'Camiseta Oversize KYO-KI', coleccion: 'KYO-KI', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro', 'Blanco', 'Gris'], precio: 130000,
    imagenes: {
      Negro: { frente: IMG + 'kyoki-negro-frente.webp', espalda: IMG + 'kyoki-negro-espalda.webp' },
      Blanco: { frente: IMG + 'kyoki-blanco-frente.webp', espalda: IMG + 'kyoki-blanco-espalda.webp' }
    }
  },
  {
    id: 'shoka-oversize', nombre: 'Camiseta Oversize SHOKA', coleccion: 'SHOKA', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro', 'Blanco', 'Gris'], precio: 125000,
    imagenes: { Negro: { frente: IMG + 'shoka-negro-frente.webp', espalda: IMG + 'shoka-negro-espalda.webp' } }
  },
  {
    id: 'shugo-oversize', nombre: 'Camiseta Oversize SHUGO', coleccion: 'SHUGO', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro', 'Blanco', 'Gris'], precio: 130000,
    imagenes: { Negro: { frente: IMG + 'shugo-negro-frente.webp', espalda: IMG + 'shugo-negro-espalda.webp' } }
  },
  {
    id: 'blood-and-steel-202', nombre: 'Camiseta Oversize BLOOD AND STEEL - 202', coleccion: 'BLOOD AND STEEL', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 140000,
    imagenes: { Negro: { frente: IMG + 'blood-and-steel-negro-frente.webp', espalda: IMG + 'blood-and-steel-negro-espalda.webp' } }
  },
  {
    // Precio pendiente: en la versión anterior figuraba en $0.
    // Cuando tengas el precio, reemplaza null por el valor (ej: 140000).
    id: 'raijin-oversize', nombre: 'Camiseta Oversize RAIJIN', coleccion: 'RAIJIN', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: null
  },
  {
    id: 'classic-oversize', nombre: 'Camiseta Oversize CLASSIC', coleccion: 'CLASSIC', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD,
    colores: ['Negro', 'Blanco', 'Gris oscuro', 'Verde militar', 'Azul turquí'], precio: 95000
  },
  {
    id: 'insane-oversize', nombre: 'Camiseta Oversize INSANE', coleccion: 'INSANE', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD,
    colores: ['Negro', 'Gris oscuro', 'Blanco', 'Verde militar'], precio: 130000
  },
  { id: 'baki-hanma', nombre: 'Camiseta Oversize Baki Hanma', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 130000 },
  { id: 'baki-hanma-2', nombre: 'Camiseta Oversize Baki Hanma 2', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 130000 },
  { id: 'jack-hanma', nombre: 'Camiseta Oversize Jack Hanma', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 130000 },
  { id: 'yujiro-hanma', nombre: 'Camiseta Oversize Yujiro Hanma', coleccion: 'BAKI-INSPIRED', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 130000 },
  { id: 'remember-oversize', nombre: 'Camiseta Oversize REMEMBER', coleccion: 'REMEMBER', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 140000 },
  { id: 'versus-oversize', nombre: 'Camiseta Oversize VERSUS', coleccion: 'VERSUS', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 140000 },
  { id: 'raw-society-oversize', nombre: 'Camiseta Oversize RAW SOCIETY', coleccion: 'RAW SOCIETY', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro', 'Blanco', 'Gris'], precio: 140000 },
  { id: 'break-your-limits', nombre: 'Camiseta Oversize BREAK YOUR LIMITS', coleccion: 'STREET STRENGTH', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 145000 },
  { id: 'still-your-best', nombre: 'Camiseta Oversize STILL YOUR BEST', coleccion: 'STREET STRENGTH', categoria: 'camiseta', material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro'], precio: 145000 },
  {
    id: 'iron-sudadera', nombre: 'Sudadera bota recta oversize IRON', coleccion: 'IRON', categoria: 'sudadera',
    material: 'Burda', tallas: TALLAS_STD,
    colores: ['Negro', 'Blanco', 'Gris claro', 'Beige', 'Verde militar', 'Vinotinto'], precio: 110000
  },
  {
    id: 'omen-sudadera', nombre: 'Sudadera bota recta oversize OMEN SOCIETY', coleccion: 'OMEN SOCIETY', categoria: 'sudadera',
    material: 'Burda o algodón perchado de alto gramaje', tallas: TALLAS_STD, colores: ['Negro'], precio: 140000,
    variantes: [{ nombre: 'Burda', precio: 140000 }, { nombre: 'Algodón perchado', precio: 190000 }]
  },
  {
    id: 'redemption-sudadera', nombre: 'Sudadera bota recta oversize REDEMPTION', coleccion: 'REDEMPTION', categoria: 'sudadera',
    material: 'Burda o algodón perchado de alto gramaje', tallas: TALLAS_STD, colores: ['Negro'], precio: 140000,
    variantes: [{ nombre: 'Burda', precio: 140000 }, { nombre: 'Algodón perchado', precio: 190000 }]
  },
  ...[
    ['nin', 'NIN (忍)'], ['ha', 'HA (破)'], ['retsu', 'RETSU (烈)'],
    ['mamoru', 'MAMORU (守)'], ['yami', 'YAMI (闇)'], ['tamashii', 'TAMASHII (魂)']
  ].map(([id, n]) => ({
    id: 'sixfold-' + id, nombre: 'SIXFOLD – ' + n, coleccion: 'SIXFOLD', categoria: 'camiseta',
    material: 'Algodón premium 200 g', tallas: TALLAS_STD, colores: ['Negro', 'Blanco', 'Gris', 'Beige'], precio: 120000
  })),
  {
    id: 'rebelion-compresion', nombre: 'Camiseta de compresión REBELION', coleccion: 'REBELION', categoria: 'compresion',
    material: 'Licrado', tallas: TALLAS_STD, colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Vinotinto'], precio: 80000
  },
  {
    id: 'berserk-compresion', nombre: 'Camiseta de compresión BERSERK', coleccion: 'BERSERK', categoria: 'compresion',
    material: 'Licrado', tallas: TALLAS_STD, colores: ['Negro', 'Blanco', 'Gris claro', 'Gris oscuro', 'Rojo'], precio: 70000
  },
  {
    id: 'crop-top-primera', nombre: 'Crop Top Oversize (Primera Edición)', coleccion: 'PRIMERA EDICIÓN', categoria: 'top',
    material: 'Algodón premium 190 g', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Blanco', 'Gris claro'], precio: 75000
  },
  {
    id: 'sport-camiseta', nombre: 'Camiseta SPORT', coleccion: 'SPORT', categoria: 'camiseta',
    material: 'Licra', tallas: ['Única'], colores: ['Negro', 'Blanco', 'Gris claro'], precio: 80000
  },
  {
    id: 'rift-pantaloneta', nombre: 'Pantaloneta RIFT', coleccion: 'RIFT', categoria: 'pantaloneta',
    material: 'Burda', tallas: ['S', 'M', 'L'], colores: ['Negro', 'Blanco', 'Gris'], precio: 75000
  },
  {
    id: 'short-licra', nombre: 'Short LICRA clásico', coleccion: 'SHORT LICRA', categoria: 'short',
    material: 'Licra', tallas: ['S', 'M', 'L'], colores: ['Negro'], precio: 45000
  }
];

const CATEGORIAS = {
  camiseta: 'Camisetas',
  compresion: 'Compresión',
  sudadera: 'Sudaderas',
  top: 'Tops',
  pantaloneta: 'Pantalonetas',
  short: 'Shorts'
};

// Número de WhatsApp que recibe los pedidos (formato internacional, sin +)
const WHATSAPP_NUMERO = '573241457674';

// Respaldo: la tienda usa esta lista si Supabase no está configurado o no responde
window.PRODUCTOS_LOCAL = PRODUCTOS;
