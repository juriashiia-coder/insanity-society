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

- **Nuevo producto:** botón *+ Nuevo producto*. El identificador se crea solo a partir del nombre.
- **Precio vacío** = la tienda muestra *Precio por confirmar* y un botón para consultar por WhatsApp.
- **Variantes de material** (ej. Burda / Algodón perchado): cada una con su precio; el cliente elige en la tienda.
- **Fotos:** sube frente y espalda por cada color. Se comprimen solas antes de subir. Si un color no tiene foto, se muestra la del primer color con la etiqueta *Foto de referencia*.
- **Ocultar** (desmarcar *Visible*): saca el producto de la tienda sin borrarlo. Ideal para agotados.
- **Orden:** número menor = aparece primero.

## Si algo falla

- **La tienda sigue funcionando:** si Supabase no responde, la tienda muestra automáticamente la lista de respaldo de `js/productos.js` (puede estar desactualizada respecto al panel).
- **Plan gratuito:** Supabase puede pausar proyectos gratuitos que llevan un tiempo sin actividad. Si pasa, entra a supabase.com y pulsa *Restore project*.
- **"Sin permisos" al entrar al panel:** falta el paso 5 con ese correo.
- **"Correo o contraseña incorrectos":** revisa el usuario en *Authentication → Users*.
