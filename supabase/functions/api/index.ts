// LUO API — دالة واحدة لكل طلبات اللعبة ولوحة صاحب البوت.
// الهوية تثبت من initData حق تلقرام (موقّع بتوكن البوت)، مو من أي شي يرسله العميل.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-init-data",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Max-Age": "86400",
};
const CELLS = 25;
const MAX_AUTH_AGE = 24 * 3600;
const enc = new TextEncoder();

const json = (body: any, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const fail = (error: string, status = 200) => json({ error }, status);
const hex = (buf: ArrayBuffer | Uint8Array) =>
  Array.from(buf instanceof Uint8Array ? buf : new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

async function hmac(key: ArrayBuffer | Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return crypto.subtle.sign("HMAC", k, enc.encode(msg));
}

async function privateConfig(key: string): Promise<string> {
  const { data } = await db.from("private_config").select("value").eq("key", key).maybeSingle();
  return data?.value ?? "";
}

// يتحقق من توقيع initData ويرجع بيانات المستخدم، أو null
async function verifyInitData(initData: string, token: string) {
  if (!initData || initData.length > 4096) return null;
  const params = new URLSearchParams(initData);
  const hash = params.get("hash") ?? "";
  if (!/^[0-9a-f]{64}$/.test(hash)) return null;
  params.delete("hash");
  const check = [...params.entries()].map(([k, v]) => `${k}=${v}`).sort().join("\n");
  const secret = await hmac(enc.encode("WebAppData"), token);
  const expected = hex(await hmac(secret, check));
  let diff = 0;
  for (let i = 0; i < 64; i++) diff |= expected.charCodeAt(i) ^ hash.charCodeAt(i);
  if (diff !== 0) return null;
  const authDate = Number(params.get("auth_date"));
  const now = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(authDate) || now - authDate > MAX_AUTH_AGE || authDate - now > 300) return null;
  try {
    const user = JSON.parse(params.get("user") ?? "");
    if (!Number.isSafeInteger(user.id) || user.id <= 0) return null;
    return { id: user.id as number, name: String(user.first_name ?? "").slice(0, 64), username: String(user.username ?? "").slice(0, 64) };
  } catch {
    return null;
  }
}

/* ---------- أدوات ---------- */

function randomInt(max: number) {
  const limit = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    crypto.getRandomValues(buf);
    if (buf[0] < limit) return buf[0] % max;
  }
}

function dealBoard(s: any) {
  const idx = Array.from({ length: CELLS }, (_, i) => i);
  for (let j = CELLS - 1; j > 0; j--) {
    const k = randomInt(j + 1);
    [idx[j], idx[k]] = [idx[k], idx[j]];
  }
  const bombs = idx.slice(0, s.bombs).sort((a, b) => a - b);
  const total = s.gemValues.reduce((t: number, r: number[]) => t + r[1], 0);
  const vals = Array.from({ length: CELLS }, (_, i) => {
    if (bombs.includes(i)) return 0;
    let pick = randomInt(total);
    for (const [value, weight] of s.gemValues) {
      pick -= weight;
      if (pick < 0) return value;
    }
    return s.gemValues[s.gemValues.length - 1][0];
  });
  return { bombs, vals };
}

function toNano(price: unknown): bigint | null {
  const str = String(price ?? "").trim();
  if (!/^\d{1,6}(\.\d{1,9})?$/.test(str)) return null;
  const [whole, frac = ""] = str.split(".");
  const nano = BigInt(whole + frac.padEnd(9, "0"));
  return nano > 0n ? nano : null;
}

