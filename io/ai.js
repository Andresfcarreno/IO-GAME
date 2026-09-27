/* IO — inteligencia: parseo universal (texto, voz, foto, PDF, alertas del banco) y chat.
 * Usa el SDK oficial de Anthropic cargado bajo demanda. La key vive solo en sessionStorage. */
import { cfg, getKey, todayIso } from './store.js';

const SDK_URL = 'https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.128.0/+esm';
let _client = null, _clientKey = '';

async function client() {
  const key = getKey();
  if (!key) throw new Error('NO_KEY');
  if (_client && _clientKey === key) return _client;
  const { default: Anthropic } = await import(SDK_URL);
  _client = new Anthropic({ apiKey: key, dangerouslyAllowBrowser: true });
  _clientKey = key;
  return _client;
}

const isOpusLike = m => /opus|fable/.test(m);
function baseParams(effort) {
  const model = cfg.model || 'claude-opus-5';
  const p = { model };
  if (isOpusLike(model)) {
    // Si el clasificador de seguridad declina, el servidor reintenta con el modelo recomendado.
    p.betas = ['server-side-fallback-2026-07-01'];
    p.fallbacks = 'default';
    if (effort) p.output_config = { effort };
  } else if (/sonnet-5/.test(model) && effort) {
    p.output_config = { effort };
  }
  return p;
}

export const CATS = ['comida', 'supermercado', 'gasolina', 'transporte', 'salud', 'entretenimiento', 'suscripcion', 'vivienda', 'educacion', 'ropa', 'regalos', 'negocio', 'ingreso', 'otros'];

const ITEM_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kind', 'descripcion', 'monto', 'categoria', 'emoji', 'fecha', 'hora', 'sueno_horas', 'agua_vasos', 'ejercicio_min', 'pasos', 'animo', 'persona', 'texto', 'meta'],
  properties: {
    kind: { type: 'string', enum: ['gasto', 'ingreso', 'salud', 'diario', 'relacion', 'meta'] },
    descripcion: { type: 'string', description: 'Nombre corto del comercio, fuente o evento' },
    monto: { type: ['number', 'null'] },
    categoria: { type: 'string', enum: CATS },
    emoji: { type: 'string' },
    fecha: { type: ['string', 'null'], description: 'YYYY-MM-DD si se menciona o aparece en el recibo; null = hoy' },
    hora: { type: ['string', 'null'], description: 'HH:MM si aparece' },
    sueno_horas: { type: ['number', 'null'] },
    agua_vasos: { type: ['integer', 'null'] },
    ejercicio_min: { type: ['integer', 'null'] },
    pasos: { type: ['integer', 'null'] },
    animo: { type: ['integer', 'null'], description: '1 (muy mal) a 5 (excelente)' },
    persona: { type: ['string', 'null'], description: 'Nombre de la persona para kind=relacion' },
    texto: { type: ['string', 'null'], description: 'Texto de diario o nota' },
    meta: { type: ['string', 'null'], description: 'Nombre de la meta a la que se aporta (kind=meta)' },
  },
};
const CAPTURE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items', 'respuesta'],
  properties: {
    items: { type: 'array', items: ITEM_SCHEMA },
    respuesta: { type: 'string', description: 'Respuesta cálida y breve en español (máx 14 palabras)' },
  },
};

