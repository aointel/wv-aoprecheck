import { pool } from "./db";

type QueryMode = "select" | "update" | "insert" | "upsert" | "delete";
type OrderBy = { column: string; ascending: boolean };
const knownColumns = new Set<string>();
let baseReady = false;

async function ensureBaseTable(): Promise<void> {
  if (baseReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS masterlead (
      id BIGSERIAL PRIMARY KEY,
      taalk_lead_id TEXT,
      phone TEXT,
      first_name TEXT,
      last_name TEXT,
      cn_email TEXT,
      cnresolution TEXT,
      last_contacted TIMESTAMPTZ,
      webhook_sent_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
  // Some environments already had `id BIGINT PRIMARY KEY` without a default sequence.
  // Ensure inserts can succeed even when callers omit `id`.
  try {
    await pool.query(`
      DO $$
      DECLARE
        id_data_type TEXT;
        has_default BOOLEAN;
        current_seq TEXT;
        next_seed BIGINT;
      BEGIN
        SELECT data_type, (column_default IS NOT NULL), pg_get_serial_sequence('masterlead', 'id')
        INTO id_data_type, has_default, current_seq
        FROM information_schema.columns
        WHERE table_name = 'masterlead' AND column_name = 'id'
        LIMIT 1;

        IF id_data_type IN ('bigint', 'integer', 'smallint') THEN
          IF current_seq IS NULL THEN
            CREATE SEQUENCE IF NOT EXISTS masterlead_id_seq;
            ALTER SEQUENCE masterlead_id_seq OWNED BY masterlead.id;
            ALTER TABLE masterlead ALTER COLUMN id SET DEFAULT nextval('masterlead_id_seq');
            SELECT COALESCE(MAX(id), 0) + 1 INTO next_seed FROM masterlead;
            PERFORM setval('masterlead_id_seq', next_seed, false);
          ELSIF has_default IS FALSE THEN
            EXECUTE format('ALTER TABLE masterlead ALTER COLUMN id SET DEFAULT nextval(%L)', current_seq);
          END IF;
        END IF;
      END $$;
    `);
  } catch (error) {
    console.warn("⚠️ Unable to enforce masterlead.id default sequence:", error);
  }
  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_name = 'masterlead'`,
  );
  for (const row of columns.rows) knownColumns.add(String(row.column_name || "").toLowerCase());
  baseReady = true;
}

async function ensureColumns(columns: string[]): Promise<void> {
  await ensureBaseTable();
  for (const col of columns.map((c) => normalizeColumn(c)).filter(Boolean)) {
    if (knownColumns.has(col)) continue;
    await pool.query(`ALTER TABLE masterlead ADD COLUMN IF NOT EXISTS "${col}" TEXT`);
    knownColumns.add(col);
  }
}

function normalizeColumn(column: string): string {
  const clean = String(column || "").trim().replace(/^"+|"+$/g, "");
  if (!clean) return clean;
  if (clean.includes("_")) return clean;
  return clean.toLowerCase();
}

function splitColumns(columns: string): string[] {
  return String(columns || "*")
    .split(",")
    .map((c) => normalizeColumn(c.trim()))
    .filter(Boolean);
}

function parseOrExpr(expr: string): string[] {
  const source = String(expr || "");
  const parts: string[] = [];
  let current = "";
  let depth = 0;

  for (let i = 0; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "(") depth += 1;
    if (ch === ")" && depth > 0) depth -= 1;

    if (ch === "," && depth === 0) {
      const piece = current.trim();
      if (piece) parts.push(piece);
      current = "";
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) parts.push(tail);
  return parts;
}

function parseInList(raw: string): string[] {
  const trimmed = String(raw || "").trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((x) => x.trim()).filter(Boolean);
}

class LocalMasterleadBuilder implements PromiseLike<any> {
  private mode: QueryMode = "select";
  private selectColumns = "*";
  private selectHead = false;
  private selectCount: "exact" | null = null;
  private filters: Array<{ sql: string; params: unknown[] }> = [];
  private orderBys: OrderBy[] = [];
  private limitValue: number | null = null;
  private offsetValue: number | null = null;
  private singleType: "single" | "maybeSingle" | null = null;
  private updatePayload: Record<string, unknown> | null = null;
  private insertPayload: Record<string, unknown>[] = [];
  private upsertConflict = "id";
  private upsertIgnoreDuplicates = false;
  private referencedColumns = new Set<string>();

  private addFilter(sql: string, ...params: unknown[]): this {
    this.filters.push({ sql, params });
    return this;
  }

  private whereClause(startIndex = 1): { sql: string; values: unknown[]; nextIndex: number } {
    const values: unknown[] = [];
    let idx = startIndex;
    const parts = this.filters.map((f) => {
      const sql = f.sql.replace(/\?/g, () => `$${idx++}`);
      values.push(...f.params);
      return `(${sql})`;
    });
    return {
      sql: parts.length ? ` WHERE ${parts.join(" AND ")}` : "",
      values,
      nextIndex: idx,
    };
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this {
    this.mode = this.mode === "update" || this.mode === "insert" || this.mode === "upsert" || this.mode === "delete"
      ? this.mode
      : "select";
    this.selectColumns = columns || "*";
    if (this.selectColumns !== "*") {
      splitColumns(this.selectColumns).forEach((c) => this.referencedColumns.add(c));
    }
    this.selectCount = options?.count || null;
    this.selectHead = !!options?.head;
    return this;
  }

  eq(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') = COALESCE(?::text, '')`, value);
  }

  neq(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') <> COALESCE(?::text, '')`, value);
  }

  gte(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') >= COALESCE(?::text, '')`, value);
  }

  gt(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') > COALESCE(?::text, '')`, value);
  }

  lte(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') <= COALESCE(?::text, '')`, value);
  }

  lt(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') < COALESCE(?::text, '')`, value);
  }

  ilike(column: string, pattern: string): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE("${col}"::text, '') ILIKE COALESCE(?::text, '')`, pattern);
  }

  in(column: string, values: unknown[]): this {
    if (!Array.isArray(values) || !values.length) return this.addFilter("1=0");
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    const placeholders = values.map(() => "?").join(", ");
    return this.addFilter(`COALESCE("${col}"::text, '') IN (${placeholders})`, ...values.map((v) => String(v ?? "")));
  }

  is(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    if (value === null || String(value).toLowerCase() === "null") {
      return this.addFilter(`"${col}" IS NULL`);
    }
    if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE("${col}"::text, '')) = 'true'`);
    if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE("${col}"::text, '')) = 'false'`);
    return this.addFilter(`"${col}" IS NOT DISTINCT FROM ?`, value);
  }

  not(column: string, operator: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    const op = String(operator || "").toLowerCase();
    if (op === "is") {
      if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`"${col}" IS NOT NULL`);
      if (String(value).toLowerCase() === "true") return this.addFilter(`"${col}" IS NOT TRUE`);
      if (String(value).toLowerCase() === "false") return this.addFilter(`"${col}" IS NOT FALSE`);
    }
    if (op === "in") {
      const items = parseInList(String(value || ""));
      if (!items.length) return this;
      const placeholders = items.map(() => "?").join(", ");
      return this.addFilter(`COALESCE("${col}"::text, '') NOT IN (${placeholders})`, ...items);
    }
    return this.addFilter(`NOT (COALESCE("${col}"::text, '') = COALESCE(?::text, ''))`, value);
  }

  or(expr: string): this {
    const parts = parseOrExpr(expr);
    if (!parts.length) return this;
    const sqlParts: string[] = [];
    const vals: unknown[] = [];
    for (const part of parts) {
      const segs = part.split(".");
      const col = normalizeColumn(segs[0] || "");
      this.referencedColumns.add(col);
      const op = String(segs[1] || "eq").toLowerCase();
      const raw = segs.slice(2).join(".");
      const value = raw === "null" ? null : raw;
      if (!col) continue;
      if (op === "eq") {
        sqlParts.push(`COALESCE("${col}"::text, '') = COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "ilike") {
        sqlParts.push(`COALESCE("${col}"::text, '') ILIKE COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "is") {
        if (value === null) sqlParts.push(`"${col}" IS NULL`);
        else if (String(value).toLowerCase() === "true") sqlParts.push(`"${col}" IS TRUE`);
        else if (String(value).toLowerCase() === "false") sqlParts.push(`"${col}" IS FALSE`);
      } else if (op === "neq") {
        sqlParts.push(`COALESCE("${col}"::text, '') <> COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "in") {
        const items = parseInList(String(value || ""));
        if (!items.length) continue;
        const placeholders = items.map(() => "?").join(", ");
        sqlParts.push(`COALESCE("${col}"::text, '') IN (${placeholders})`);
        vals.push(...items);
      } else if (op === "gt") {
        sqlParts.push(`COALESCE("${col}"::text, '') > COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "gte") {
        sqlParts.push(`COALESCE("${col}"::text, '') >= COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "lt") {
        sqlParts.push(`COALESCE("${col}"::text, '') < COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "lte") {
        sqlParts.push(`COALESCE("${col}"::text, '') <= COALESCE(?::text, '')`);
        vals.push(value);
      }
    }
    if (!sqlParts.length) return this;
    return this.addFilter(sqlParts.join(" OR "), ...vals);
  }

  order(column: string, options?: { ascending?: boolean }): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    this.orderBys.push({ column: col, ascending: options?.ascending !== false });
    return this;
  }

  limit(count: number): this {
    this.limitValue = Math.max(0, Number(count || 0));
    return this;
  }

  range(from: number, to: number): this {
    const start = Math.max(0, Number(from || 0));
    const end = Math.max(start, Number(to || start));
    this.offsetValue = start;
    this.limitValue = end - start + 1;
    return this;
  }

  single(): Promise<any> {
    this.singleType = "single";
    return this.execute();
  }

  maybeSingle(): Promise<any> {
    this.singleType = "maybeSingle";
    return this.execute();
  }

  update(payload: Record<string, unknown>): this {
    this.mode = "update";
    this.updatePayload = payload || {};
    Object.keys(this.updatePayload).forEach((k) => this.referencedColumns.add(normalizeColumn(k)));
    return this;
  }

  insert(payload: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mode = "insert";
    this.insertPayload = Array.isArray(payload) ? payload : [payload];
    this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn(k))));
    return this;
  }

  upsert(
    payload: Record<string, unknown> | Record<string, unknown>[],
    options?: { onConflict?: string; ignoreDuplicates?: boolean },
  ): this {
    this.mode = "upsert";
    this.insertPayload = Array.isArray(payload) ? payload : [payload];
    this.insertPayload.forEach((row) => Object.keys(row || {}).forEach((k) => this.referencedColumns.add(normalizeColumn(k))));
    this.upsertConflict = normalizeColumn(options?.onConflict || "id");
    this.referencedColumns.add(this.upsertConflict);
    this.upsertIgnoreDuplicates = !!options?.ignoreDuplicates;
    return this;
  }

  delete(): this {
    this.mode = "delete";
    return this;
  }

  then<TResult1 = any, TResult2 = never>(
    onfulfilled?: ((value: any) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  private async executeSelect(): Promise<any> {
    await ensureColumns([...this.referencedColumns]);
    const cols = this.selectColumns === "*" ? "*" : splitColumns(this.selectColumns).map((c) => `"${c}"`).join(", ");
    const where = this.whereClause(1);
    const order = this.orderBys.length
      ? ` ORDER BY ${this.orderBys.map((o) => `"${o.column}" ${o.ascending ? "ASC" : "DESC"}`).join(", ")}`
      : "";
    const limit = this.limitValue != null ? ` LIMIT ${this.limitValue}` : "";
    const offset = this.offsetValue != null ? ` OFFSET ${this.offsetValue}` : "";

    let count: number | null = null;
    if (this.selectCount === "exact") {
      const c = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM masterlead${where.sql}`,
        where.values,
      );
      count = Number(c.rows[0]?.count || 0);
    }

    if (this.selectHead) {
      return { data: null, error: null, count };
    }

    const result = await pool.query(
      `SELECT ${cols} FROM masterlead${where.sql}${order}${limit}${offset}`,
      where.values,
    );

    if (this.singleType === "single") {
      if ((result.rowCount || 0) !== 1) {
        return { data: null, error: { message: "Expected single row" }, count };
      }
      return { data: result.rows[0], error: null, count };
    }
    if (this.singleType === "maybeSingle") {
      return { data: result.rows[0] || null, error: null, count };
    }
    return { data: result.rows, error: null, count };
  }

  private buildInsertRows(): { columns: string[]; rows: unknown[][] } {
    const rows = this.insertPayload.filter(Boolean);
    const columnSet = new Set<string>();
    for (const row of rows) {
      Object.keys(row).forEach((k) => columnSet.add(normalizeColumn(k)));
    }
    const columns = [...columnSet];
    const values = rows.map((row) => columns.map((c) => (row as any)[c]));
    return { columns, rows: values };
  }

  private async executeUpdateLike(): Promise<any> {
    await ensureColumns([...this.referencedColumns]);
    if (!this.updatePayload) return { data: null, error: { message: "Missing update payload" }, count: null };
    const entries = Object.entries(this.updatePayload);
    if (!entries.length) return { data: null, error: null, count: 0 };
    const setSql = entries.map(([k], i) => `"${normalizeColumn(k)}" = $${i + 1}`).join(", ");
    const setVals = entries.map(([, v]) => v);
    const where = this.whereClause(setVals.length + 1);
    const returning = this.selectColumns && this.selectColumns !== "*"
      ? splitColumns(this.selectColumns).map((c) => `"${c}"`).join(", ")
      : "*";
    const wantsData = this.selectColumns !== "*";
    const sql = `UPDATE masterlead SET ${setSql}${where.sql}${wantsData ? ` RETURNING ${returning}` : ""}`;
    const result = await pool.query(sql, [...setVals, ...where.values]);
    return { data: wantsData ? result.rows : null, error: null, count: result.rowCount || 0 };
  }

  private async executeInsertLike(): Promise<any> {
    await ensureColumns([...this.referencedColumns]);
    const { columns, rows } = this.buildInsertRows();
    if (!columns.length || !rows.length) return { data: null, error: null, count: 0 };
    const values: unknown[] = [];
    let idx = 1;
    const rowSql = rows
      .map((row) => {
        const ph = row.map(() => `$${idx++}`);
        values.push(...row);
        return `(${ph.join(", ")})`;
      })
      .join(", ");
    const quotedCols = columns.map((c) => `"${c}"`).join(", ");

    let conflictSql = "";
    if (this.mode === "upsert") {
      if (this.upsertIgnoreDuplicates) {
        conflictSql = ` ON CONFLICT ("${this.upsertConflict}") DO NOTHING`;
      } else {
        const updates = columns
          .filter((c) => c !== this.upsertConflict)
          .map((c) => `"${c}" = EXCLUDED."${c}"`)
          .join(", ");
        conflictSql = ` ON CONFLICT ("${this.upsertConflict}") DO UPDATE SET ${updates || `"${this.upsertConflict}" = EXCLUDED."${this.upsertConflict}"`}`;
      }
    }

    const returning = this.selectColumns && this.selectColumns !== "*"
      ? splitColumns(this.selectColumns).map((c) => `"${c}"`).join(", ")
      : "*";
    const wantsData = this.selectColumns !== "*";
    const sql = `INSERT INTO masterlead (${quotedCols}) VALUES ${rowSql}${conflictSql}${wantsData ? ` RETURNING ${returning}` : ""}`;
    const result = await pool.query(sql, values);
    const data = wantsData ? (this.singleType ? result.rows[0] || null : result.rows) : null;
    return { data, error: null, count: result.rowCount || 0 };
  }

  private async executeDelete(): Promise<any> {
    await ensureColumns([...this.referencedColumns]);
    const where = this.whereClause(1);
    const sql = `DELETE FROM masterlead${where.sql}`;
    const result = await pool.query(sql, where.values);
    return { data: null, error: null, count: result.rowCount || 0 };
  }

  async execute(): Promise<any> {
    try {
      if (this.mode === "select") return await this.executeSelect();
      if (this.mode === "update") return await this.executeUpdateLike();
      if (this.mode === "insert" || this.mode === "upsert") return await this.executeInsertLike();
      if (this.mode === "delete") return await this.executeDelete();
      return { data: null, error: null, count: 0 };
    } catch (error: any) {
      return { data: null, error: { message: error?.message || String(error) }, count: null };
    }
  }
}