// يتحقق من عنوان TON بالصيغة الودية (طول + checksum + الشبكة الرئيسية)
function validTonAddress(addr: unknown) {
  const str = String(addr ?? "").trim();
  if (!/^[A-Za-z0-9_\-+/]{48}$/.test(str)) return false;
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.from(atob(str.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }
  if (bytes.length !== 36 || (bytes[0] !== 0x11 && bytes[0] !== 0x51)) return false;
  if (bytes[1] !== 0 && bytes[1] !== 0xff) return false;
  let crc = 0;
  for (let i = 0; i < 34; i++) {
    crc ^= bytes[i] << 8;
    for (let b = 0; b < 8; b++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc === ((bytes[34] << 8) | bytes[35]);
}

function cleanSettings(input: any): any | null {
  if (!input || typeof input !== "object") return null;
  const bombs = Number(input.bombs);
  if (toNano(input.price) === null || !validTonAddress(input.payTo)) return null;
  if (!Number.isInteger(bombs) || bombs < 1 || bombs > CELLS - 1) return null;
  if (!Array.isArray(input.gemValues) || input.gemValues.length < 1 || input.gemValues.length > 20) return null;
  const gemValues: number[][] = [];
  for (const row of input.gemValues) {
    if (!Array.isArray(row) || row.length !== 2) return null;
    const [value, weight] = row.map(Number);
    if (!Number.isInteger(value) || value < 1 || value > 1_000_000) return null;
    if (!Number.isInteger(weight) || weight < 1 || weight > 1_000_000) return null;
    gemValues.push([value, weight]);
  }
  return { enabled: input.enabled !== false, price: String(input.price).trim(), payTo: String(input.payTo).trim(), bombs, gemValues };
}

async function loadSettings() {
  const { data, error } = await db.from("settings").select("data").eq("id", true).single();
  if (error) throw error;
  const s = cleanSettings(data.data);
  if (!s) throw new Error("BAD_SETTINGS");
  return s;
}

const publicSettings = (s: any) => ({ enabled: s.enabled, price: s.price, bombs: s.bombs, cells: CELLS });

// شكل الجولة اللي يشوفه اللاعب: أماكن القنابل والقيم المخفية ما تطلع إلا بعد نهاية الجولة
function roundView(r: any) {
  const done = ["collected", "won", "lost"].includes(r.status);
  return {
    id: r.id,
    mode: r.mode,
    status: r.status,
    cells: r.cells,
    bombCount: r.bombs.length,
    score: Number(r.score),
    opened: (r.opened as number[]).filter((i) => !r.bombs.includes(i)).map((i) => [i, r.vals[i]]),
    pay: r.status === "pending" ? { to: r.pay_to, amountNano: String(r.price_nano), comment: r.pay_code } : null,
    reveal: done ? { bombs: r.bombs, vals: r.vals } : null,
  };
}

async function openRound(tgId: number) {
  const { data } = await db.from("rounds").select("*").eq("tg_id", tgId).in("status", ["active", "pending"]);
  const rows = data ?? [];
  return rows.find((r: any) => r.status === "active") ?? rows.find((r: any) => r.status === "pending") ?? null;
}

// يدوّر في آخر التحويلات الواصلة لعنوان الاستقبال عن دفعة تحمل كود الجولة
async function findPayment(round: any): Promise<string | null> {
  const headers: Record<string, string> = { Accept: "application/json" };
  const key = Deno.env.get("TONAPI_KEY");
  if (key) headers.Authorization = `Bearer ${key}`;
  const res = await fetch(`https://tonapi.io/v2/blockchain/accounts/${encodeURIComponent(round.pay_to)}/transactions?limit=100`, { headers });
  if (!res.ok) throw new Error(`TONAPI_${res.status}`);
  const body = await res.json();
  const codeHex = hex(enc.encode(round.pay_code));
  for (const tx of body.transactions ?? []) {
    const m = tx.in_msg;
    if (!m || m.msg_type !== "int_msg" || m.bounced === true) continue;
    const comment = String(m.decoded_body?.text ?? "");
    const raw = String(m.raw_body ?? "").toLowerCase();
    if (comment !== round.pay_code && !raw.includes(codeHex)) continue;
    let value = 0n;
    try { value = BigInt(m.value); } catch { continue; }
    if (value < BigInt(round.price_nano)) continue;
    // الدفعة تنحسب إذا العملية نجحت، أو كانت غير قابلة للارتداد (فالمبلغ انضاف حتى لو المحفظة غير مفعّلة)
    if (tx.success !== true && m.bounce !== false) continue;
    return String(tx.hash);
  }
  return null;
}

/* ---------- أوامر اللاعب ---------- */

async function session(user: any, isAdmin: boolean) {
  const { data: player, error } = await db.from("players")
    .upsert({ tg_id: user.id, first_name: user.name, username: user.username, last_seen: new Date().toISOString() }, { onConflict: "tg_id" })
    .select("*").single();
  if (error) throw error;
  const base = { player: { id: String(player.tg_id), name: player.first_name, balance: Number(player.balance), freePlays: player.free_plays, banned: player.banned }, isAdmin };
  if (player.banned) return base;
  const s = await loadSettings();
  const nowIso = new Date().toISOString();
  const [{ data: anns }, { data: claims }, round] = await Promise.all([
    db.from("announcements").select("*").eq("active", true).or(`expires_at.is.null,expires_at.gt."${nowIso}"`).order("created_at", { ascending: false }).limit(10),
    db.from("announcement_claims").select("announcement_id").eq("tg_id", user.id),
    openRound(user.id),
  ]);
  const claimed = new Set((claims ?? []).map((c: any) => c.announcement_id));
  return {
    ...base,
    settings: publicSettings(s),
    announcements: (anns ?? []).filter((a: any) => !(a.kind === "free_game" && claimed.has(a.id)))
      .map((a: any) => ({ id: a.id, kind: a.kind, title: a.title, body: a.body, button: a.button, url: a.url, freePlays: a.free_plays })),
    round: round ? roundView(round) : null,
  };
}

async function start(user: any, body: any) {
  const s = await loadSettings();
  if (!s.enabled) return { error: "GAME_DISABLED" };
  const existing = await openRound(user.id);
  if (existing?.status === "active") return { round: roundView(existing), resumed: true };
  const board = dealBoard(s);

  if (body.mode === "free") {
    const { data, error } = await db.rpc("luo_start_free", { p_tg: user.id, p_cells: CELLS, p_bombs: board.bombs, p_vals: board.vals });
    if (error) throw error;
    if (data.error) return data;
    const { data: r } = await db.from("rounds").select("*").eq("id", data.id).single();
    const { data: p } = await db.from("players").select("free_plays").eq("tg_id", user.id).single();
    return { round: roundView(r), freePlays: p?.free_plays ?? 0 };
  }
  if (body.mode !== "paid") return { error: "BAD_MODE" };

  const priceNano = toNano(s.price)!;
  if (existing?.status === "pending") {
    // نفس السعر والعنوان: نرجّع نفس الكود عشان لو دفع قبل ما ينقفل التطبيق تنحسب له
    if (BigInt(existing.price_nano) === priceNano && existing.pay_to === s.payTo) return { round: roundView(existing) };
    await db.from("rounds").update({ status: "expired", ended_at: new Date().toISOString() }).eq("id", existing.id).eq("status", "pending");
  }
  const code = "LUO-" + Array.from({ length: 10 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[randomInt(32)]).join("");
  const { data: r, error } = await db.from("rounds").insert({
    tg_id: user.id, mode: "paid", status: "pending", pay_code: code, pay_to: s.payTo,
    price_nano: priceNano.toString(), cells: CELLS, bombs: board.bombs, vals: board.vals,
  }).select("*").single();
  if (error) throw error;
  return { round: roundView(r) };
}

async function confirm(user: any, body: any) {
  const { data: r } = await db.from("rounds").select("*").eq("id", String(body.roundId ?? "")).eq("tg_id", user.id).maybeSingle();
  if (!r) return { error: "ROUND_NOT_FOUND" };
  if (r.status === "active") return { round: roundView(r) };
  if (r.status !== "pending") return { error: "ROUND_NOT_PENDING" };
  let tx: string | null;
  try {
    tx = await findPayment(r);
  } catch (e) {
    console.error("payment lookup failed", e);
    return { pending: true, lookupFailed: true };
  }
  if (!tx) return { pending: true };
  const { data, error } = await db.rpc("luo_activate_paid", { p_round: r.id, p_tg: user.id, p_tx: tx });
  if (error) return { error: error.code === "23505" ? "TX_ALREADY_USED" : "ACTIVATE_FAILED" };
  if (data.error) return data;
  const { data: fresh } = await db.from("rounds").select("*").eq("id", r.id).single();
  return { round: roundView(fresh) };
}

/* ---------- أوامر صاحب البوت ---------- */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function admin(action: string, body: any) {
  switch (action) {
    case "admin.overview": {
      const [{ data: stats, error }, s, { data: anns }] = await Promise.all([
        db.rpc("luo_admin_overview"),
        loadSettings(),
        db.from("announcements").select("*").order("created_at", { ascending: false }).limit(50),
      ]);
      if (error) throw error;
      const { data: claims } = await db.from("announcement_claims").select("announcement_id");
      const counts: Record<string, number> = {};
      for (const c of claims ?? []) counts[c.announcement_id] = (counts[c.announcement_id] ?? 0) + 1;
      return {
        stats, settings: s,
        announcements: (anns ?? []).map((a: any) => ({ id: a.id, kind: a.kind, title: a.title, body: a.body, button: a.button, url: a.url, freePlays: a.free_plays, active: a.active, expiresAt: a.expires_at, claims: counts[a.id] ?? 0 })),
      };
    }
    case "admin.players": {
      const sort = ["balance", "recent", "rounds", "suspect"].includes(body.sort) ? body.sort : "balance";
      const { data, error } = await db.rpc("luo_admin_players", { p_q: String(body.q ?? "").slice(0, 64).trim(), p_sort: sort, p_limit: 50, p_offset: Math.max(0, Number(body.offset) | 0) });
      if (error) throw error;
      return { players: data };
    }
    case "admin.player": {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id)) return { error: "BAD_ID" };
      const { data, error } = await db.rpc("luo_admin_player", { p_tg: id });
      if (error) throw error;
      return data;
    }
    case "admin.player.update": {
      const id = Number(body.id);
      if (!Number.isSafeInteger(id)) return { error: "BAD_ID" };
      const { data: p } = await db.from("players").select("*").eq("tg_id", id).maybeSingle();
      if (!p) return { error: "PLAYER_NOT_FOUND" };
      if (body.setBalance !== undefined) {
        const target = Number(body.setBalance);
        if (!Number.isSafeInteger(target) || target < 0 || target > 999_999_999_999) return { error: "BAD_BALANCE" };
        const { error } = await db.rpc("luo_credit", { p_tg: id, p_delta: target - Number(p.balance), p_reason: "admin", p_round: null });
        if (error) throw error;
      }
      const patch: Record<string, unknown> = {};
      if (body.addFree !== undefined) {
        const n = Number(body.addFree);
        if (!Number.isInteger(n) || Math.abs(n) > 1000) return { error: "BAD_FREE" };
        patch.free_plays = Math.max(0, p.free_plays + n);
      }
      if (typeof body.banned === "boolean") patch.banned = body.banned;
      if (body.clearFlags === true) patch.bad_requests = 0;
      if (Object.keys(patch).length) {
        const { error } = await db.from("players").update(patch).eq("tg_id", id);
        if (error) throw error;
      }
      return { ok: true };
    }
    case "admin.settings.save": {
      const s = cleanSettings(body.settings);
      if (!s) return { error: "BAD_SETTINGS" };
      const { error } = await db.from("settings").update({ data: s, updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
      return { ok: true, settings: s };
    }
    case "admin.ann.save": {
      const a = body.announcement ?? {};
      const row: Record<string, unknown> = {
        kind: a.kind, title: String(a.title ?? "").trim(), body: String(a.body ?? "").trim(), button: String(a.button ?? "").trim(),
        url: String(a.url ?? "").trim(), free_plays: a.kind === "free_game" ? Number(a.freePlays) : 0, active: a.active !== false,
        expires_at: a.expiresAt ? new Date(a.expiresAt).toISOString() : null,
      };
      if (!["news", "ad", "free_game"].includes(String(row.kind))) return { error: "BAD_KIND" };
      if (!row.title || (row.title as string).length > 80 || (row.body as string).length > 400 || (row.button as string).length > 40) return { error: "BAD_TEXT" };
      if (row.url && !/^https:\/\/[^\s"'<>]{1,290}$/.test(row.url as string)) return { error: "BAD_URL" };
      if (row.kind === "free_game" && (!Number.isInteger(row.free_plays) || (row.free_plays as number) < 1 || (row.free_plays as number) > 1000)) return { error: "BAD_FREE" };
      if (a.id !== undefined && !UUID.test(String(a.id))) return { error: "BAD_ID" };
      const q = a.id ? db.from("announcements").update(row).eq("id", a.id) : db.from("announcements").insert(row);
      const { error } = await q;
      if (error) throw error;
      return { ok: true };
    }
    case "admin.ann.delete": {
      if (!UUID.test(String(body.id))) return { error: "BAD_ID" };
      const { error } = await db.from("announcements").delete().eq("id", body.id);
      if (error) throw error;
      return { ok: true };
    }
  }
  return { error: "UNKNOWN_ACTION" };
}

/* ---------- المدخل ---------- */

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return fail("METHOD_NOT_ALLOWED", 405);
  try {
    const text = await req.text();
    if (text.length > 20_000) return fail("TOO_LARGE", 413);
    let body: any;
    try { body = JSON.parse(text); } catch { return fail("BAD_JSON", 400); }
    const action = String(body?.action ?? "");

    // توكن الاختبار يشتغل فقط ما دام توكن البوت الحقيقي غير مضبوط
    const token = Deno.env.get("BOT_TOKEN") || (await privateConfig("test_bot_token"));
    if (!token) return fail("NOT_CONFIGURED", 503);
    const user = await verifyInitData(req.headers.get("x-init-data") ?? "", token);
    if (!user) return fail("UNAUTHORIZED", 401);
    const adminIds = (await privateConfig("admin_ids")).split(",").map((x) => x.trim()).filter(Boolean);
    const isAdmin = adminIds.includes(String(user.id));

    if (action === "session") return json(await session(user, isAdmin));
    if (action.startsWith("admin.")) return isAdmin ? json(await admin(action, body)) : fail("FORBIDDEN", 403);

    const { data: me } = await db.from("players").select("banned").eq("tg_id", user.id).maybeSingle();
    if (!me) return fail("NO_SESSION");
    if (me.banned) return fail("BANNED");

    if (action === "start") return json(await start(user, body));
    if (action === "confirm") return json(await confirm(user, body));
    if (action === "open" || action === "collect" || action === "claim") {
      const id = String(action === "claim" ? body.id : body.roundId ?? "");
      if (!UUID.test(id)) return fail("BAD_ID");
      const call = action === "open"
        ? db.rpc("luo_open", { p_round: id, p_tg: user.id, p_idx: Number.isInteger(body.index) ? body.index : -1 })
        : action === "collect"
        ? db.rpc("luo_collect", { p_round: id, p_tg: user.id })
        : db.rpc("luo_claim", { p_ann: id, p_tg: user.id });
      const { data, error } = await call;
      if (error) throw error;
      return json(data);
    }
    return fail("UNKNOWN_ACTION");
  } catch (e) {
    console.error("api error", e);
    return fail("SERVER_ERROR", 500);
  }
});
