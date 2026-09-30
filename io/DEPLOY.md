# Publicar IO (Cloudflare + Supabase)

Con esta guía IO queda en línea en tu dominio: cuentas reales (Google o correo), partida guardada en la nube, ranking en vivo y lista de espera.

**Necesitas:**
- GitHub, donde vive el código;
- Cloudflare, donde está tu dominio y donde se publica la página;
- Supabase, donde viven las cuentas, las partidas y el ranking.

Todo es gratis menos el dominio.

## El mapa

```
GitHub (código)  ──►  Cloudflare Pages (publica)  ──►  tudominio.com        → página de inicio
                                                        tudominio.com/app/   → el juego
                                  │
                                  ▼
                       Supabase (proyecto "IO")    → cuentas, partidas, ranking, lista de espera
                                  ▲
                       Google Cloud (botón "Continuar con Google")
```

| En el repositorio | Qué es |
|---|---|
| `io/index.html` | La página de inicio |
| `io/app/` | El juego |
| `io/app/config.js` | Donde se conectan las llaves de Supabase (el único archivo que se edita) |
| `io/supabase/schema.sql` | Las tablas de la base de datos |

---

## Paso 0. Fusionar el código (2 min)

Abre el pull request <https://github.com/Andresfcarreno/aistaff-website/pull/2> y toca **Merge pull request → Confirm merge**. Así el código nuevo queda en `main`, que es lo que Cloudflare va a publicar.

## Paso 1. Supabase: crear el proyecto de IO (10 min)

Usa un proyecto **nuevo** solo para IO. No uses el de MEETAISTAFF BUSINESS: los jugadores y sus reglas de inicio de sesión quedan separados de tu negocio.

1. Entra a <https://supabase.com/dashboard> y toca **New project**:
   - **Organization:** `Andres business`
   - **Name:** `IO`
   - **Database password:** toca *Generate* y guárdala en un lugar seguro.
   - **Region:** `East US (Ohio)` o `South America (São Paulo)`.
   - **Plan:** Free.
2. Espera unos 2 minutos a que termine de crearse.
3. Ve a **SQL Editor → New query**, pega todo el contenido de `io/supabase/schema.sql` y toca **Run**. Debe decir *Success*.

## Paso 2. Inicio de sesión con correo (5 min)

1. En Supabase, ve a **Authentication → Sign In / Providers → Email** y deja activado *Enable Email provider*.
2. Ve a **Authentication → Emails → Templates**. En **Magic Link** y en **Confirm signup**, cambia:
   - el asunto por `Tu código de IO: {{ .Token }}`;
   - el cuerpo por:
     ```html
     <h2>Tu código para entrar a IO</h2>
     <p style="font-size:32px;letter-spacing:6px"><b>{{ .Token }}</b></p>
     <p>Escríbelo en IO. Vence en una hora.</p>
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
   - **Authorized JavaScript origins:** `https://tudominio.com`
   - **Authorized redirect URIs:** la *Callback URL* que ves en Supabase → Authentication → Sign In / Providers → **Google**. Se parece a `https://XXXX.supabase.co/auth/v1/callback`.
4. Copia el **Client ID** y el **Client Secret**.
5. Vuelve a Supabase → **Google**: actívalo, pega los dos datos y toca **Save**.

## Paso 4. Decirle a Supabase cuál es tu dominio (2 min)

En Supabase → **Authentication → URL Configuration**:

- **Site URL:** `https://tudominio.com/app/`
- **Redirect URLs:** agrega `https://tudominio.com/app/` y `https://tudominio.com/app/**`

## Paso 5. Conectar el juego con Supabase (3 min)

1. En Supabase → **Project Settings → API**, copia:
   - la **Project URL**;
   - la **anon public** key. Nunca uses la que dice `service_role` ni `secret`.
2. En GitHub, abre `io/app/config.js` en la rama `main`, toca el lápiz ✏️ y deja la línea así:
   ```js
   export const RANKING = { url: 'https://XXXX.supabase.co', key: 'eyJhbGciOi...' };
   ```
3. Toca **Commit changes**.

Esa llave es pública a propósito: las reglas de `schema.sql` solo dejan que cada jugador escriba lo suyo.

## Paso 6. Cloudflare Pages: publicar (10 min)

1. Entra a Cloudflare → **Workers & Pages → Create → Pages → Connect to Git**.
2. Autoriza GitHub y elige `aistaff-website`.
3. Configura así:

   | Campo | Valor |
   |---|---|
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | *(vacío)* |
   | Build output directory | `io` |

4. Toca **Save and Deploy**. En un minuto te da una dirección como `io-xxx.pages.dev`. Ábrela: ya funciona.
5. En el proyecto de Pages, ve a **Custom domains → Set up a custom domain** y escribe tu dominio. Como el dominio ya está en Cloudflare, se conecta solo, con HTTPS incluido. Repite con `www.tudominio.com` si lo quieres.

Desde ahora, cada cambio que entre a `main` en GitHub se publica solo.

## Paso 7. Probar y ser el jugador #1 (10 min)

1. Abre `https://tudominio.com`. Deberías ver la intro del Game Boy, la torre 3D y un ranking que dice “La cima está libre”.
2. Pasa tus puntos de ahora:
   1. Abre la vista previa donde has jugado. Ve a ⚙️ **Ajustes → Pasar tu partida → 📋 Copiar el código de mi partida**, y guárdalo en tus notas.
   2. Abre `https://tudominio.com/app/` y toca **🔑 Tengo un código de partida**.
   3. Pega el código y toca **Cargar mi partida**.
   4. Entra con **Google**.
3. Vuelve a `https://tudominio.com`: apareces **#1** en el ranking.
4. Desde otro celular, entra con tu misma cuenta. Tu partida baja sola.

## Dónde ver las cosas después

| Quiero ver… | Dónde |
|---|---|
| Quién se registró | Supabase → Authentication → Users |
| La lista de espera (“Avísame”) | Supabase → Table Editor → `io_waitlist`; la columna `ref` dice de qué red vino |
| El ranking | Supabase → Table Editor → `io_ranking` |
| Visitas a la página | Cloudflare → tu proyecto de Pages → Web Analytics (actívalo, es gratis) |

## Para compartir

- **Enlace principal:** `https://tudominio.com`
- **Por red social:** `https://tudominio.com/?ref=instagram`, `?ref=tiktok`, `?ref=whatsapp`…
- **Tarjeta para historias:** dentro del juego, **Mundo → 📸 Tarjeta para mis historias**.

## Antes de invitar a mucha gente

- **Correos:** el correo gratis de Supabase envía pocos por hora. Conecta un SMTP en **Authentication → Emails → SMTP Settings**. Puedes usar Resend (gratis hasta 3.000 al mes) verificando tu dominio; en Cloudflare solo tienes que pegar sus registros DNS.
- **Llaves del bot viejo:** si todavía existen el token de Telegram y la llave de Anthropic del bot anterior, regenéralos.

---

### Alternativa: Netlify en vez de Cloudflare Pages

`io/netlify.toml` sigue incluido. Si usas Netlify, crea un sitio desde GitHub con Base directory y Publish directory en `io`, y apunta el dominio desde Cloudflare DNS con un `CNAME` a `tusitio.netlify.app`.
