# Guía: activar el panel de administración

Con esto podrás crear, editar, ocultar y borrar productos desde `admin.html`, sin tocar código.
Solo las cuentas que tú registres como administradoras pueden hacer cambios: la base de datos rechaza cualquier intento de otra persona, aunque encuentre la página del panel.

Tiempo estimado: 15 minutos. Los nombres de los menús de Supabase pueden variar un poco con el tiempo; si no ves uno exactamente igual, búscalo con un nombre parecido.

---

## 1. Crear el proyecto en Supabase

1. Entra a **https://supabase.com** y crea una cuenta gratuita (puedes usar tu GitHub).
2. Pulsa **New project**.
   - **Name:** `insanity-society`
   - **Database password:** crea una contraseña fuerte y **guárdala** (no la necesitarás en la web, pero sí si algún día recuperas el proyecto).
   - **Region:** la más cercana a Colombia (por ejemplo *South America – São Paulo* o *East US*).
3. Pulsa **Create new project** y espera 1–2 minutos a que termine.

## 2. Crear las tablas y las reglas de seguridad

1. En el menú izquierdo abre **SQL Editor** → **New query**.
2. Abre el archivo `supabase/setup.sql` de tu proyecto, copia **todo** su contenido y pégalo.
3. Pulsa **Run**. Debe decir *Success*.

Esto crea la tabla de productos (con los 31 productos que ya tienes), la carpeta de fotos y las reglas que impiden que alguien que no sea administrador cambie algo.

### 2b. Activar la edición de secciones (Inicio, Colecciones, La Sociedad, Tienda, Comunidad, General)

1. **SQL Editor** → **New query**.
2. Pega todo el contenido de `supabase/contenido.sql` y pulsa **Run**.

Esto guarda los textos actuales de la web para que puedas editarlos desde el panel. Si ya habías hecho los demás pasos, solo necesitas este.

### 2c. Activar destacados, ofertas y códigos de descuento

1. **SQL Editor** → **New query**.
2. Pega todo el contenido de `supabase/promos.sql` y pulsa **Run**.

### 2d. Activar el inventario

1. **SQL Editor** → **New query**.
2. Pega `supabase/inventario.sql` y pulsa **Run**.

### 2e. Activar pedidos y estadísticas

1. **SQL Editor** → **New query**.
2. Pega `supabase/pedidos.sql` y pulsa **Run** (después de los pasos 2c y 2d).
3. Luego pega `supabase/mis-pedidos.sql` y pulsa **Run** (seguimiento para clientes y guía de envío).
4. Luego pega `supabase/cupones-preventa.sql` y pulsa **Run** (límite de uso de cupones y preventa).
5. Por último pega `supabase/lista-vip.sql` y pulsa **Run** (Lista VIP con código personal de bienvenida).

## 3. Crear tu usuario de administrador

1. Ve a **Authentication** → **Users** → **Add user** → **Create new user**.
2. Escribe tu correo y una contraseña. Marca **Auto Confirm User**.
3. Pulsa **Create user**.

## 4. Cerrar el registro público

Para que nadie más pueda crearse una cuenta:

1. Ve a **Authentication** → **Sign In / Providers** (en algunas versiones está en **Authentication → Settings**).
2. Desactiva **Allow new users to sign up** y guarda.

## 5. Darte permisos de administrador

1. Vuelve a **SQL Editor** → **New query**.
2. Pega el contenido de `supabase/hacerme-admin.sql`.
3. Cambia `TU-CORREO@ejemplo.com` por el correo del paso 3.
4. Pulsa **Run**. Al final debe aparecer tu correo en una tabla.

> Para agregar otro administrador más adelante: repite los pasos 3 y 5 con su correo.

## 6. Conectar la web con Supabase

1. Ve a **Project Settings** (ícono de engranaje) → **API Keys** / **Data API**.
2. Copia:
   - **Project URL** → algo como `https://abcdxyz.supabase.co`
   - **Publishable key** (`sb_publishable_...`). Si tu proyecto muestra claves antiguas, usa la **anon public**.
3. Abre `js/config.js` y pégalas así:

```js
window.INSANITY_CONFIG = {
  supabaseUrl: 'https://abcdxyz.supabase.co',
  supabaseKey: 'sb_publishable_xxxxxxxxxxxxxxxx'
};
```

Esa clave está hecha para ir en una web pública; no es un secreto.
**Nunca** pongas en la web la *secret key* ni la *service_role key*, y nunca compartas tu contraseña.

## 7. Probar

- Abre la web con un servidor local (por ejemplo la extensión **Live Server** de VS Code) o, después de publicarla, desde GitHub Pages.
- Entra a `admin.html`, inicia sesión y cambia algo de prueba (por ejemplo un precio).
- Recarga `index.html#tienda`: el cambio debe aparecer.

## 8. Publicar

Sube los cambios a GitHub como siempre:

