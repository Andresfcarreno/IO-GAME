// IO — cerebro compartido de las Edge Functions: parsea con Claude y guarda en Supabase.
import Anthropic from "npm:@anthropic-ai/sdk@0.128.0";
import { createClient } from "npm:@supabase/supabase-js@2";

export const TZ = Deno.env.get("IO_TZ") ?? "America/Toronto"; // Montreal
export const NAME = Deno.env.get("IO_NAME") ?? "Andrés";
const MODEL = Deno.env.get("IO_MODEL") ?? "claude-opus-5";

export const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});
const anthropic = new Anthropic(); // lee ANTHROPIC_API_KEY de los secretos de la función

export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
export function nowHM(): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
}

const CATS = ["comida", "supermercado", "gasolina", "transporte", "salud", "entretenimiento", "suscripcion", "vivienda", "educacion", "ropa", "regalos", "negocio", "ingreso", "otros"];
const nul = (t: string) => ({ type: [t, "null"] });
const ITEM = {
  type: "object",
  additionalProperties: false,
  required: ["kind", "descripcion", "monto", "categoria", "emoji", "fecha", "hora", "sueno_horas", "agua_vasos", "ejercicio_min", "pasos", "animo", "persona", "texto", "meta"],
  properties: {
    kind: { type: "string", enum: ["gasto", "ingreso", "salud", "diario", "relacion", "meta"] },
    descripcion: { type: "string" }, monto: nul("number"), categoria: { type: "string", enum: CATS }, emoji: { type: "string" },
    fecha: nul("string"), hora: nul("string"), sueno_horas: nul("number"), agua_vasos: nul("integer"), ejercicio_min: nul("integer"),
    pasos: nul("integer"), animo: nul("integer"), persona: nul("string"), texto: nul("string"), meta: nul("string"),
  },
};
const SCHEMA = {
  type: "object", additionalProperties: false, required: ["items", "respuesta"],
  properties: { items: { type: "array", items: ITEM }, respuesta: { type: "string" } },
};

export type Item = {
  kind: string; descripcion: string; monto: number | null; categoria: string; emoji: string; fecha: string | null; hora: string | null;
  sueno_horas: number | null; agua_vasos: number | null; ejercicio_min: number | null; pasos: number | null; animo: number | null;
  persona: string | null; texto: string | null; meta: string | null;
};

async function knownNames() {
  const { data } = await db.from("io_items").select("kind,data").in("kind", ["person", "goal"]).eq("deleted", false);
  return {
    personas: (data ?? []).filter((r) => r.kind === "person").map((r) => r.data.nombre),
    metas: (data ?? []).filter((r) => r.kind === "goal").map((r) => r.data.nombre),
  };
}

function system(ctx: { personas: string[]; metas: string[] }, source: string) {
  return `Eres el motor de registro de IO, el diario-espejo de ${NAME} (Montreal, CAD). Hoy es ${today()}. Fuente: ${source}.
Convierte el mensaje (texto, pantallazo del banco, recibo, PDF o alerta de correo) en registros.
kind: gasto | ingreso (monto positivo; un pantallazo con varias líneas = varios items; un recibo de tienda = un item con el total),
salud (sueño, agua, ejercicio, pasos, ánimo), diario (reflexiones: texto), relacion (contacto con una persona: persona + texto),
meta (aporte a una meta: meta + monto). Un mensaje puede tener varios tipos.
Categorías: Walmart/Maxi/IGA/Metro/Marché/Costco → supermercado; McDonald's/Tim Hortons/Couche-Tard/restaurantes → comida;
Shell/Esso/Petro-Canada → gasolina; STM/Uber → transporte; YMCA/farmacia → salud; Netflix/Spotify/Fizz/Prime/seguros/bill payment → suscripcion;
renta/Hydro → vivienda; cine/SAQ → entretenimiento; Dollarama/Canadian Tire/Best Buy → otros; CNESST/F.S.S.T./Gouv. du Canada/depósitos → ingreso.
REGLAS: la CNESST llega neta (pensión ya descontada) → NUNCA registres la pensión aparte. Transferencias NBC↔Wealthsimple de montos iguales = internas, no las registres; otro INTERAC sí es gasto.
Si un monto no es claro, omite el item y dilo. Campos que no apliquen = null.
${ctx.personas.length ? `Personas: ${ctx.personas.join(", ")}.` : ""} ${ctx.metas.length ? `Metas: ${ctx.metas.join(", ")}.` : ""}
"respuesta": confirmación cálida y breve en español (máx 20 palabras), como un socio.`;
}

export type ImageMime = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
export const IMAGE_MIMES: string[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];
export type Block = { type: "image"; source: { type: "base64"; media_type: ImageMime; data: string } } |
  { type: "document"; source: { type: "base64"; media_type: "application/pdf"; data: string } };

