# Lanzar IO con dominio propio

Esta guía deja IO en línea, en tu dominio, con cuentas reales (Google o correo), la partida en la nube y el ranking en vivo.

**Tiempo total:** unas 2 horas la primera vez.
**Costo:** solo el dominio (unos USD 10–15 al año). Netlify y Supabase tienen planes gratis que alcanzan para empezar.

## Cómo queda

| Dirección | Qué es |
|---|---|
| `https://tudominio.com/` | La página de inicio: 3D, tráiler, cómo se juega, ranking real, instalación, lista de espera |
| `https://tudominio.com/app/` | El juego (PWA instalable) |

Las dos viven en la carpeta `io/` de este repositorio: `io/index.html` es la página y `io/app/` es el juego.

---

## 1. Compra el dominio (10 min)

1. Busca un nombre corto. Ideas: `iojuego.com`, `juegaio.com`, `io.gg`, `tuvidaeseljuego.com`, `ioplay.app`.
2. Cómpralo en uno de estos:
   - **Cloudflare Registrar:** precio de costo, sin recargos.
   - **Namecheap** o **Porkbun:** fáciles y baratos.
   - **Netlify:** Domains → *Register a domain*. Queda conectado solo, así que te ahorras el paso 3.4.

Si prefieres no comprar nada todavía, puedes lanzar en `https://meetaistaff.com/io/` (ver el paso 3, opción B).

## 2. Supabase: cuentas, partidas y ranking (40 min)

### 2.1 Crea el proyecto

1. Entra a <https://supabase.com> y crea una cuenta.
2. Haz clic en **New project**:
   - **Name:** `io`
   - **Region:** la más cercana a tus jugadores; para Latinoamérica, `South America (São Paulo)`.
   - **Database password:** una contraseña fuerte. Guárdala.
3. Espera a que termine de crearse (unos 2 minutos).

### 2.2 Crea las tablas

1. Ve a **SQL Editor** → **New query**.
2. Pega el contenido completo de `io/supabase/schema.sql` y haz clic en **Run**.
3. Debe salir `Success`. Esto crea:

   | Tabla | Para qué |
   |---|---|
   | `io_saves` | La partida de cada jugador. Solo la ve su dueño |
   | `io_ranking` | Todos la leen; cada quien solo escribe su fila |
   | `io_likes` | Likes |
   | `io_rooms` | Salas |

   Las cuentas anónimas no pueden escribir en ninguna.

### 2.3 Inicio de sesión con correo (código de 6 números)

1. Ve a **Authentication → Sign In / Providers → Email**:
   - **Enable Email provider:** activado.
   - **Confirm email:** activado.
2. Ve a **Authentication → Emails → Templates → Magic Link** y cambia el cuerpo por:

   ```html
   <h2>Tu código para entrar a IO</h2>
   <p style="font-size:32px;letter-spacing:6px"><b>{{ .Token }}</b></p>
   <p>Escríbelo en IO. Vence en una hora.</p>
   ```

   **Asunto:** `Tu código de IO: {{ .Token }}`

3. Haz lo mismo en la plantilla **Confirm signup**. La primera vez que alguien entra, Supabase usa esa.
4. **Correos a escala:** Supabase gratis solo envía unos pocos correos por hora, lo que sirve para probar. Antes de invitar a mucha gente, conecta un SMTP en **Authentication → Emails → SMTP Settings**:
   - **Resend** (gratis hasta 3.000 correos al mes) o **Brevo**.
   - Necesitas verificar tu dominio en ese servicio.

### 2.4 Inicio de sesión con Google

1. Entra a <https://console.cloud.google.com> y crea un proyecto llamado `IO`.
2. Ve a **APIs & Services → OAuth consent screen**:
   - **User type:** External.
   - **App name:** `IO`, con tu correo de soporte.
   - **Authorized domains:** tu dominio y `supabase.co`.
   - Guarda. Luego haz clic en **Publish app** para que cualquiera pueda entrar, no solo usuarios de prueba.
3. Ve a **APIs & Services → Credentials → Create credentials → OAuth client ID**:
   - **Application type:** Web application.
   - **Authorized JavaScript origins:** `https://tudominio.com`
   - **Authorized redirect URIs:** `https://TU-PROYECTO.supabase.co/auth/v1/callback`
     (la encuentras en Supabase → Authentication → Sign In / Providers → Google → *Callback URL*).
4. Copia el **Client ID** y el **Client Secret**.
5. En Supabase → **Authentication → Sign In / Providers → Google**:
   - Activa el proveedor.
   - Pega el Client ID y el Client Secret.
   - Guarda.

### 2.5 A dónde vuelve la gente después de entrar

En Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://tudominio.com/app/`
- **Redirect URLs** (agrega estas tres):
  - `https://tudominio.com/app/`
  - `https://tudominio.com/app/**`
  - `http://localhost:8765/io/app/` (solo para probar en tu computador)

### 2.6 Conecta el juego

1. En Supabase → **Project Settings → API**, copia:
   - la **Project URL**;
   - la **anon public key** (nunca la `service_role`).
2. Pégalas en `io/app/config.js`:

   ```js
   export const RANKING = { url: 'https://TU-PROYECTO.supabase.co', key: 'eyJhbGciOi...' };
   ```