function captureSystem(ctx) {
  return `Eres el motor de registro de IO, el diario-espejo de ${cfg.name}. Conviertes lo que ${cfg.name} escribe, dicta, fotografía o reenvía (recibos, pantallazos del banco, alertas por correo, estados de cuenta) en registros estructurados. Hoy es ${todayIso()}. Moneda: CAD. Vive en Montreal.

Tipos (kind):
- gasto / ingreso: dinero. monto siempre positivo. Un recibo o pantallazo con varias líneas del banco = varios items. Un recibo de tienda = UN item con el total.
- salud: sueño, agua, ejercicio, pasos, ánimo físico. Usa los campos numéricos; descripcion corta ("Gym", "Dormí 7h").
- diario: reflexiones, cómo se siente, lo que pasó. texto = el contenido; animo si se deduce.
- relacion: contacto con alguien ("llamé a mamá", "salí con Diana"). persona = nombre; texto = nota.
- meta: aporte a una meta ("ahorré 100 para el fondo"). meta = nombre de la meta; monto = aporte.
Un solo mensaje puede producir varios tipos (p.ej. "fui al gym y gasté 12 en un batido" = salud + gasto).

Comercios → categoría:
Walmart, Maxi, IGA, Metro, Marché, Provigo, Costco, Super C → supermercado 🛒
McDonald's, Tim Hortons ☕, Couche-Tard 🏪, Starbucks, restaurantes, Poulet Rouge, Coq Lala → comida 🍔
Shell, Esso, Petro-Canada, Ultramar → gasolina ⛽ · STM, Uber, Bixi, estacionamiento → transporte 🚗
YMCA, gym, farmacia, Jean Coutu, Pharmaprix, médico → salud 💪 · Netflix, Spotify, Fizz, Amazon Prime, seguros, bill payment → suscripcion 📱
Renta, Hydro-Québec → vivienda 🏠 · cine, SAQ, conciertos → entretenimiento 🎬 · Dollarama, Canadian Tire, Best Buy → otros 💸
CNESST, F.S.S.T., Gouv. du Canada, depósitos, "recibí/me pagaron/cobré" → ingreso 💵

Reglas de integridad (NO negociables):
- El depósito de la CNESST ya llega neto con la pensión alimenticia descontada: NUNCA registres la pensión como gasto aparte.
- Transferencias INTERAC/transfer entre sus propias cuentas (NBC ↔ Wealthsimple) de montos exactamente iguales son movimiento interno: NO las registres. Cualquier otro INTERAC (p.ej. a Diana) sí es gasto real.
- Si el monto de un gasto/ingreso no está claro, no inventes: omite ese item y dilo en "respuesta".
- Si nada es registrable, items = [] y responde algo útil.
${ctx.personas?.length ? `Personas conocidas: ${ctx.personas.join(', ')}.` : ''}
${ctx.metas?.length ? `Metas activas: ${ctx.metas.join(', ')}.` : ''}
Campos que no apliquen = null. categoria para no-dinero: usa "salud" para salud y "otros" para lo demás.`;
}

async function fileToBlock(file) {
  if (file.type === 'application/pdf') {
    return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: await b64(file) } };
  }
  // Reducir imágenes grandes (pantallazos de 4K) a ≤1568px — más rápido y barato
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1568 / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const data = c.toDataURL('image/jpeg', 0.85).split(',')[1];
  return { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data } };
}
function b64(file) {
  return new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(',')[1]);
    r.onerror = fail;
    r.readAsDataURL(file);
  });
}

function textOf(msg) {
  if (msg.stop_reason === 'refusal') throw new Error('REFUSAL');
  return msg.content.filter(b => b.type === 'text').map(b => b.text).join('');
}

/** Captura universal: texto y/o archivo → {items, respuesta} */
export async function parseCapture({ text = '', file = null }, ctx = {}) {
  const c = await client();
  const content = [];
  if (file) content.push(await fileToBlock(file));
  content.push({ type: 'text', text: text || (file ? 'Extrae los registros de este archivo.' : '') });
  const msg = await c.beta.messages.create({
    ...baseParams('low'),
    max_tokens: 4096,
    system: captureSystem(ctx),
    messages: [{ role: 'user', content }],
    output_config: { ...(baseParams('low').output_config || {}), format: { type: 'json_schema', schema: CAPTURE_SCHEMA } },
  });
  return JSON.parse(textOf(msg));
}

/** Chat con IO, con streaming. history = [{role, content}] */
export async function chat(history, lifeContext, onText) {
  const c = await client();
  const system = `Eres IO, el asistente personal y espejo digital de ${cfg.name}: colombiano, emprendedor, vive en Montreal. Cuidas tres pilares de su vida — finanzas, salud y relaciones — y su mente/diario. Eres cálido, directo, con humor sutil paisa-latino y hablas en español. Das números concretos cuando sirven, propones un siguiente paso pequeño y accionable, y nunca haces sentir culpa: el tono es de socio que acompaña, no de contador que regaña. Respuestas breves (2–5 oraciones) salvo que pida un plan o análisis. No inventes datos que no estén en el contexto.

Reglas de sus finanzas: la CNESST llega neta (la pensión ya está descontada, no es gasto aparte); las transferencias NBC↔Wealthsimple de montos iguales son internas.

CONTEXTO ACTUAL DE SU VIDA (JSON):
${JSON.stringify(lifeContext)}`;
  const stream = c.beta.messages.stream({
    ...baseParams('medium'),
    max_tokens: 8000,
    system,
    messages: history.slice(-16),
  });
  stream.on('text', t => onText?.(t));
  const final = await stream.finalMessage();
  return textOf(final);
}

