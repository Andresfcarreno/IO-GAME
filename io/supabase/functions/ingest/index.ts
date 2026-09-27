// IO — ingesta genérica: alertas del banco por correo (vía Google Apps Script), atajos de iPhone, etc.
// POST { "text": "...", "source": "correo" }  con header  x-io-secret: <INGEST_SECRET>
// Deploy: supabase functions deploy ingest --no-verify-jwt
import { commit, parse } from "../_shared/brain.ts";

const SECRET = Deno.env.get("INGEST_SECRET")!;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("IO ingest ok");
  if (!SECRET || req.headers.get("x-io-secret") !== SECRET) return new Response("forbidden", { status: 403 });
  const { text, source = "correo" } = await req.json();
  if (!text || typeof text !== "string") return Response.json({ error: "text requerido" }, { status: 400 });
  try {
    const { items, respuesta } = await parse(text.slice(0, 20000), [], source === "correo" ? "alerta de correo del banco" : source);
    const done = await commit(items, text.slice(0, 200), source === "correo" ? "correo" : String(source).slice(0, 20));
    return Response.json({ ok: true, guardados: done, respuesta });
  } catch (e) {
    console.error(e);
    return Response.json({ ok: false, error: String(e) }, { status: 500 });
  }
});
