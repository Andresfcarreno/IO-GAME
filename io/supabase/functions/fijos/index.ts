// IO — gastos fijos automáticos (reemplaza el intento con Feeder+Iterator de Make, que no funcionó).
// Se llama una vez al día (pg_cron, ver schema.sql). Para cada fijo cuyo día es hoy y que aún no
// aparece pagado este mes, inserta la transacción con mensaje_original "[Fijo] …".
// Deploy: supabase functions deploy fijos --no-verify-jwt
import { db, today } from "../_shared/brain.ts";

const SECRET = Deno.env.get("INGEST_SECRET")!;

Deno.serve(async (req) => {
  if (!SECRET || req.headers.get("x-io-secret") !== SECRET) return new Response("forbidden", { status: 403 });
  const t = today();
  const day = Number(t.slice(8, 10));
  const lastDay = new Date(Number(t.slice(0, 4)), Number(t.slice(5, 7)), 0).getDate();
  const monthStart = t.slice(0, 8) + "01";

  const { data: fijos } = await db.from("io_items").select("data").eq("kind", "fijo").eq("deleted", false);
  const { data: monthTx } = await db.from("transactions").select("descripcion,mensaje_original").eq("tipo", "gasto").gte("fecha", monthStart).lte("fecha", t);
  const inserted: string[] = [];

  for (const { data: f } of fijos ?? []) {
    const due = Math.min(Number(f.dia), lastDay); // un fijo del 31 cae el último día en meses cortos
    if (due !== day || f.auto === false) continue;
    const match = String(f.match || f.descripcion).toLowerCase();
    const paid = (monthTx ?? []).some((r) => r.descripcion.toLowerCase().includes(match) || String(r.mensaje_original ?? "").toLowerCase().includes(`[fijo] ${String(f.descripcion).toLowerCase()}`));
    if (paid) continue;
    const { error } = await db.from("transactions").insert({
      fecha: t, hora: null, descripcion: f.descripcion, monto: f.monto, tipo: "gasto", categoria: f.categoria ?? "otros",
      mensaje_original: `[Fijo] ${f.descripcion}`, origen: "fijo",
    });
    if (!error) inserted.push(f.descripcion);
  }
  return Response.json({ fecha: t, insertados: inserted });
});
