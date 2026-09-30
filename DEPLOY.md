# Publicar IO (Cloudflare + Supabase)

Con esta guía IO queda en línea en tu dominio: cuentas reales (Google o correo), partida guardada en la nube, ranking en vivo y lista de espera.

**Necesitas:**
- GitHub, donde vive el código;
- Cloudflare, donde está tu dominio y donde se publica la página;
- Supabase, donde viven las cuentas, las partidas y el ranking.

Todo es gratis menos el dominio.

> **Tu dominio:** `iogamelife.com` (comprado en IONOS). **Tu proyecto Supabase:** `yoadlzogdoqtkjyiyocp` (ya creado, con las tablas y la llave conectada en `app/config.js`).

## El mapa

```
GitHub (código)  ──►  Cloudflare Pages (publica)  ──►  iogamelife.com        → página de inicio
                                                        iogamelife.com/app/   → el juego
                                  │
                                  ▼
                       Supabase (proyecto "IO")    → cuentas, partidas, ranking, lista de espera
                                  ▲
                       Google Cloud (botón "Continuar con Google")
```

| En el repositorio | Qué es |
|---|---|
| `index.html` | La página de inicio |
| `app/` | El juego |
| `app/config.js` | Donde se conectan las llaves de Supabase (el único archivo que se edita) |
| `supabase/schema.sql` | Las tablas de la base de datos |

---

## Paso 0. El código

Este repositorio (`IO-GAME`) contiene solo IO, separado del sitio de Meet AI Staff. El código ya está en la rama `main`, que es la que Cloudflare va a publicar. No hay nada que fusionar.

## Paso 1. Supabase: crear el proyecto de IO (10 min)

Usa un proyecto **nuevo** solo para IO. No uses el de MEETAISTAFF BUSINESS: los jugadores y sus reglas de inicio de sesión quedan separados de tu negocio.

1. Entra a <https://supabase.com/dashboard> y toca **New project**:
   - **Organization:** `Andres business`
   - **Name:** `IO`
   - **Database password:** toca *Generate* y guárdala en un lugar seguro.
   - **Region:** `East US (Ohio)` o `South America (São Paulo)`.
   - **Plan:** Free.
2. Espera unos 2 minutos a que termine de crearse.
3. Ve a **SQL Editor → New query**, pega todo el contenido de `supabase/schema.sql` y toca **Run**. Debe decir *Success*.

## Paso 2. Inicio de sesión con correo (5 min)

1. En Supabase, ve a **Authentication → Sign In / Providers → Email** y deja activado *Enable Email provider*.
2. Ve a **Authentication → Emails → Templates**. En **Magic Link** y en **Confirm signup**, cambia el asunto y el cuerpo. El correo va en los dos idiomas porque IO es bilingüe.
   - **Asunto:** `IO: {{ .Token }} es tu código / is your code`
   - **Cuerpo:**
     ```html
     <h2>IO</h2>
     <p style="font-size:32px;letter-spacing:6px"><b>{{ .Token }}</b></p>
     <p>Escribe este código en IO para entrar. Vence en una hora.</p>
     <p>Enter this code in IO to sign in. It expires in one hour.</p>
     ```

## Paso 3. Inicio de sesión con Google (15 min)

1. Entra a <https://console.cloud.google.com> y crea un proyecto: selector de arriba → **New project** → nombre `IO`.
2. Ve a **APIs & Services → OAuth consent screen** (o *Google Auth Platform*):
   - Tipo **External**.
   - App name `IO`, con tu correo.
   - En *Authorized domains*, agrega tu dominio y `supabase.co`.
   - Guarda. Después toca **Publish app**; si no, solo tú podrías entrar.
3. Ve a **Credentials → Create credentials → OAuth client ID**:
   - **Type:** Web application.
   - **Authorized JavaScript origins:** `https://iogamelife.com`
   - **Authorized redirect URIs:** la *Callback URL* que ves en Supabase → Authentication → Sign In / Providers → **Google**. Se parece a `https://yoadlzogdoqtkjyiyocp.supabase.co/auth/v1/callback`.
4. Copia el **Client ID** y el **Client Secret**.
5. Vuelve a Supabase → **Google**: actívalo, pega los dos datos y toca **Save**.

## Paso 4. Decirle a Supabase cuál es tu dominio (2 min)

En Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://iogamelife.com/app/`
- **Redirect URLs:** agrega `https://iogamelife.com/app/` y `https://iogamelife.com/app/**`

## Paso 5. Conectar el juego con Supabase (3 min)

1. En Supabase → **Project Settings → API**, copia:
   - la **Project URL**;
   - la **anon public** key. Nunca uses la que dice `service_role` ni `secret`.
