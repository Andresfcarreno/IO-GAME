/* IO — importador de CSV bancario (NBC, Wealthsimple, Desjardins, genérico, o el formato del Sheet).
 * Aplica las reglas de integridad aprendidas:
 *  - INTERAC/transferencias entre cuentas propias con montos EXACTAMENTE iguales → internas, no se importan.
 *  - Cualquier otro INTERAC sí es gasto real.
 *  - La pensión alimenticia nunca se registra aparte (el depósito CNESST llega neto). */
import { parseCSV, pad } from './store.js';

const H = {
  fecha: /^(date|fecha|transaction date|date de transaction|posted|date d'op)/i,
  desc: /(description|descripci[oó]n|details|libell[eé]|merchant|payee|comercio)/i,
  monto: /^(amount|monto|montant|value)$/i,
  debit: /(debit|d[eé]bit|withdrawal|retrait|cargo|paid out)/i,
  credit: /(credit|cr[eé]dit|deposit|d[eé]p[oô]t|abono|paid in)/i,
  tipo: /^(tipo|type)$/i,
};

function toIso(s) {
  s = (s || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/))) return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
  if ((m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/))) {
    // dd/mm/yyyy (formato del Sheet y de la mayoría de bancos en Québec); si el primer campo >12 no hay duda
    return `${m[3]}-${pad(m[2])}-${pad(m[1])}`;
  }
  const d = new Date(s);
  return isNaN(d) ? null : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
const num = s => { const v = parseFloat(String(s || '').replace(/[^0-9.,-]/g, '').replace(/,(\d{2})$/, '.$1').replace(/,/g, '')); return isNaN(v) ? 0 : v; };

function categorize(desc) {
  const d = desc.toLowerCase();
  const map = [
    [/walmart|maxi|iga|metro|march[eé]|provigo|costco|super c|epicerie/, 'supermercado'],
    [/couche|tim hort|mcdonald|starbucks|poulet|coq|restaurant|pizza|a&w|subway/, 'comida'],
    [/shell|esso|petro|ultramar/, 'gasolina'], [/stm|uber|bixi|parking/, 'transporte'],
    [/ymca|jean coutu|pharma|clinic/, 'salud'], [/netflix|spotify|fizz|amazon prime|insurance|assurance|unique|bill payment/, 'suscripcion'],
    [/hydro|rent|loyer/, 'vivienda'], [/cine|saq|cinema/, 'entretenimiento'],
    [/cnesst|f\.s\.s\.t|gouv|gov\. of canada|payroll|deposit|d[eé]p[oô]t/, 'ingreso'],
  ];
  return (map.find(([re]) => re.test(d)) || [null, 'otros'])[1];
}
const isTransfer = d => /interac|e-transfer|virement|transfer|wealthsimple|transf/i.test(d);
const isPension = d => /pensi[oó]n aliment|pension alim/i.test(d);

/** Devuelve {rows:[{fecha, descripcion, monto, tipo, categoria, skip, reason}], cols} */
export function analyzeCSV(text, existingKeys = new Set()) {
  const rows = parseCSV(text);
  if (!rows.length) return { rows: [], error: 'CSV vacío' };
  let header = rows[0].map(h => h.toLowerCase());
  const hasHeader = header.some(h => H.fecha.test(h) || H.desc.test(h) || H.monto.test(h));
  let body = hasHeader ? rows.slice(1) : rows;
  let idx;
  if (hasHeader) {
    const find = re => header.findIndex(h => re.test(h));
    idx = { fecha: find(H.fecha), desc: find(H.desc), monto: find(H.monto), debit: find(H.debit), credit: find(H.credit), tipo: find(H.tipo) };
  } else if (rows[0].length >= 5 && /gasto|ingreso/i.test(rows[0][4] || '')) {
    // Formato de la app / Sheet: fecha, hora, descripcion, monto, tipo, categoria, original
    idx = { fecha: 0, desc: 2, monto: 3, tipo: 4, debit: -1, credit: -1, cat: 5 };
  } else {
    // Adivinar: primera columna con fecha, la de texto más larga, la numérica
    const s = rows[0];
    idx = { fecha: s.findIndex(c => toIso(c)), desc: -1, monto: -1, debit: -1, credit: -1, tipo: -1 };
    let best = 0; s.forEach((c, i) => { if (i !== idx.fecha && isNaN(num(c) || NaN) && c.length > best) { best = c.length; idx.desc = i; } });
    idx.monto = s.findIndex((c, i) => i !== idx.fecha && /^-?\$?[\d.,]+$/.test(c.trim()));
  }
  if (idx.fecha < 0 || idx.desc < 0 || (idx.monto < 0 && idx.debit < 0 && idx.credit < 0)) {
    return { rows: [], error: 'No reconocí las columnas (fecha, descripción, monto). Usa la captura con IA para este archivo.' };
  }

  const out = body.map(r => {
    const fecha = toIso(r[idx.fecha]);
    const descripcion = (r[idx.desc] || '').replace(/\s+/g, ' ').trim();
    let monto, tipo;
    if (idx.tipo >= 0 && /gasto|ingreso/i.test(r[idx.tipo] || '')) {
      monto = Math.abs(num(r[idx.monto])); tipo = /ingreso/i.test(r[idx.tipo]) ? 'ingreso' : 'gasto';
    } else if (idx.debit >= 0 || idx.credit >= 0) {
      const de = Math.abs(num(r[idx.debit])), cr = Math.abs(num(r[idx.credit]));
      monto = de || cr; tipo = cr && !de ? 'ingreso' : 'gasto';
    } else {
      const v = num(r[idx.monto]); monto = Math.abs(v); tipo = v > 0 && /cnesst|f\.s\.s\.t|gouv|deposit|d[eé]p[oô]t|payroll/i.test(descripcion) ? 'ingreso' : v < 0 ? 'gasto' : categorize(descripcion) === 'ingreso' ? 'ingreso' : 'gasto';
    }
    const categoria = idx.cat != null && r[idx.cat] ? r[idx.cat].toLowerCase() : (tipo === 'ingreso' ? 'ingreso' : categorize(descripcion));
    return { fecha, descripcion, monto, tipo, categoria, skip: false, reason: '' };
  }).filter(r => r.fecha && r.monto > 0 && r.descripcion);

  // Transferencias internas: un débito y un crédito del MISMO monto, ambos transferencias, a ≤3 días
  const transfers = out.filter(r => isTransfer(r.descripcion));
  for (const a of transfers) {
    if (a.skip || a.tipo !== 'gasto') continue;
    const b = transfers.find(x => !x.skip && x !== a && x.tipo === 'ingreso' && x.monto.toFixed(2) === a.monto.toFixed(2)
      && Math.abs(new Date(x.fecha) - new Date(a.fecha)) <= 3 * 864e5);
    if (b) { a.skip = b.skip = true; a.reason = b.reason = 'Transferencia interna (mismo monto entre tus cuentas)'; }
  }
  for (const r of out) {
    if (!r.skip && isPension(r.descripcion)) { r.skip = true; r.reason = 'Pensión: ya viene descontada del depósito CNESST'; }
    const key = `${r.fecha}||${r.descripcion.toLowerCase()}|${r.monto.toFixed(2)}|${r.tipo}`;
    const loose = `${r.fecha}|${r.descripcion.toLowerCase()}|${r.monto.toFixed(2)}|${r.tipo}`;
    if (!r.skip && (existingKeys.has(key) || existingKeys.has(loose))) { r.skip = true; r.reason = 'Ya registrado'; }
  }
  return { rows: out };
}