/**
 * Canonical **server/worker** access to `masterlead` (Postgres `DATABASE_URL`).
 * The browser uses **`/api/masterlead/*`** only; `resolveServiceUrl` / `apiRequest` route those to the data deploy when Connect is segmented — do not import this module from client code.
 */
export const masterleadClient = {
  from(table: string): LocalMasterleadBuilder {
    if (String(table || "").toLowerCase() !== "masterlead") {
      throw new Error("masterleadClient only supports the masterlead table");
    }
    return new LocalMasterleadBuilder();
  },
};

/** Same row shape as Supabase RPC `get_masterlead_by_phone_last10` (normalized last-10 on `phone`). */
export async function getMasterleadByPhoneLast10(last10: string): Promise<Record<string, unknown> | null> {
  const d = String(last10 || "")
    .replace(/\D/g, "")
    .slice(-10);
  if (d.length !== 10) return null;
  try {
    const r = await pool.query(
      `SELECT
        ml.id,
        ml.state,
        ml.taalk_state,
        ml.taalk_market,
        ml.first_name,
        ml.last_name,
        ml.taalk_lead_id,
        ml.email,
        ml.cn_email,
        ml.city,
        ml.taalk_city
      FROM masterlead ml
      WHERE length(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g')) >= 10
        AND right(regexp_replace(coalesce(ml.phone, ''), '[^0-9]', '', 'g'), 10) = $1
      ORDER BY ml.updated_at DESC NULLS LAST
      LIMIT 1`,
      [d],
    );
    return (r.rows[0] as Record<string, unknown>) || null;
  } catch {
    return null;
  }
}

