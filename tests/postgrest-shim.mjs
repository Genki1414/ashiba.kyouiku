/* PostgREST 互換の最小サーバ（検証用）。
   本物の Supabase へ接続できない環境で、アプリの Supabase 呼び出し
   （テーブル名・列名・RPC名と引数名）が実スキーマと合っているかを
   ローカルの PostgreSQL に対して確かめるために使う。

   本物の PostgREST ではないので、これが通ったことは
   「アプリのクエリがスキーマと矛盾しない」ことの確認であって、
   Supabase 本番の完全な代用ではない。

   使い方: node tests/postgrest-shim.mjs <port> <postgres接続URL> */
import { createServer } from "node:http";
import pg from "pg";

const port = Number(process.argv[2] ?? 54321);
const conn = process.argv[3];
const pool = new pg.Pool({ connectionString: conn });

const ident = (s) => {
  if (!/^[a-z_][a-z0-9_]*$/i.test(s)) throw new Error(`不正な識別子: ${s}`);
  return `"${s}"`;
};

const SKIP = ["select", "on_conflict", "columns", "order", "limit", "offset"];

/** in.("a","b") の中身を分ける。PostgREST は特別な字が入るものを " で囲む */
function splitIn(src) {
  const out = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (q) {
      if (c === "\\") { cur += src[++i] ?? ""; continue; }
      if (c === '"') { q = false; continue; }
      cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") { out.push(cur); cur = ""; }
    else cur += c;
  }
  if (cur !== "" || src.endsWith(",")) out.push(cur);
  return out;
}

/** ?col=eq.value / is.null / in.(…) 形式のフィルタを WHERE へ */
function whereFrom(params, start) {
  const parts = [];
  const vals = [];
  const ph = (v) => { vals.push(v); return `$${start + vals.length - 1}`; };
  for (const [k, v] of params) {
    if (SKIP.includes(k)) continue;
    let m;
    if ((m = /^eq\.(.*)$/s.exec(v))) {
      parts.push(`${ident(k)} = ${ph(m[1])}`);
    } else if ((m = /^is\.(.*)$/s.exec(v))) {
      const t = m[1];
      if (t !== "null" && t !== "true" && t !== "false") throw new Error(`未対応の is: ${t}`);
      parts.push(`${ident(k)} is ${t}`);
    } else if ((m = /^in\.\((.*)\)$/s.exec(v))) {
      const items = m[1] === "" ? [] : splitIn(m[1]);
      /* 空の in は「どれにも当たらない」。ここを落とすと全件返ってしまう */
      parts.push(items.length ? `${ident(k)} in (${items.map(ph).join(", ")})` : "false");
    } else if ((m = /^(gte|lte|gt|lt)\.(.*)$/s.exec(v))) {
      /* 期間で絞る（照合の記録を「直近◯日ぶん」で読むため） */
      const op = { gte: ">=", lte: "<=", gt: ">", lt: "<" }[m[1]];
      parts.push(`${ident(k)} ${op} ${ph(m[2])}`);
    } else {
      throw new Error(`未対応のフィルタ: ${k}=${v}`);
    }
  }
  return { sql: parts.length ? ` where ${parts.join(" and ")}` : "", vals };
}

/** ?order=col.asc / col.desc と ?limit=n */
function tailFrom(u) {
  let sql = "";
  const order = u.searchParams.get("order");
  if (order) {
    const cols = order.split(",").map((o) => {
      const [c, ...rest] = o.split(".");
      const dir = rest.includes("desc") ? "desc" : "asc";
      const nulls = rest.includes("nullsfirst") ? " nulls first"
        : rest.includes("nullslast") ? " nulls last" : "";
      return `${ident(c)} ${dir}${nulls}`;
    });
    sql += ` order by ${cols.join(", ")}`;
  }
  const limit = u.searchParams.get("limit");
  if (limit) {
    if (!/^\d+$/.test(limit)) throw new Error(`不正な limit: ${limit}`);
    sql += ` limit ${limit}`;
  }
  return sql;
}

const selectList = (sel) =>
  !sel || sel === "*" ? "*" : sel.split(",").map((s) => ident(s.trim())).join(", ");

/* jsonb の列には JSON 文字列で渡す。
   そのまま配列を渡すと pg が Postgres の配列として送ってしまう */
const val = (v) => (v !== null && typeof v === "object" ? JSON.stringify(v) : v);

const body = (req) =>
  new Promise((res) => {
    let b = "";
    req.on("data", (c) => (b += c));
    req.on("end", () => res(b ? JSON.parse(b) : null));
  });

