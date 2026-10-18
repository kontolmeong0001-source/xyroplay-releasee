import crypto from "node:crypto";
import ipaddr from "ipaddr.js";
import { getPool } from "../lib/database.mjs";
const ROUTES = /* @__PURE__ */ new Set(["tools/web2zip", "download/tiktok", "download/youtube", "download/spotify", "tools/cuaca", "random/meme", "canvas/fakedev-2", "canvas/iqc", "canvas/jarvis-meme", "canvas/pakustadz", "canvas/fakeml", "canvas/fakeff", "canvas/windows-quoted", "canvas/wasted", "canvas/wanted", "canvas/sudahsaatnya", "canvas/iqc-sticker", "tools/getcodehtml", "tools/reactch", "tools/web2appv2", "ai-chat/novaai", "search/searchspotify"]);
const PRIV = /* @__PURE__ */ new Set(["admin", "owner", "developer"]), ALL_ROLES = /* @__PURE__ */ new Set(["member", "reseller", "admin", "owner", "developer"]);
const sha = (x) => crypto.createHash("sha256").update(x).digest("hex");
const b64url = (n) => crypto.randomBytes(n).toString("base64url");
const ok = (data, status = 200, headers = {}) => Response.json(data, { status, headers });
const err = (error, status) => ok({ error }, status);
const validUser = (x) => typeof x === "string" && /^[A-Za-z0-9_.-]{5,32}$/.test(x);
const lower = (x) => x.toLowerCase();
function safeEqual(a, b) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
function scrypt(password, salt, N = 32768, r = 8, p = 1) {
  return new Promise((resolve, reject) => crypto.scrypt(password, salt, 64, { N, r, p, maxmem: 256 * 1024 * 1024 }, (e, k) => e ? reject(e) : resolve(k.toString("hex"))));
}
async function hashPassword(password) {
  const salt = b64url(16), key = await scrypt(password, salt);
  return `scrypt:32768:8:1$${salt}$${key}`;
}
async function checkPassword(encoded, password) {
  try {
    const m = /^scrypt:(\d+):(\d+):(\d+)\$([^$]+)\$([a-f\d]+)$/i.exec(encoded);
    if (!m) return false;
    const derived = await scrypt(password, m[4], Number(m[1]), Number(m[2]), Number(m[3]));
    return safeEqual(derived, m[5].toLowerCase());
  } catch {
    return false;
  }
}
function json(data, status = 200, extra = {}) {
  return ok(data, status, extra);
}
async function readJson(req) {
  if (!/^application\/json(?:\s*;|$)/i.test(req.headers.get("content-type") || "")) return null;
  const announced = Number(req.headers.get("content-length"));
  if (announced > 1048576) throw Object.assign(Error("large"), { status: 413 });
  const reader = req.body?.getReader();
  if (!reader) return null;
  const chunks = [];
  let size = 0;
  for (; ; ) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 1048576) {
      await reader.cancel();
      throw Object.assign(Error("large"), { status: 413 });
    }
    chunks.push(value);
  }
  try {
    return JSON.parse(new TextDecoder().decode(Buffer.concat(chunks.map((x) => Buffer.from(x)))));
  } catch {
    return null;
  }
}
const safeMessage = (e) => e?.status === 413 ? "Request too large" : "Internal server error";
function createHandler({ pool = null, fetchImpl = globalThis.fetch, lookup = async (host) => {
  const dns = await import("node:dns/promises");
  return dns.lookup(host, { all: true, verbatim: true });
}, env = process.env } = {}) {
  const origins = new Set(String(env.XYRO_ALLOWED_ORIGINS || "https://appassets.androidplatform.net").split(",").map((s) => s.trim()).filter((s) => s && s !== "*"));
  return async function handler2(req, context = {}) {
    const url = new URL(req.url), path = url.pathname, method = req.method.toUpperCase();
    let status = 200, headers = { "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" };
    if (path === "/api" || path.startsWith("/api/")) headers["Cache-Control"] = "no-store";
    if (req.headers.get("origin") && origins.has(req.headers.get("origin"))) {
      headers["Access-Control-Allow-Origin"] = req.headers.get("origin");
      headers.Vary = "Origin";
      headers["Access-Control-Allow-Headers"] = "Authorization, Content-Type";
      headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    }
    const respond = (r) => {
      for (const [k, v] of Object.entries(headers)) r.headers.set(k, v);
      return r;
    };
    if (method === "OPTIONS") return respond(new Response(null, { status: 204 }));
    if (path !== "/api" && !path.startsWith("/api/")) return respond(err("Not found", 404));
    if (!pool) return respond(err("Database unavailable", 503));
    const q = async (text, values = []) => pool.query(text, values), transaction = async (fn) => {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const value = await fn((text, values = []) => client.query(text, values));
        await client.query("COMMIT");
        return value;
      } catch (e) {
        await client.query("ROLLBACK").catch(() => {
        });
        throw e;
      } finally {
        client.release();
      }
    }, now = Date.now() / 1e3;
    const settings = async () => Object.fromEntries((await q("SELECT key,value FROM settings")).rows.map((r) => [r.key, r.value]));
    const activity = async (text) => q("INSERT INTO activity(text,at) VALUES($1,$2)", [text.slice(0, 240), (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "+00:00")]);
    const rate = async (bucket, ident, cap, seconds = 60) => {
      const t = Date.now() / 1e3;
      const r = await q(`INSERT INTO limits(bucket,ident,window_start,hits) VALUES($1,$2,$3,1) ON CONFLICT(bucket,ident) DO UPDATE SET window_start=CASE WHEN limits.window_start <= $3-$4 THEN $3 ELSE limits.window_start END, hits=CASE WHEN limits.window_start <= $3-$4 THEN 1 ELSE limits.hits+1 END RETURNING hits`, [bucket, ident, t, seconds]);
      await q("DELETE FROM sessions WHERE expires<=$1", [t]);
      await q("DELETE FROM limits WHERE window_start<$1", [t - 3600]);
      await q("DELETE FROM activity WHERE at<$1", [new Date((t - 30 * 86400) * 1e3).toISOString()]);
      return r.rows[0].hits <= cap;
    };
    const sourceIp = typeof context.ip === "string" && context.ip ? context.ip : "unknown";
    const limited = async (bucket, identity, cap, seconds) => rate(bucket, sha("xyroplay-rate-v1:" + identity), cap, seconds);
    let body;
    try {
      if (method === "POST" || method === "PUT" || method === "DELETE") {
        try {
          body = await readJson(req);
        } catch (e) {
          if (e.status === 413) return respond(err("Request too large", 413));
          throw e;
        }
      }
      if (path === "/api/health" && method === "GET") {
        await q("SELECT key FROM settings LIMIT 1");
        await q("SELECT username FROM users LIMIT 1");
        return respond(json({ status: "ok" }));
      }
      if (path === "/api/capabilities" && method === "GET") return respond(json({ online: !!env.SYNOX_API_KEY, tools: env.SYNOX_API_KEY ? [...ROUTES].sort() : [] }));
      let user = null, token = "";
      const auth = req.headers.get("authorization") || "";
      if (auth.startsWith("Bearer ")) {
        token = auth.slice(7);
        user = (await q("SELECT u.* FROM sessions s JOIN users u USING(username) WHERE s.token_hash=$1 AND s.expires>$2", [sha(token), now])).rows[0] || null;
      }
      const requireAuth = () => user ? null : err("Unauthorized", 401), requirePriv = () => !user ? err("Unauthorized", 401) : PRIV.has(user.role) ? null : err("Forbidden", 403);
      const maintenance = async () => {
        const s = await settings();
        return s.maintenance === "true" && !PRIV.has(user?.role);
      };
      const authLimit = async (b, n, ipcap = 10, ucap = 5) => !await limited(b + "-ip", sourceIp, ipcap) || !await limited(b + "-user", typeof n === "string" ? lower(n) : "", ucap);
      const endpoint = path;
      if (endpoint === "/api/auth/register" && method === "POST") {
        if (!body || typeof body !== "object" || Array.isArray(body)) return respond(err("Invalid JSON", 400));
        let { username: name, password } = body;
        if (await authLimit("auth", name)) return respond(err("Too many attempts", 429));
        if (!validUser(name) || typeof password !== "string" || password.length < 12 || password.length > 128) return respond(err("Invalid username or password", 400));
        const canonical = lower(name), code = b64url(32);
        try {
          await transaction(async (tx) => {
            await tx("INSERT INTO users(username,password_hash,role,created) VALUES($1,$2,$3,$4)", [canonical, await hashPassword(password), "member", now]);
            await tx("INSERT INTO recovery_codes VALUES($1,$2,$3)", [canonical, sha(code), now]);
            await tx("INSERT INTO activity(text,at) VALUES($1,$2)", [`Account registered: ${canonical}`, (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "+00:00")]);
          });
        } catch (e) {
          if (e.code === "23505") return respond(err("Username unavailable", 409));
          throw e;
        }
        return respond(json({ user: { username: canonical, role: "member" }, recoveryCode: code }, 201));
      }
      if (endpoint === "/api/auth/login" && method === "POST") {
        if (!body || typeof body !== "object") return respond(err("Invalid JSON", 400));
        const name = body.username, pwd = body.password;
        if (await authLimit("auth", name)) return respond(err("Too many attempts", 429));
        if (typeof name !== "string" || typeof pwd !== "string" || pwd.length > 128) return respond(err("Invalid credentials", 401));
        const raw = b64url(32);
        const result = await transaction(async (tx) => {
          const u = (await tx("SELECT * FROM users WHERE username=$1 FOR UPDATE", [lower(name)])).rows[0];
          if (!u || !await checkPassword(u.password_hash, pwd)) return err("Invalid credentials", 401);
          const state = (await tx("SELECT value FROM settings WHERE key=$1", ["maintenance"])).rows[0];
          if (state?.value === "true" && !PRIV.has(u.role)) return err("Maintenance mode", 503);
          await tx("INSERT INTO sessions VALUES($1,$2,$3)", [sha(raw), u.username, now + 3600]);
          return json({ token: raw, user: { username: u.username, role: u.role } });
        });
        return respond(result);
      }
      if (endpoint === "/api/auth/recover" && method === "POST") {
        const name = body?.username, code = body?.recoveryCode, password = body?.newPassword;
        if (await authLimit("recover", name)) return respond(err("Recovery unavailable", 429));
        if (!validUser(name) || typeof code !== "string" || code.length < 20 || code.length > 128 || typeof password !== "string" || password.length < 12 || password.length > 128) return respond(err("Recovery unavailable", 400));
        const canonical = lower(name), rotated = b64url(32), ph = await hashPassword(password);
        let recovered = false;
        await transaction(async (tx) => {
          // All credential mutations lock the user before recovery/session rows.
          const account = (await tx("SELECT username FROM users WHERE username=$1 FOR UPDATE", [canonical])).rows[0];
          if (!account) return;
          const row = (await tx("SELECT username,code_hash FROM recovery_codes WHERE username=$1 FOR UPDATE", [canonical])).rows[0];
          if (!row || !safeEqual(row.code_hash, sha(code))) return;
          await tx("UPDATE users SET password_hash=$1 WHERE username=$2", [ph, canonical]);
          await tx("DELETE FROM sessions WHERE username=$1", [canonical]);
          await tx("UPDATE recovery_codes SET code_hash=$1,created=$2 WHERE username=$3", [sha(rotated), now, canonical]);
          await tx("INSERT INTO activity(text,at) VALUES($1,$2)", ["Account password recovered", (/* @__PURE__ */ new Date()).toISOString().replace(/\.\d{3}Z$/, "+00:00")]);
          recovered = true;
        });
        if (!recovered) return respond(err("Recovery unavailable", 400));
        return respond(json({ ok: true, recoveryCode: rotated }));
      }
      if (endpoint === "/api/auth/recovery-code" && method === "POST") {
        if (!user) return respond(err("Unauthorized", 401));
        if (!await limited("recovery-rotate-user", lower(user.username), 5) || !await limited("recovery-rotate-ip", sourceIp, 10)) return respond(err("Invalid credentials", 401));
        if (typeof body?.password !== "string" || body.password.length > 128) return respond(err("Invalid credentials", 401));
        const code = b64url(32);
        const result = await transaction(async (tx) => {
          const account = (await tx("SELECT * FROM users WHERE username=$1 FOR UPDATE", [user.username])).rows[0];
          const session = (await tx("SELECT token_hash FROM sessions WHERE token_hash=$1 AND expires>$2", [sha(token), Date.now()/1000])).rows[0];
          if (!account || !session || !await checkPassword(account.password_hash, body.password)) return err("Invalid credentials", 401);
          await tx("INSERT INTO recovery_codes VALUES($1,$2,$3) ON CONFLICT(username) DO UPDATE SET code_hash=EXCLUDED.code_hash,created=EXCLUDED.created", [user.username, sha(code), now]);
          return json({ recoveryCode: code });
        });
        return respond(result);
      }
      if (endpoint === "/api/auth/me" && method === "GET") {
        if (!user) return respond(err("Unauthorized", 401));
        return respond(json({ user: { username: user.username, role: user.role } }));
      }
      if (endpoint === "/api/auth/logout" && method === "POST") {
        if (!user) return respond(err("Unauthorized", 401));
        await q("DELETE FROM sessions WHERE token_hash=$1", [sha(token)]);
        return respond(json({ ok: true }));
      }
      if (endpoint === "/api/auth/account" && method === "DELETE") {
        if (!user) return respond(err("Unauthorized", 401));
        if (!await limited("delete-user", lower(user.username), 5) || typeof body?.password !== "string" || body.password.length > 128) return respond(err("Invalid credentials", 401));
        return respond(await transaction(async (tx) => {
          const account = (await tx("SELECT * FROM users WHERE username=$1 FOR UPDATE", [user.username])).rows[0];
          const session = (await tx("SELECT token_hash FROM sessions WHERE token_hash=$1 AND expires>$2", [sha(token), Date.now()/1000])).rows[0];
          if (!account || !session || !await checkPassword(account.password_hash, body.password)) return err("Invalid credentials", 401);
          await tx("DELETE FROM users WHERE username=$1", [account.username]);
          return json({ ok: true });
        }));
      }
      if (endpoint === "/api/account/delete" && method === "POST") {
        const name = body?.username, pwd = body?.password;
        if (await authLimit("delete-public", name)) return respond(err("Invalid credentials", 401));
        if (typeof name !== "string" || typeof pwd !== "string" || pwd.length > 128) return respond(err("Invalid credentials", 401));
        return respond(await transaction(async (tx) => {
          const account = (await tx("SELECT * FROM users WHERE username=$1 FOR UPDATE", [lower(name)])).rows[0];
          if (!account || !await checkPassword(account.password_hash, pwd)) return err("Invalid credentials", 401);
          await tx("DELETE FROM users WHERE username=$1", [account.username]);
          return json({ ok: true });
        }));
      }
      if (endpoint === "/api/admin/users" && method === "GET") {
        if (!PRIV.has(user?.role)) return respond(requirePriv());
        return respond(json({ users: (await q("SELECT username,role FROM users ORDER BY username")).rows }));
      }
      if (endpoint === "/api/admin/users" && method === "POST") {
        if (!PRIV.has(user?.role)) return respond(requirePriv());
        const { username: name, password: pwd, role } = body || {};
        if (!validUser(name) || typeof pwd !== "string" || pwd.length < 12 || pwd.length > 128 || !ALL_ROLES.has(role)) return respond(err("Invalid user fields", 400));
        if (["admin", "owner", "developer"].includes(role) && !["owner", "developer"].includes(user.role)) return respond(err("Forbidden", 403));
        const canonical = lower(name);
        try {
          await q("INSERT INTO users VALUES($1,$2,$3,$4)", [canonical, await hashPassword(pwd), role, now]);
          await activity(`User created: ${canonical} (${role})`);
        } catch (e) {
          if (e.code === "23505") return respond(err("Username unavailable", 409));
          throw e;
        }
        return respond(json({ user: { username: canonical, role } }, 201));
      }
      const deleteMatch = endpoint.match(/^\/api\/admin\/users\/([^/]+)$/);
      if (deleteMatch && method === "DELETE") {
        if (!PRIV.has(user?.role)) return respond(requirePriv());
        const name = decodeURIComponent(deleteMatch[1]), target = (await q("SELECT * FROM users WHERE username=$1", [lower(name)])).rows[0];
        if (!target) return respond(err("Not found", 404));
        if (target.username === user.username || ["owner", "developer"].includes(target.role) || target.role === "admin" && !["owner", "developer"].includes(user.role)) return respond(err("Forbidden", 403));
        await q("DELETE FROM users WHERE username=$1", [target.username]);
        await activity(`User deleted: ${target.username}`);
        return respond(json({ ok: true }));
      }
      if (endpoint === "/api/admin/state" && method === "GET") {
        if (!PRIV.has(user?.role)) return respond(requirePriv());
        const s = await settings();
        return respond(json({ notice: s.notice || "", maintenance: s.maintenance === "true", siteName: s.siteName || "XyroPlay", activity: (await q("SELECT text,at FROM activity ORDER BY id DESC LIMIT 100")).rows }));
      }
      if (endpoint === "/api/admin/state" && method === "PUT") {
        if (!PRIV.has(user?.role)) return respond(requirePriv());
        const known = /* @__PURE__ */ new Set(["notice", "maintenance", "siteName"]);
        if (!body || typeof body !== "object" || Array.isArray(body) || !Object.keys(body).length || Object.keys(body).some((k) => !known.has(k)) || "notice" in body && (typeof body.notice !== "string" || body.notice.length > 1e3) || "maintenance" in body && typeof body.maintenance !== "boolean" || "siteName" in body && (typeof body.siteName !== "string" || body.siteName.length < 1 || body.siteName.length > 40)) return respond(err("Invalid state", 400));
        const s = await settings();
        for (const [k, v0] of Object.entries(body)) {
          const v = k === "maintenance" ? String(v0) : v0;
          await q("INSERT INTO settings VALUES($1,$2) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value", [k, v]);
          s[k] = v;
        }
        await activity(`Site state updated by ${user.username}`);
        return respond(json({ notice: s.notice || "", maintenance: s.maintenance === "true", siteName: s.siteName || "XyroPlay" }));
      }
      if (endpoint === "/api/state" && method === "GET") {
        const s = await settings();
        return respond(json({ notice: s.notice || "", maintenance: s.maintenance === "true", siteName: s.siteName || "XyroPlay" }));
      }
      if (endpoint.startsWith("/api/proxy/") && method === "GET") {
        if (!user) return respond(err("Unauthorized", 401));
        if (!env.SYNOX_API_KEY) return respond(err("Proxy unavailable", 503));
        if (await maintenance()) return respond(err("Maintenance mode", 503));
        if (!await limited("proxy-user", lower(user.username), 30) || !await limited("proxy-ip", sourceIp, 60)) return respond(err("Too many requests", 429));
        const route = endpoint.slice("/api/proxy/".length);
        if (!ROUTES.has(route)) return respond(err("Route not allowed", 404));
        const params = new URLSearchParams();
        let count = 0;
        for (const [k, v] of url.searchParams) {
          if (k.length > 80 || v.length > 2048) return respond(err("Invalid parameter", 400));
          if (k.toLowerCase() === "apikey") continue;
          if (["url", "link", "uri", "website", "target", "urlfoto", "avatar", "image", "photo", "icon"].includes(k.toLowerCase()) && v) {
            try {
              const u = new URL(v);
              if (u.protocol !== "https:" || !u.hostname || u.username || u.password || u.port && u.port !== "443") throw Error();
              const addresses = await lookup(u.hostname);
              if (!addresses.length) throw Error();
              for (const item of addresses) {
                const ip = typeof item === "string" ? item : item.address;
                let addr = ipaddr.parse(ip);
                if (addr.kind() === "ipv6" && addr.isIPv4MappedAddress()) addr = addr.toIPv4Address();
                if (addr.range() !== "unicast") throw Error();
              }
            } catch {
              return respond(err("Invalid URL parameter", 400));
            }
          }
          params.append(k, v);
          count++;
        }
        if (count > 30) return respond(err("Too many parameters", 400));
        params.set("apikey", env.SYNOX_API_KEY);
        const target = `https://api.synoxcloud.xyz/${route}?${params}`;
        try {
          const ac = new AbortController(), timer = setTimeout(() => ac.abort(), 2e4);
          let upstream;
          try {
            upstream = await fetchImpl(target, { method: "GET", redirect: "manual", signal: ac.signal });
            if (upstream.status < 200 || upstream.status >= 300) return respond(err("Upstream request failed", 502));
            const ctype = (upstream.headers.get("content-type") || "application/octet-stream").split(";")[0].toLowerCase();
            if (ctype === "image/svg+xml" || !["application/json", "text/plain", "application/octet-stream", "application/zip", "application/vnd.android.package-archive"].includes(ctype) && !["image/", "audio/", "video/"].some((p) => ctype.startsWith(p))) return respond(err("Upstream response type not allowed", 502));
            const reader = upstream.body?.getReader(), chunks = [];
            let size = 0;
            if (reader) for (; ; ) {
              const { done, value } = await reader.read();
              if (done) break;
              size += value.byteLength;
              if (size > 4 * 1024 * 1024) {
                await reader.cancel();
                return respond(err("Upstream response too large", 502));
              }
              chunks.push(Buffer.from(value));
            }
            let out = Buffer.concat(chunks);
            if (ctype === "application/json" || ctype.startsWith("text/")) out = Buffer.from(out.toString("utf8").split(env.SYNOX_API_KEY).join("[REDACTED]"));
            const rh = { "Content-Type": ctype, "Content-Disposition": ["application/zip", "application/vnd.android.package-archive"].includes(ctype) ? "attachment" : "inline", "Cache-Control": "no-store" };
            return respond(new Response(out, { status: upstream.status, headers: rh }));
          } finally {
            clearTimeout(timer);
          }
        } catch {
          return respond(err("Upstream unavailable", 502));
        }
      }
      return respond(err("Not found", 404));
    } catch (e) {
      return respond(err(safeMessage(e), e?.status || 500));
    }
  };
}
async function handler(request, context) {
  try {
    return await createHandler({ pool: await getPool() })(request, context);
  } catch {
    return Response.json({ error: "Database unavailable" }, { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY", "Referrer-Policy": "no-referrer" } });
  }
}
const config = { path: ["/api", "/api/*"] };
export {
  config,
  createHandler,
  handler as default
};
