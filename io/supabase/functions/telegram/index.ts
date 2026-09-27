// IO — webhook de Telegram. Reemplaza el escenario de Make.com.
// Entiende texto, fotos (pantallazos del banco, recibos) y PDFs; guarda en Supabase y responde.
// Deploy: supabase functions deploy telegram --no-verify-jwt   (la seguridad la da el secret token)
import { type Block, commit, db, IMAGE_MIMES, type ImageMime, parse, summary, today } from "../_shared/brain.ts";
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

const TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN")!;
const SECRET = Deno.env.get("TELEGRAM_WEBHOOK_SECRET")!;
const ALLOWED = (Deno.env.get("TELEGRAM_ALLOWED_CHAT_IDS") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
const API = `https://api.telegram.org/bot${TOKEN}`;

async function send(chat_id: number, text: string) {
  await fetch(`${API}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id, text, parse_mode: "HTML", disable_web_page_preview: true }),
  });
}
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]!));

async function download(file_id: string): Promise<{ data: string; path: string }> {
  const info = await (await fetch(`${API}/getFile?file_id=${file_id}`)).json();
  const path = info.result.file_path as string;
  const buf = new Uint8Array(await (await fetch(`https://api.telegram.org/file/bot${TOKEN}/${path}`)).arrayBuffer());
  return { data: encodeBase64(buf), path };
}

async function command(chat: number, cmd: string) {
  const t = today();
  if (cmd === "/hoy") {
    const s = await summary(t, t);
    return send(chat, `📅 <b>Hoy</b>\nGastado: $${s.gast.toFixed(2)} · Recibido: $${s.ing.toFixed(2)}\n${s.top || "Sin gastos todavía 🌟"}`);
  }
  if (cmd === "/mes") {
    const s = await summary(t.slice(0, 8) + "01", t);
    const bal = s.ing - s.gast;
    return send(chat, `🗓 <b>Este mes</b>\nIngresos: $${s.ing.toFixed(2)}\nGastos: $${s.gast.toFixed(2)}\nBalance: ${bal >= 0 ? "+" : "-"}$${Math.abs(bal).toFixed(2)}\n\n<b>Top categorías</b>\n${s.top || "—"}`);
  }
  if (cmd === "/salud") {
    const { data } = await db.from("io_items").select("data").eq("id", `health:${t}`).maybeSingle();
    const h = data?.data ?? {};
    return send(chat, `💪 <b>Salud hoy</b>\n😴 Sueño: ${h.sueno ?? "—"}h\n💧 Agua: ${h.agua ?? 0} vasos\n🏋️ Ejercicio: ${h.ejercicio ?? 0} min\n👟 Pasos: ${h.pasos ?? 0}`);
  }
  return send(chat, `🔮 <b>Soy IO</b>, tu espejo. Escríbeme como a un amigo:\n• “gasté 25 en Walmart”\n• “me llegaron 1138 de la CNESST”\n• “dormí 7 horas, fui al gym 40 min”\n• “llamé a mamá”\n• “ahorré 100 para el fondo de emergencia”\n• o mándame un <b>pantallazo del banco</b>, una <b>foto del recibo</b> o un <b>PDF</b>.\n\nComandos: /hoy /mes /salud`);
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("IO telegram ok");
  if (req.headers.get("x-telegram-bot-api-secret-token") !== SECRET) return new Response("forbidden", { status: 403 });
  const update = await req.json();
  const m = update.message ?? update.edited_message;
  if (!m) return new Response("ok");
  const chat: number = m.chat.id;

  // Solo tus chats. Si no has configurado ALLOWED, el bot te dice tu chat_id y no guarda nada.
  if (!ALLOWED.includes(String(chat))) {
    await send(chat, `🔒 Este bot es privado. Tu chat_id es <code>${chat}</code> — agrégalo al secreto TELEGRAM_ALLOWED_CHAT_IDS para activarlo.`);
    return new Response("ok");
  }

  try {
    const text: string = m.text ?? m.caption ?? "";
    if (text.startsWith("/")) { await command(chat, text.split(/[\s@]/)[0].toLowerCase()); return new Response("ok"); }
    if (m.voice || m.audio) { await send(chat, "🎙️ Todavía no escucho notas de voz. Usa el dictado del teclado y me lo mandas como texto 🙏"); return new Response("ok"); }

    const files: Block[] = [];
    if (m.photo?.length) {
      const { data } = await download(m.photo[m.photo.length - 1].file_id);
      files.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data } });
    } else if (m.document) {
      const mime: string = m.document.mime_type ?? "";
      const { data } = await download(m.document.file_id);
      if (mime === "application/pdf") files.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data } });
      else if (IMAGE_MIMES.includes(mime)) files.push({ type: "image", source: { type: "base64", media_type: mime as ImageMime, data } });
      else { await send(chat, "📎 Puedo leer fotos y PDFs. Para CSV del banco usa la app → Conexiones → Banco."); return new Response("ok"); }
    }
    if (!text && !files.length) return new Response("ok");

    await fetch(`${API}/sendChatAction`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chat, action: "typing" }) });
    const { items, respuesta } = await parse(text, files, files.length ? "Telegram (archivo)" : "Telegram");
    const done = await commit(items, text || (files.length ? "archivo" : ""), "telegram");
    await send(chat, `${done.length ? "✅ " : ""}${esc(respuesta)}${done.length ? "\n\n" + done.map(esc).join("\n") : ""}`);
  } catch (e) {
    console.error(e);
    await send(chat, "⚠️ Algo falló guardando eso. Intenta de nuevo en un momento.");
  }
  return new Response("ok");
});
