# IO — tu vida en un espejo

IO es un diario personal con finanzas: una app web instalable (PWA) que funciona en Android, iPhone y PC. Tu avatar estilo Sims refleja cómo vas en los cuatro pilares:

| Pilar | Qué mide | De dónde salen los datos |
|---|---|---|
| 💰 **Finanzas** | balance del mes, presupuesto variable, pagos fijos | Telegram, la app, CSV del banco, alertas del correo, Google Sheet histórico |
| 💪 **Salud** | sueño, agua, ejercicio, pasos, ánimo | botones rápidos, “dormí 7h”, Telegram |
| 💬 **Social** | cuánto hace que no hablas con cada persona vs. cada cuánto quieres | “llamé a mamá”, botón 💬 |
| 🧠 **Mente** | diario y ánimo de la semana | diario, dictado por voz |

**Es una sola pantalla que se scrollea**, en este orden: avatar y necesidades → Hoy/Semana/Mes → transacciones (lista infinita) → calendario (toca un día) → gastos programados → metas → salud → relaciones → diario → categorías → conexiones.

## Qué hay de nuevo respecto a v4

- **Captura universal** (botón verde **+ Registrar** o 🎙️): texto libre, **dictado por voz**, **foto de recibo**, **pantallazo del banco**, **PDF** o **alerta del correo pegada**. Claude separa todo lo que dijiste: “fui al gym 40 min y gasté 12 en un batido” = salud + gasto. Antes de guardar puedes revisar y editar cada registro.
- **Funciona sin IA y sin conexión**: si no hay key de Claude, un parser local entiende lo básico (“gasté 25 en Walmart”, “dormí 7 horas”). Lo que registras queda en el dispositivo y se sube a Supabase cuando hay red. Ya no se pierde nada si la red falla.
- **Avatar vivo**: 5 estados de ánimo (se agregó *cansado* si dormiste menos de 5h), barras de necesidades tipo Sims, nivel y XP, racha 🔥, la ventana cambia con la hora, la planta se marchita si descuidas la salud y aparece un trofeo cuando cumples una meta. Puedes personalizar la piel, el pelo y el hoodie. **La lógica de “preocupado” sigue siendo generosa**: solo con balance negativo o presupuesto variable por encima de 115%.
- **Metas** con anillos de progreso, **gastos fijos** con “✓ Pagado” (no cuentan contra el presupuesto variable), barra de presupuesto con marcador del ritmo ideal y proyección a fin de mes.
- **Importador de CSV bancario** con las reglas de integridad: las transferencias entre tus cuentas (NBC ↔ Wealthsimple, mismo monto) se omiten, los otros INTERAC (p. ej. a Diana) sí cuentan, la pensión nunca se registra aparte y se omite lo que ya estaba registrado.
- **Chat con IO** 🔮 con streaming y con contexto de toda tu vida (finanzas, salud, relaciones, metas, diario). Trae preguntas rápidas: “¿Cómo voy este mes?”, “Plan para ahorrar $300”…
- **App instalable**: ícono, pantalla completa, funciona sin conexión y en Android aparece en el menú **Compartir** (compartes el pantallazo del banco y va directo a IO).
- **Telegram sin Make.com**: una Edge Function de Supabase recibe el webhook, lee texto, **fotos y PDFs**, y guarda directo. Se acabaron el bug de `{{3.data.content[1].text}}` y los límites de operaciones de Make.
- **Seguridad**: la key de Supabase ya no está en el código. Se configura en ⚙️ Ajustes y se guarda solo en tu dispositivo. La key de Anthropic sigue viviendo solo en `sessionStorage` (`io_k`).

## Estructura

```
io/
├── index.html            # la pantalla
├── styles.css            # sistema de diseño (paleta y tipografías de v4)
├── app.js                # render, pilares, captura, chat, calendario…
├── store.js              # datos local-first + Supabase + Sheet + demo
├── ai.js                 # Claude (SDK oficial) + parser local de respaldo
├── importer.js           # CSV del banco con reglas de integridad
├── sw.js                 # offline + share target
├── manifest.webmanifest  # app instalable
├── icons/
└── supabase/
    ├── schema.sql        # transactions + io_items + telegram_links
    └── functions/
        ├── _shared/brain.ts   # parseo con Claude + guardado (compartido)
        ├── telegram/          # webhook del bot (texto, fotos, PDFs, /hoy /mes /salud)
        ├── ingest/            # alertas del correo, atajos de iPhone, etc.
        └── fijos/             # gastos fijos automáticos (cron diario)
```

La app no necesita build. Se sirve tal cual desde `/io/` en el mismo sitio de Netlify (`meetaistaff.com/io/`), con `noindex` y sin enlaces desde la landing.

## Puesta en marcha (en orden)

### 0. Seguridad primero (pendiente del handoff)
1. **Regenera el token del bot**: en Telegram, con @BotFather → `/revoke`.
2. **Regenera la API key de Anthropic** en console.anthropic.com y revoca la anterior.
3. **No publiques la URL y la anon key de Supabase juntas** mientras las políticas estén abiertas: con ambas, cualquiera puede leer tus movimientos. La app ya no las trae en el código.