```
git add .
git commit -m "Panel de administración con Supabase"
git push
```

Tu panel quedará en `https://TU-SITIO/admin.html`. No aparece en ningún menú de la tienda ni en Google, pero recuerda: la seguridad no depende de que esté escondido, sino de las reglas del paso 2.

---

## Uso diario del panel

Arriba del panel hay pestañas: **Productos, Inicio, Colecciones, La Sociedad, Tienda, Comunidad y General**.

- En las pestañas de secciones, edita los textos y pulsa **Guardar cambios** (abajo). Si sales sin guardar, el panel te avisa.
- Las listas (colecciones, publicaciones, puntos, beneficios) se abren con un clic; usa ↑ ↓ para ordenarlas y ✕ para borrar.
- Desmarca **Visible en la web** para esconder una colección o publicación sin borrarla.
- El nombre de cada colección debe coincidir con la "Colección" de sus productos para que salga el botón *Ver productos*.
- En **General** cambias el número de WhatsApp que recibe los pedidos.

### Destacados, ofertas y códigos de descuento

- **Destacados en Inicio:** en *Productos*, edita un producto y marca **★ Destacado en Inicio** (se muestran hasta 12, en un carrusel que se desliza de lado). El título de la sección se cambia en *Inicio*.
- **Ofertas:** en el mismo editor, escribe el **% de descuento** y, si quieres, la fecha de fin. La tienda muestra el precio tachado, la etiqueta -X% y el filtro "En oferta". Al pasar la fecha, la oferta se apaga sola. Para quitarla, borra el porcentaje.
- **Barra de promoción:** en *Inicio*, marca "Mostrar barra de promoción", escribe el texto y (opcional) un enlace como `#tienda` o `#tienda/DARK REBIRTH`.
- **Códigos de descuento:** pestaña *Cupones* → *+ Nuevo código*. Puede ser por porcentaje o valor fijo, con compra mínima y fecha de vencimiento opcionales. Desmarca *Activo* para pausarlo. El cliente lo escribe en el carrito y el código llega en el pedido de WhatsApp.
- Los clientes no pueden ver la lista de códigos: solo validar uno que ya conocen.
- **Usos por cliente:** por defecto cada persona puede usar un código **una sola vez**. Se reconoce por su celular o su cédula, así que no sirve cambiar el nombre. Los pedidos cancelados no cuentan (si cancelas uno, el cliente recupera su cupón). Puedes poner 2, 3, 5 veces o sin límite.
- **Usos en total:** opcional, para cosas como "solo los primeros 50". Al llegar al límite, el código se marca como *Agotado*.
- Cada código muestra cuántas veces se ha usado.

### Lista VIP

- Pestaña **Lista VIP**. Todo empieza **apagado** y sin porcentaje.
- **Mostrar invitación a la Lista VIP:** al encenderla aparece en la web una ventanita (una sola vez por visitante, a los 15 segundos o al bajar media página; si la cierran no vuelve en 30 días) y un bloque fijo antes del pie de página.
- **Regalo de bienvenida:** cuando el dueño autorice, escribe el **%**, y si quieres una **compra mínima** y una **validez en días**. Cada nuevo suscriptor recibe un código único (ej. `VIP-7K3QM`) que:
  - se aplica solo en su carrito,
  - funciona **una sola vez** y **solo con el celular con el que se inscribió** (si lo comparte, a otro no le sirve),
  - si la persona se vuelve a inscribir, recibe el mismo código, no uno nuevo.
- **Sin porcentaje** o con el regalo apagado, la gente se puede inscribir pero no recibe código.
- **Cambiar el %** solo afecta a los nuevos suscriptores; los códigos ya entregados conservan su valor.
- **Pausar todos los códigos VIP ya entregados:** ninguno funciona mientras esté marcado; desmárcalo para reactivarlos.
- Lista de suscriptores con su código y estado (sin usar, usado, vencido, pausado), buscador, botón de WhatsApp y **Descargar lista** (abre en Excel) para avisar lanzamientos por tu lista de difusión.
- Si alguien pide la baja, bórralo con **Eliminar** (su código queda desactivado).
- En **Estadísticas → Códigos de descuento usados** los VIP aparecen agrupados como "Lista VIP".

### Preventa

- En el editor de un producto marca **⏳ En preventa**, elige la fecha de **cierre** y escribe la **entrega estimada** (ej. "Desde el 15 de diciembre").
- La tienda muestra un aviso morado en Inicio, el menú *Preventa*, una insignia en la tarjeta y una cuenta regresiva ("Cierra en 2 d 5 h"). El botón dice *Apartar en preventa*.
- **Unidades limitadas:** activa *Controlar inventario* en ese producto. **Precio especial:** usa *Oferta*.
- Al pasar la fecha de cierre ya no se puede pedir (la tarjeta dice *Preventa cerrada*). Cuando la prenda salga a la venta normal, desmarca *En preventa*.
- En *Pedidos* los artículos de preventa aparecen marcados con su fecha de entrega.