La anon key es pública por diseño. La seguridad la ponen las reglas de `schema.sql`, que solo dejan escribir a cuentas reales y solo lo suyo. Con eso quedan activas:

- la cuenta obligatoria al crear tu jugador;
- la partida en la nube;
- el ranking del juego;
- el ranking en vivo de la página de inicio.

## 3. Netlify: publica la página y el juego (20 min)

### Opción A (recomendada): sitio propio con tu dominio

1. Entra a <https://app.netlify.com>, haz clic en **Add new site → Import an existing project** y elige GitHub.
2. Elige el repositorio `andresfcarreno/aistaff-website` con estos valores:

   | Campo | Valor |
   |---|---|
   | Branch to deploy | `main` (después de fusionar esta rama) |
   | Base directory | `io` |
   | Build command | (vacío) |
   | Publish directory | `io` |

3. Haz clic en **Deploy**. `io/netlify.toml` ya trae los encabezados y la redirección de `/lanzamiento`.
4. Conecta el dominio en **Domain management → Add a domain** y escribe `tudominio.com`:
   - **Si lo compraste en Netlify:** listo.
   - **Si lo compraste en otro lado:** en tu registrador, cambia los *nameservers* por los 4 que te da Netlify. Si prefieres tocar solo DNS:
     - un registro `A` de `@` a `75.2.60.5`;
     - un `CNAME` de `www` a `TU-SITIO.netlify.app`.
   - Espera de 10 minutos a unas horas.
5. En **Domain management → HTTPS**, haz clic en **Verify DNS / Provision certificate**. El juego necesita HTTPS para instalarse, usar notificaciones y entrar con Google.
6. Activa los formularios en **Forms → Enable form detection** y vuelve a desplegar. La lista de espera de la página (`lista-espera`) aparece en **Forms**. Para recibir un correo con cada inscripción: **Forms → Form notifications**.

Desde ahí, cada vez que se fusiona algo a `main`, Netlify publica solo.

### Opción B: dentro de meetaistaff.com

Si sigues publicando `meetaistaff.com` con la carpeta del repositorio, la página queda en `/io/` y el juego en `/io/app/`. En ese caso:

- en Supabase (paso 2.5) usa `https://meetaistaff.com/io/app/`;
- en Google (paso 2.4) usa el origen `https://meetaistaff.com`.

## 4. Pruébalo antes de invitar gente (15 min)

1. Abre `https://tudominio.com`: se ve la intro del Game Boy, luego la torre 3D, y el ranking dice “La cima está libre”.
2. Toca **PRESS START** y crea tu jugador. En el paso de la cuenta, entra con Google.
3. Haz un hábito de 1 minuto (por ejemplo, “Respirar”) y reclama la corona.
4. Vuelve a la página de inicio: ya apareces **#1** en el ranking en vivo.
5. En otro celular, entra con la misma cuenta: tu partida baja sola.
6. Prueba también entrar con correo. El código llega en menos de un minuto; revisa spam.

## 5. Pasa tus puntos actuales a la versión real

Tu progreso de ahora vive en el navegador donde jugaste (la vista previa en claude.ai o tu celular).

1. Abre esa versión, ve a **⚙️ Ajustes → Pasar tu partida** y toca **📋 Copiar el código de mi partida**. Guárdalo en tus notas o envíatelo por WhatsApp.
2. Abre `https://tudominio.com/app/` y, en la bienvenida, toca **🔑 Tengo un código de partida**.
3. Pega el código y toca **⬇️ Cargar mi partida**. Vuelven tu nivel, bits, racha, cuarto, mascota y hábitos.
4. IO te pide entrar con tu cuenta. Entra con Google: la partida sube a la nube y apareces en el ranking con tu nombre como jugador #1.

Si ya estabas dentro del juego real, también puedes pegarlo en **⚙️ Ajustes → Cargar partida desde el código**.

## 6. Compártelo

- **El enlace que compartes siempre es la página de inicio:** `https://tudominio.com`. Explica todo y lleva al juego con PRESS START.
- **Enlace directo al juego:** `https://tudominio.com/app/`.
- **Lista de espera con referidos:** `https://tudominio.com/?ref=instagram` (o `?ref=tiktok`, `?ref=amigo-juan`). El `ref` queda guardado con cada inscripción en Netlify Forms, así sabes qué red te trae más gente.
- **Tarjeta para historias:** dentro del juego, **Mundo → 📸 Tarjeta para mis historias**. Genera una imagen 1080×1920 lista para Instagram o TikTok.

## 7. Lista final antes de anunciar

- [ ] Dominio con HTTPS (candado).
- [ ] `schema.sql` corrido y `config.js` con la URL y la anon key.
- [ ] Google publicado (no en modo prueba) y SMTP propio para los correos.
- [ ] Probado en Android (Chrome) y iPhone (Safari → Agregar a inicio).
- [ ] Tu partida cargada y tú como #1 en el ranking.
- [ ] Form notifications activadas en Netlify.

## Seguridad

- Nunca pongas la `service_role` key en el código. Solo va la `anon public key`.
- El XP se calcula en el celular. Para un ranking a prueba de trampas, el siguiente paso es validar cada sesión del reloj en el servidor con una Edge Function de Supabase.
- Los tokens de Telegram y la llave de Anthropic de la versión anterior (el bot) estaban expuestos. Si aún existen, regenéralos.