### 1. Supabase
1. Abre SQL Editor, pega [`supabase/schema.sql`](supabase/schema.sql) y dale Run. Crea `io_items` y agrega la política de borrar. Si `transactions` ya existe, la deja como está.
2. En la app: ⚙️ → **Project URL** + **anon key** → *Probar conexión* → *Guardar*. El punto del encabezado debe decir **en vivo**.
3. Opcional: pega el CSV publicado del Google Sheet para ver también el histórico anterior a Supabase.

### 2. Telegram con Supabase (reemplaza Make)
```bash
npm i -g supabase            # o brew install supabase/tap/supabase
supabase login
supabase link --project-ref itiqtoymktqxxmvckmyz
supabase secrets set ANTHROPIC_API_KEY=sk-ant-NUEVA \
  TELEGRAM_BOT_TOKEN=NUEVO_TOKEN \
  TELEGRAM_WEBHOOK_SECRET=$(openssl rand -hex 24) \
  INGEST_SECRET=$(openssl rand -hex 24)
supabase functions deploy telegram --no-verify-jwt
supabase functions deploy ingest   --no-verify-jwt
supabase functions deploy fijos    --no-verify-jwt

# Conectar el webhook (usa el mismo TELEGRAM_WEBHOOK_SECRET)
curl "https://api.telegram.org/botNUEVO_TOKEN/setWebhook" \
  -d url=https://itiqtoymktqxxmvckmyz.supabase.co/functions/v1/telegram \
  -d secret_token=EL_SECRET
```
4. Escríbele cualquier cosa al bot. Te va a responder con tu `chat_id`. Guárdalo con `supabase secrets set TELEGRAM_ALLOWED_CHAT_IDS=123456789`. Mientras no esté configurado, el bot no guarda nada.
5. **Apaga el escenario de Make** para que no se registre todo doble.
6. En la app: ⚙️ → *Usuario del bot*, para tener el botón “Abrir en Telegram”.

Opcionales: `IO_MODEL` (por defecto `claude-opus-5`), `IO_NAME`, `IO_TZ` (por defecto `America/Toronto`).

### 3. Alertas del correo (automático, gratis)
Crea un proyecto en [script.google.com](https://script.google.com) con tu Gmail y pega esto:

```js
const URL = 'https://itiqtoymktqxxmvckmyz.supabase.co/functions/v1/ingest';
const SECRET = 'TU_INGEST_SECRET';
// Ajusta la búsqueda al remitente de las alertas de tu banco:
const QUERY = 'from:(alertes@bnc.ca OR notifications@wealthsimple.com) newer_than:2d -label:io-procesado';

function revisarAlertas() {
  const label = GmailApp.getUserLabelByName('io-procesado') || GmailApp.createLabel('io-procesado');
  for (const thread of GmailApp.search(QUERY, 0, 20)) {
    for (const msg of thread.getMessages()) {
      const text = `Asunto: ${msg.getSubject()}\nFecha: ${msg.getDate()}\n\n${msg.getPlainBody()}`.slice(0, 8000);
      UrlFetchApp.fetch(URL, { method: 'post', contentType: 'application/json',
        headers: { 'x-io-secret': SECRET }, payload: JSON.stringify({ text, source: 'correo' }) });
    }
    thread.addLabel(label);
  }
}
```
Después, en Activadores (⏰), agrega `revisarAlertas` → *Basado en tiempo* → cada 10 minutos.

### 4. Gastos fijos automáticos (opcional)
Los fijos (renta, YMCA, Fizz, seguro…) se editan en la app: *Gastos programados → Editar fijos*. Hay dos formas de usarlos:
- **Manual**: aparecen como pendientes y los marcas con “✓ Pagado”.
- **Automático**: programa la función `fijos` con el bloque `cron.schedule` del final de `schema.sql`. Cada día inserta los fijos que vencen y todavía no aparecen pagados. Esto reemplaza el intento con Feeder+Iterator en Make, que no funcionó.

### 5. Instalar en el celular
- **Android (Chrome)**: abre `https://meetaistaff.com/io/` → menú ⋮ → **Instalar app**.
- **iPhone (Safari)**: Compartir ⬆️ → **Agregar a pantalla de inicio**.

## Reglas de producto que se mantienen
- Una sola pantalla vertical, nunca carrusel de pantallas.
- Orden: avatar → chips → transacciones (infinita) → calendario (bottom sheet por día) → programados → lo demás.
- El avatar no vive ansioso: *preocupado* solo con balance negativo o presupuesto variable >115%.
- La key de Anthropic nunca va al código: solo `sessionStorage['io_k']`.
- La pensión nunca se registra aparte. Las transferencias NBC ↔ Wealthsimple del mismo monto son internas.

## Siguientes pasos sugeridos
1. **Google Auth + políticas RLS por usuario** (el SQL de migración está en `schema.sql`) → multiusuario (Diana, Juan) usando `telegram_links`.
2. Notas de voz en Telegram (transcribir y luego pasarlas a `parse`).
3. Integración con Apple Health / Google Fit (pasos y sueño automáticos) mediante Atajos de iPhone → `ingest`.
4. Notificaciones push (recordatorio del diario por la noche y alertas de pagos fijos).