2. En GitHub, abre `app/config.js` en la rama `main`, toca el lápiz ✏️ y deja la línea así:
   ```js
   export const RANKING = { url: 'https://yoadlzogdoqtkjyiyocp.supabase.co', key: 'eyJhbGciOi...' };
   ```
3. Toca **Commit changes**.

Esa llave es pública a propósito: las reglas de `schema.sql` solo dejan que cada jugador escriba lo suyo.

## Paso 5b. Pasar el dominio de IONOS a Cloudflare (10 min)

El dominio está en IONOS, pero la página se publica en Cloudflare. Lo más simple es que Cloudflare maneje el DNS:

1. En Cloudflare toca **Add a domain**, escribe `iogamelife.com`, elige el plan **Free** y continúa. Cloudflare te muestra **dos servidores de nombres** (nameservers), algo como `xxx.ns.cloudflare.com`.
2. En IONOS, entra a **Dominios y SSL**, elige `iogamelife.com` y abre **DNS → Servidores de nombres**. Escoge **usar servidores de nombres propios** y pega los dos de Cloudflare.
3. Espera entre 10 minutos y unas horas. Cloudflare te avisa cuando quedó **Active**.

## Paso 6. Cloudflare Pages: publicar (10 min)

1. Entra a Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Autoriza GitHub y elige `IO-GAME`.
3. Configura así:

   | Campo | Valor |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | *(vacío)* |
   | Build output directory | *(vacío)* |

4. Toca **Save and Deploy**. En un minuto te da una dirección como `io-xxx.pages.dev`. Ábrela: ya funciona.
5. En el proyecto de Pages, ve a **Custom domains → Set up a custom domain** y escribe tu dominio. Como el dominio ya está en Cloudflare, se conecta solo, con HTTPS incluido. Repite con `www.iogamelife.com` si lo quieres.

Desde ahora, cada cambio que entre a `main` en GitHub se publica solo.

## Paso 7. Probar y ser el jugador #1 (10 min)

1. Abre `https://iogamelife.com`. Deberías ver la intro del Game Boy, la torre 3D y un ranking que dice “La cima está libre”.
2. Pasa tus puntos de ahora:
   1. Abre la vista previa donde has jugado. Ve a ⚙️ **Ajustes → Pasar tu partida → 📋 Copiar el código de mi partida**, y guárdalo en tus notas.
   2. Abre `https://iogamelife.com/app/` y toca **🔑 Tengo un código de partida**.
   3. Pega el código y toca **Cargar mi partida**.
   4. Entra con **Google**.
3. Vuelve a `https://iogamelife.com`: apareces **#1** en el ranking.
4. Desde otro celular, entra con tu misma cuenta. Tu partida baja sola.

## Idiomas

IO está en español y en inglés:
- **Automático:** abre en el idioma del celular o del computador. Si no está en español, abre en inglés.
- **Manual:** botón **ES / EN** arriba en la página de inicio, **🌐 English / Español** en la bienvenida del juego y **⚙️ Ajustes → Idioma**. La elección se recuerda y aplica a la página y al juego.
- **Enlaces directos:** `https://iogamelife.com/?lang=en` abre en inglés (útil para compartir en redes en inglés) y `?lang=es` en español.

## Dónde ver las cosas después

| Quiero ver… | Dónde |
|---|---|
| Quién se registró | Supabase → Authentication → Users |
| La lista de espera (“Avísame”) | Supabase → Table Editor → `io_waitlist`; la columna `ref` dice de qué red vino |
| El ranking | Supabase → Table Editor → `io_ranking` |
| Visitas a la página | Cloudflare → tu proyecto de Pages → Web Analytics (actívalo, es gratis) |

## Para compartir

- **Enlace principal:** `https://iogamelife.com`
- **Por red social:** `https://iogamelife.com/?ref=instagram`, `?ref=tiktok`, `?ref=whatsapp`…
- **Tarjeta para historias:** dentro del juego, **Mundo → 📸 Tarjeta para mis historias**.

## Antes de invitar a mucha gente

- **Correos:** el correo gratis de Supabase envía pocos por hora. Conecta un SMTP en **Authentication → Emails → SMTP Settings**. Puedes usar Resend (gratis hasta 3.000 al mes) verificando tu dominio; en Cloudflare solo tienes que pegar sus registros DNS.
- **Llaves del bot viejo:** si todavía existen el token de Telegram y la llave de Anthropic del bot anterior, regenéralos.

---

### Alternativa: Netlify en vez de Cloudflare Pages

`netlify.toml` sigue incluido. Si usas Netlify, crea un sitio desde GitHub sin Base directory (Publish directory queda en `.`), y apunta el dominio desde Cloudflare DNS con un `CNAME` a `tusitio.netlify.app`.