### Inventario

- En el editor de un producto marca **Controlar inventario** y llena la tabla de **colores × tallas** con las unidades. "Poner en todas" llena todo de una vez.
- Si no lo marcas, el producto se vende sin límite (ideal para prendas bajo pedido).
- En la tienda: las tallas en 0 salen tachadas, con 3 o menos aparece "¡Últimas unidades!" y si todo está en 0 el producto muestra "Agotado" con un botón para avisar por WhatsApp. El carrito no deja pedir más de lo que hay.
- La pestaña **Inventario** muestra el total de unidades, los productos agotados y los que hay que revisar.
- Las unidades se descuentan solas cuando marcas un pedido como confirmado, enviado o entregado, y vuelven si lo cancelas o lo eliminas. En la pestaña Inventario puedes corregirlas a mano.

### Pedidos

- Cada compra hecha en la web se guarda sola como **pendiente**, con un número (ej. #1001) que también aparece en el mensaje de WhatsApp que te llega. La pestaña muestra cuántos pendientes hay.
- Cuando el cliente pague, cambia el estado a **Confirmado** (luego Enviado → Entregado). Si no compra, márcalo **Cancelado**.
- **Ver** muestra todos los datos de envío y un botón para escribirle al cliente por WhatsApp.
- **Guía de envío:** en *Ver* escribe la transportadora y el número de guía y pulsa *Guardar*. El cliente la ve en «Mis pedidos».
- **+ Registrar venta**: para ventas por Instagram, en persona o por WhatsApp directo, así también cuentan en las estadísticas.
- Los precios de los pedidos web se calculan en el servidor (con ofertas y cupón); nadie puede alterarlos desde el navegador. Los datos de los clientes solo los ve el administrador.

### Lo que ve el cliente

- **Mis pedidos** (icono de caja arriba, o en el menú del celular): los pedidos hechos en ese dispositivo aparecen solos con su estado (Recibido → Pago confirmado → Enviado → Entregado) y la guía. Desde otro dispositivo se consultan con el número de pedido + el celular. No se muestra dirección, cédula ni nombre.
- **Favoritos** (corazón): cada cliente guarda prendas con el ♥ de las tarjetas. Se guardan en su dispositivo, sin cuenta.

### Estadísticas

- Elige el periodo: hoy, 7 días, 30 días, este mes, este año, todo, o un rango con *Desde/Hasta*.
- Verás: total vendido, número de pedidos, prendas vendidas, ticket promedio (con la variación frente al periodo anterior), pedidos por confirmar, ventas por día/semana/mes, productos más vendidos, de dónde compran (departamentos o ciudades), tallas, colores, colecciones, canal de venta y códigos de descuento usados.
- Solo cuentan los pedidos confirmados, enviados o entregados.

### Productos

- **Nuevo producto:** botón *+ Nuevo producto*. El identificador se crea solo a partir del nombre.
- **Precio vacío** = la tienda muestra *Precio por confirmar* y un botón para consultar por WhatsApp.
- **Variantes de material** (ej. Burda / Algodón perchado): cada una con su precio; el cliente elige en la tienda.
- **Fotos:** sube frente y espalda por cada color. Se comprimen solas antes de subir. Si un color no tiene foto, se muestra la del primer color con la etiqueta *Foto de referencia*.
- **Ocultar** (desmarcar *Visible*): saca el producto de la tienda sin borrarlo. Ideal para agotados.
- **Orden:** número menor = aparece primero.

## Si algo falla

- **La tienda sigue funcionando:** si Supabase no responde, la web muestra los textos originales del HTML y la lista de respaldo de `js/productos.js` (pueden estar desactualizados respecto al panel).
- **"Falta crear la tabla de contenido" en el panel:** ejecuta `supabase/contenido.sql` (paso 2b).
- **"Falta activar las promociones" en el panel:** ejecuta `supabase/promos.sql` (paso 2c).
- **"Falta activar el inventario" en el panel:** ejecuta `supabase/inventario.sql` (paso 2d).
- **"Falta activar los pedidos" en el panel:** ejecuta `supabase/pedidos.sql` (paso 2e).
- **"Falta activar la Lista VIP":** ejecuta `supabase/cupones-preventa.sql` y luego `supabase/lista-vip.sql`.
- **"Falta activar preventa y límites de cupones":** ejecuta `supabase/cupones-preventa.sql` (paso 2e, punto 4).
- **Plan gratuito:** Supabase puede pausar proyectos gratuitos que llevan un tiempo sin actividad. Si pasa, entra a supabase.com y pulsa *Restore project*.
- **"Sin permisos" al entrar al panel:** falta el paso 5 con ese correo.
- **"Correo o contraseña incorrectos":** revisa el usuario en *Authentication → Users*.