/* ---------- parser local (sin IA, sin red) ---------- */
const MERCH = [
  [/walmart|maxi|iga|metro|march[eé]|provigo|costco|super ?c|epicerie|grocery/i, 'supermercado', '🛒'],
  [/couche|tard/i, 'comida', '🏪'], [/tim ?horton|starbucks|caf[eé]/i, 'comida', '☕'],
  [/mcdonald|burger|pizza|poulet|pollo|coq|restaurant|almuerzo|comida|cena|desayuno/i, 'comida', '🍔'],
  [/shell|esso|petro|ultramar|gasolina|gas\b/i, 'gasolina', '⛽'], [/uber|stm|bus|metro pass|bixi|parking|estacionamiento/i, 'transporte', '🚗'],
  [/ymca|gym|farmacia|jean coutu|pharma|m[eé]dico|doctor/i, 'salud', '💪'],
  [/netflix|spotify|fizz|prime|seguro|insurance|suscrip/i, 'suscripcion', '📱'],
  [/renta|rent|alquiler|hydro/i, 'vivienda', '🏠'], [/cine|saq|concierto|juego|bar\b/i, 'entretenimiento', '🎬'],
  [/dollarama|canadian tire|best buy|amazon/i, 'otros', '💸'],
];
export function localParse(text, ctx = {}) {
  const items = []; const t = text.trim(); const low = t.toLowerCase();
  const blank = { descripcion: '', monto: null, categoria: 'otros', emoji: '💳', fecha: null, hora: null, sueno_horas: null, agua_vasos: null, ejercicio_min: null, pasos: null, animo: null, persona: null, texto: null, meta: null };

  const sleep = low.match(/dorm[ií]\s*(\d+(?:[.,]\d+)?)\s*(h|horas)?/);
  const water = low.match(/(\d+)\s*(vasos?|botellas?)\s*(de\s*)?agua/);
  const gym = low.match(/(gym|gimnasio|corr[ií]|entren[eé]|camin[eé]|nad[eé]|yoga)[^\d]*(\d+)?\s*(min)?/);
  if (sleep || water || gym) {
    items.push({ ...blank, kind: 'salud', categoria: 'salud', emoji: gym ? '🏋️' : sleep ? '😴' : '💧',
      descripcion: gym ? 'Ejercicio' : sleep ? `Dormí ${sleep[1]}h` : 'Agua',
      sueno_horas: sleep ? parseFloat(sleep[1].replace(',', '.')) : null,
      agua_vasos: water ? parseInt(water[1]) : null,
      ejercicio_min: gym ? parseInt(gym[2] || '30') : null });
  }
  const person = (ctx.personas || []).find(p => low.includes(p.toLowerCase()));
  if (person && /(llam|habl|sal[ií]|vi a|visit|escrib|cen[eé]|almorc)/.test(low)) {
    items.push({ ...blank, kind: 'relacion', persona: person, descripcion: `Con ${person}`, emoji: '💬', texto: t });
  }
  const amt = t.match(/\$?\s*(\d{1,6}(?:[.,]\d{1,2})?)\s*(\$|d[oó]lares|cad|bucks)?/i);
  const moneyish = /(\$|gast|pagu|compr|recib|cobr|gan[eé]|llegó|llego|dep[oó]sit|d[oó]lares|cad)/i.test(t) || MERCH.some(([re]) => re.test(t));
  if (amt && moneyish && !(sleep && !/\$|gast|pag/.test(low))) {
    const monto = parseFloat(amt[1].replace(',', '.'));
    const ingreso = /(recib|cobr|gan[eé]|me pagaron|lleg[oó]|dep[oó]sit|cnesst|salario|sueldo)/i.test(t);
    const m = MERCH.find(([re]) => re.test(t));
    const merch = m ? t.match(m[0])?.[0] : '';
    let desc = merch || (t.match(/\b(?:en|de|a|para)\s+([A-Za-zÀ-ÿ'&.\- ]{2,30}?)(?=\s+y\s|\s+\d|\s*\$|$|,|\.)/i)?.[1]) || (ingreso ? 'Ingreso' : 'Gasto');
    desc = desc.trim().replace(/^\w/, c => c.toUpperCase());
    items.push({ ...blank, kind: ingreso ? 'ingreso' : 'gasto', monto, descripcion: desc,
      categoria: ingreso ? 'ingreso' : (m ? m[1] : 'otros'), emoji: ingreso ? '💵' : (m ? m[2] : '💳') });
  }
  if (!items.length && t.length > 25) {
    items.push({ ...blank, kind: 'diario', descripcion: 'Entrada de diario', texto: t, emoji: '📝', animo: /feliz|bien|genial|incre[ií]ble|content/i.test(t) ? 4 : /mal|triste|cansad|estres|ansios/i.test(t) ? 2 : null });
  }
  return { items, respuesta: items.length ? 'Listo (modo sin IA). Revisa y guarda.' : 'No entendí. Prueba: "gasté 25 en Walmart".' };
}