const server = createServer(async (req, res) => {
  const u = new URL(req.url, "http://x");
  const send = (code, data, headers = {}) => {
    const payload = data === undefined ? "" : JSON.stringify(data);
    res.writeHead(code, { "Content-Type": "application/json", ...headers });
    res.end(payload);
  };

  const m = /^\/rest\/v1\/(rpc\/)?([a-z_]+)$/.exec(u.pathname);
  if (!m) return send(404, { message: `未対応のパス: ${u.pathname}` });
  const [, isRpc, name] = m;
  const client = await pool.connect();
  try {
    await client.query("begin");
    // API ルートは service_role 鍵で呼ぶ想定。shim の auth.role() をそれに合わせる
    await client.query("select set_config('test.role', 'service_role', true)");

    if (isRpc) {
      const args = (await body(req)) ?? {};
      const keys = Object.keys(args);
      const sql = `select public.${ident(name)}(${keys
        .map((k, i) => `${ident(k)} => $${i + 1}`)
        .join(", ")}) as result`;
      const r = await client.query(sql, keys.map((k) => args[k]));
      await client.query("commit");
      return send(200, r.rows[0].result ?? null);
    }

    const params = [...u.searchParams.entries()];
    const single = (req.headers.accept ?? "").includes("vnd.pgrst.object");

    if (req.method === "GET" || req.method === "HEAD") {
      const w = whereFrom(params, 1);
      const sel = selectList(u.searchParams.get("select"));
      const r = await client.query(
        `select ${sel} from public.${ident(name)}${w.sql}${tailFrom(u)}`,
        w.vals,
      );
      await client.query("commit");
      const wantCount = (req.headers.prefer ?? "").includes("count=exact");
      const headers = wantCount
        ? { "Content-Range": `0-${Math.max(0, r.rowCount - 1)}/${r.rowCount}` }
        : {};
      if (req.method === "HEAD") {
        res.writeHead(200, { "Content-Type": "application/json", ...headers });
        return res.end();
      }
      if (single) {
        if (r.rowCount === 0)
          return send(406, { code: "PGRST116", message: "0 rows", details: "0 rows" }, headers);
        return send(200, r.rows[0], headers);
      }
      return send(200, r.rows, headers);
    }

    if (req.method === "POST") {
      const rows = await body(req);
      const list = Array.isArray(rows) ? rows : [rows];
      const cols = Object.keys(list[0]);
      const values = list
        .map((_, ri) => `(${cols.map((_, ci) => `$${ri * cols.length + ci + 1}`).join(", ")})`)
        .join(", ");
      const flat = list.flatMap((row) => cols.map((c) => val(row[c])));
      const onConflict = u.searchParams.get("on_conflict");
      const upsert = onConflict
        ? ` on conflict (${onConflict.split(",").map(ident).join(", ")}) do update set ${cols
            .filter((c) => !onConflict.split(",").includes(c))
            .map((c) => `${ident(c)} = excluded.${ident(c)}`)
            .join(", ")}`
        : "";
      const r = await client.query(
        `insert into public.${ident(name)} (${cols.map(ident).join(", ")}) values ${values}${upsert} returning *`,
        flat,
      );
      await client.query("commit");
      /* .single() / .maybeSingle() は1行だけを期待する */
      if (single) return send(201, r.rows[0] ?? null);
      return send(201, r.rows);
    }

    if (req.method === "PATCH") {
      const patch = await body(req);
      const cols = Object.keys(patch);
      const w = whereFrom(params, cols.length + 1);
      const r = await client.query(
        `update public.${ident(name)} set ${cols
          .map((c, i) => `${ident(c)} = $${i + 1}`)
          .join(", ")}${w.sql} returning *`,
        [...cols.map((c) => val(patch[c])), ...w.vals],
      );
      await client.query("commit");
      if (single) return send(200, r.rows[0] ?? null);
      return send(200, r.rows);
    }

    if (req.method === "DELETE") {
      /* アプリが消すのは、受講コードの引き換えを取り消すときだけ
         （その人の学科と実務の記録をやり直しにする） */
      const w = whereFrom(params, 1);
      const r = await client.query(
        `delete from public.${ident(name)}${w.sql} returning *`,
        w.vals,
      );
      await client.query("commit");
      if (single) return send(200, r.rows[0] ?? null);
      return send(200, r.rows);
    }

    await client.query("rollback");
    return send(405, { message: `未対応のメソッド: ${req.method}` });
  } catch (e) {
    await client.query("rollback").catch(() => {});
    // PostgREST 風のエラー形
    return send(400, { message: e.message, code: e.code ?? "SHIM", details: null, hint: null });
  } finally {
    client.release();
  }
});

server.listen(port, () => console.log(`shim listening on ${port}`));