export async function parse(text: string, files: Block[] = [], source = "telegram"): Promise<{ items: Item[]; respuesta: string }> {
  const ctx = await knownNames();
  const opusLike = /opus|fable/.test(MODEL);
  const msg = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens: 4096,
    ...(opusLike ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    system: system(ctx, source),
    output_config: { ...(opusLike ? { effort: "low" as const } : {}), format: { type: "json_schema", schema: SCHEMA } },
    messages: [{ role: "user", content: [...files, { type: "text", text: text || "Extrae los registros de este archivo." }] }],
  });
  if (msg.stop_reason === "refusal") return { items: [], respuesta: "No pude procesar eso 🙏" };
  const out = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  return JSON.parse(out);
}

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
async function putItem(id: string, kind: string, data: Record<string, unknown>) {
  await db.from("io_items").upsert({ id, kind, data, updated_at: new Date().toISOString(), deleted: false });
}
const norm = (s: string) => s.toLowerCase().trim();

/** Guarda los items. Devuelve líneas legibles de lo que se registró. */
export async function commit(items: Item[], original: string, origen: string): Promise<string[]> {
  const done: string[] = [];
  for (const it of items) {
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(it.fecha ?? "") ? it.fecha! : today();
    if (it.kind === "gasto" || it.kind === "ingreso") {
      if (!it.monto || it.monto <= 0) continue;
      const { error } = await db.from("transactions").insert({
        fecha, hora: it.hora ?? (fecha === today() ? nowHM() : null), descripcion: it.descripcion || "Movimiento",
        monto: it.monto, tipo: it.kind, categoria: it.kind === "ingreso" ? "ingreso" : it.categoria,
        mensaje_original: `[${origen}] ${original}`.slice(0, 500), origen,
      });
      if (error) throw error;
      done.push(`${it.emoji || "💳"} ${it.descripcion} ${it.kind === "ingreso" ? "+" : "-"}$${it.monto.toFixed(2)}`);
    } else if (it.kind === "salud") {
      const id = `health:${fecha}`;
      const { data: row } = await db.from("io_items").select("data").eq("id", id).maybeSingle();
      const h: Record<string, number | string> = { ...(row?.data ?? {}), fecha };
      if (it.sueno_horas != null) h.sueno = it.sueno_horas;
      if (it.agua_vasos) h.agua = Number(h.agua ?? 0) + it.agua_vasos;
      if (it.ejercicio_min) h.ejercicio = Number(h.ejercicio ?? 0) + it.ejercicio_min;
      if (it.pasos) h.pasos = Math.max(Number(h.pasos ?? 0), it.pasos);
      if (it.animo) h.animo = it.animo;
      await putItem(id, "health", h);
      done.push(`💪 ${it.descripcion}`);
    } else if (it.kind === "diario") {
      await putItem(`journal:${uid()}`, "journal", { fecha, hora: nowHM(), texto: it.texto || it.descripcion, animo: it.animo });
      done.push("📝 Guardado en tu diario");
    } else if (it.kind === "relacion" && it.persona) {
      const { data: people } = await db.from("io_items").select("id,data").eq("kind", "person").eq("deleted", false);
      let p = (people ?? []).find((r) => norm(r.data.nombre) === norm(it.persona!)) ??
        (people ?? []).find((r) => norm(r.data.nombre).includes(norm(it.persona!)) || norm(it.persona!).includes(norm(r.data.nombre)));
      if (!p) {
        p = { id: `person:${uid()}`, data: { nombre: it.persona, emoji: "🙂", cada: 7, relacion: "otro" } };
        await putItem(p.id, "person", p.data);
      }
      await putItem(`interaction:${uid()}`, "interaction", { personaId: p.id, fecha, tipo: "contacto", nota: it.texto ?? "" });
      done.push(`💬 Contacto con ${p.data.nombre}`);
    } else if (it.kind === "meta" && it.meta && it.monto) {
      const { data: goals } = await db.from("io_items").select("id,data").eq("kind", "goal").eq("deleted", false);
      const g = (goals ?? []).find((r) => norm(r.data.nombre).includes(norm(it.meta!)) || norm(it.meta!).includes(norm(r.data.nombre)));
      if (!g) continue;
      const actual = Math.round((Number(g.data.actual) + it.monto) * 100) / 100;
      await putItem(g.id, "goal", { ...g.data, actual });
      done.push(`🎯 ${g.data.nombre}: ${actual}/${g.data.objetivo}`);
    }
  }
  return done;
}

/** Resumen de un rango de fechas para los comandos del bot. */
export async function summary(from: string, to: string) {
  const { data } = await db.from("transactions").select("descripcion,monto,tipo,categoria").gte("fecha", from).lte("fecha", to);
  const rows = data ?? [];
  const gast = rows.filter((r) => r.tipo === "gasto").reduce((s, r) => s + Number(r.monto), 0);
  const ing = rows.filter((r) => r.tipo === "ingreso").reduce((s, r) => s + Number(r.monto), 0);
  const cats: Record<string, number> = {};
  rows.filter((r) => r.tipo === "gasto").forEach((r) => (cats[r.categoria] = (cats[r.categoria] ?? 0) + Number(r.monto)));
  const top = Object.entries(cats).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([c, v]) => `  • ${c}: $${v.toFixed(2)}`).join("\n");
  return { gast, ing, n: rows.length, top };
}
