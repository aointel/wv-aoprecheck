import { pool } from "./db";

type QueryMode = "select" | "update" | "insert" | "upsert" | "delete";
type OrderBy = { column: string; ascending: boolean; nullsFirst?: boolean };

const HOT_TABLES = new Set(["twilio_call_logs", "agent_dial_metrics"]);
const knownColumnsByTable = new Map<string, Set<string>>();
const baseReadyByTable = new Map<string, boolean>();

function normalizeTable(table: string): string {
  return String(table || "").trim().toLowerCase();
}

function normalizeColumn(column: string): string {
  const clean = String(column || "").trim().replace(/^"+|"+$/g, "");
  if (!clean) return clean;
  if (clean.includes("_") || /[A-Z]/.test(clean)) return clean;
  return clean.toLowerCase();
}

function splitColumns(columns: string): string[] {
  return String(columns || "*")
    .split(",")
    .map((c) => normalizeColumn(c.trim()))
    .filter(Boolean);
}

function parseOrExpr(expr: string): string[] {
  return String(expr || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function parseInList(raw: string): string[] {
  const trimmed = String(raw || "").trim().replace(/^\(/, "").replace(/\)$/, "");
  if (!trimmed) return [];
  return trimmed.split(",").map((x) => x.trim()).filter(Boolean);
}

function qcol(column: string): string {
  return `"${String(column).replace(/"/g, '""')}"`;
}

async function ensureBaseTable(table: string): Promise<void> {
  const t = normalizeTable(table);
  if (baseReadyByTable.get(t)) return;
  if (!HOT_TABLES.has(t)) throw new Error(`Unsupported local hot table: ${t}`);

  if (t === "twilio_call_logs") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS twilio_call_logs (
        id BIGSERIAL PRIMARY KEY,
        twilio_call_sid TEXT UNIQUE NOT NULL
      );
    `);
  } else if (t === "agent_dial_metrics") {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS agent_dial_metrics (
        id BIGSERIAL PRIMARY KEY,
        agent_email TEXT,
        lead_phone TEXT,
        event_type TEXT
      );
    `);
  }

  const columns = await pool.query<{ column_name: string }>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = $1`,
    [t],
  );
  const known = new Set(columns.rows.map((r) => String(r.column_name || "")));
  knownColumnsByTable.set(t, known);
  baseReadyByTable.set(t, true);
}

async function ensureColumns(table: string, columns: string[]): Promise<void> {
  const t = normalizeTable(table);
  await ensureBaseTable(t);
  const known = knownColumnsByTable.get(t) || new Set<string>();
  for (const col of columns.map((c) => normalizeColumn(c)).filter(Boolean)) {
    if (col === "*") continue;
    if (known.has(col)) continue;
    await pool.query(`ALTER TABLE ${t} ADD COLUMN IF NOT EXISTS ${qcol(col)} TEXT`);
    known.add(col);
  }
  knownColumnsByTable.set(t, known);
}

class LocalHotTableBuilder implements PromiseLike<any> {
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

  constructor(private readonly tableName: string) {}

  private addFilter(sql: string, ...params: unknown[]): this {
    this.filters.push({ sql, params });
    return this;
  }

  private whereClause(startIndex = 1): { sql: string; values: unknown[] } {
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
    };
  }

  select(columns = "*", options?: { count?: "exact"; head?: boolean }): this {
    this.mode = this.mode === "update" || this.mode === "insert" || this.mode === "upsert" || this.mode === "delete"
      ? this.mode
      : "select";
    this.selectColumns = columns || "*";
    if (this.selectColumns !== "*") splitColumns(this.selectColumns).forEach((c) => this.referencedColumns.add(c));
    this.selectCount = options?.count || null;
    this.selectHead = !!options?.head;
    return this;
  }

  eq(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`${qcol(col)} IS NOT DISTINCT FROM ?`, value);
  }

  neq(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`, value);
  }

  gt(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`${qcol(col)} > ?`, value);
  }

  gte(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`${qcol(col)} >= ?`, value);
  }

  lt(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`${qcol(col)} < ?`, value);
  }

  lte(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`${qcol(col)} <= ?`, value);
  }

  ilike(column: string, pattern: string): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    return this.addFilter(`COALESCE(${qcol(col)}::text, '') ILIKE COALESCE(?::text, '')`, pattern);
  }

  in(column: string, values: unknown[]): this {
    if (!Array.isArray(values) || !values.length) return this.addFilter("1=0");
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    const placeholders = values.map(() => "?").join(", ");
    return this.addFilter(`${qcol(col)} IN (${placeholders})`, ...values);
  }

  is(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`${qcol(col)} IS NULL`);
    if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'true'`);
    if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'false'`);
    return this.addFilter(`${qcol(col)} IS NOT DISTINCT FROM ?`, value);
  }

  not(column: string, operator: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    const op = String(operator || "").toLowerCase();
    if (op === "is") {
      if (value === null || String(value).toLowerCase() === "null") return this.addFilter(`${qcol(col)} IS NOT NULL`);
      if (String(value).toLowerCase() === "true") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) <> 'true'`);
      if (String(value).toLowerCase() === "false") return this.addFilter(`LOWER(COALESCE(${qcol(col)}::text, '')) <> 'false'`);
    }
    if (op === "in") {
      const items = parseInList(String(value || ""));
      if (!items.length) return this;
      const placeholders = items.map(() => "?").join(", ");
      return this.addFilter(`COALESCE(${qcol(col)}::text, '') NOT IN (${placeholders})`, ...items);
    }
    return this.addFilter(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`, value);
  }

  contains(column: string, value: unknown): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    const payload = typeof value === "string" ? value : JSON.stringify(value ?? {});
    return this.addFilter(`${qcol(col)}::jsonb @> ?::jsonb`, payload);
  }

  or(expr: string): this {
    const parts = parseOrExpr(expr);
    if (!parts.length) return this;
    const sqlParts: string[] = [];
    const vals: unknown[] = [];
    for (const part of parts) {
      const segs = part.split(".");
      const col = normalizeColumn(segs[0] || "");
      if (!col) continue;
      this.referencedColumns.add(col);
      const op = String(segs[1] || "eq").toLowerCase();
      const raw = segs.slice(2).join(".");
      const value = raw === "null" ? null : raw;
      if (op === "eq") {
        sqlParts.push(`${qcol(col)} IS NOT DISTINCT FROM ?`);
        vals.push(value);
      } else if (op === "neq") {
        sqlParts.push(`NOT (${qcol(col)} IS NOT DISTINCT FROM ?)`);
        vals.push(value);
      } else if (op === "ilike") {
        sqlParts.push(`COALESCE(${qcol(col)}::text, '') ILIKE COALESCE(?::text, '')`);
        vals.push(value);
      } else if (op === "is") {
        if (value === null) sqlParts.push(`${qcol(col)} IS NULL`);
        else if (String(value).toLowerCase() === "true") sqlParts.push(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'true'`);
        else if (String(value).toLowerCase() === "false") sqlParts.push(`LOWER(COALESCE(${qcol(col)}::text, '')) = 'false'`);
      } else if (op === "in") {
        const items = parseInList(String(value || ""));
        if (!items.length) continue;
        const placeholders = items.map(() => "?").join(", ");
        sqlParts.push(`COALESCE(${qcol(col)}::text, '') IN (${placeholders})`);
        vals.push(...items);
      } else if (op === "gt") {
        sqlParts.push(`${qcol(col)} > ?`);
        vals.push(value);
      } else if (op === "gte") {
        sqlParts.push(`${qcol(col)} >= ?`);
        vals.push(value);
      } else if (op === "lt") {
        sqlParts.push(`${qcol(col)} < ?`);
        vals.push(value);
      } else if (op === "lte") {
        sqlParts.push(`${qcol(col)} <= ?`);
        vals.push(value);
      }
    }
    if (!sqlParts.length) return this;
    return this.addFilter(sqlParts.join(" OR "), ...vals);
  }

  order(column: string, options?: { ascending?: boolean; nullsFirst?: boolean }): this {
    const col = normalizeColumn(column);
    this.referencedColumns.add(col);
    this.orderBys.push({
      column: col,
      ascending: options?.ascending !== false,
      nullsFirst: options?.nullsFirst,
    });
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

  upsert(payload: Record<string, unknown> | Record<string, unknown>[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): this {
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
    await ensureColumns(this.tableName, [...this.referencedColumns]);
    const cols = this.selectColumns === "*" ? "*" : splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ");
    const where = this.whereClause(1);
    const order = this.orderBys.length
      ? ` ORDER BY ${this.orderBys
          .map((o) => `${qcol(o.column)} ${o.ascending ? "ASC" : "DESC"}${o.nullsFirst === undefined ? "" : o.nullsFirst ? " NULLS FIRST" : " NULLS LAST"}`)
          .join(", ")}`
      : "";
    const limit = this.limitValue != null ? ` LIMIT ${this.limitValue}` : "";
    const offset = this.offsetValue != null ? ` OFFSET ${this.offsetValue}` : "";

    let count: number | null = null;
    if (this.selectCount === "exact") {
      const c = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${this.tableName}${where.sql}`,
        where.values,
      );
      count = Number(c.rows[0]?.count || 0);
    }
    if (this.selectHead) return { data: null, error: null, count };

    const result = await pool.query(
      `SELECT ${cols} FROM ${this.tableName}${where.sql}${order}${limit}${offset}`,
      where.values,
    );
    if (this.singleType === "single") {
      if ((result.rowCount || 0) !== 1) return { data: null, error: { message: "Expected single row" }, count };
      return { data: result.rows[0], error: null, count };
    }
    if (this.singleType === "maybeSingle") return { data: result.rows[0] || null, error: null, count };
    return { data: result.rows, error: null, count };
  }

  private buildInsertRows(): { columns: string[]; rows: unknown[][] } {
    const rows = this.insertPayload.filter(Boolean);
    const columnSet = new Set<string>();
    for (const row of rows) Object.keys(row).forEach((k) => columnSet.add(normalizeColumn(k)));
    const columns = [...columnSet];
    const values = rows.map((row) => columns.map((c) => (row as any)[c]));
    return { columns, rows: values };
  }

  private async executeUpdateLike(): Promise<any> {
    await ensureColumns(this.tableName, [...this.referencedColumns]);
    if (!this.updatePayload) return { data: null, error: { message: "Missing update payload" }, count: null };
    const entries = Object.entries(this.updatePayload);
    if (!entries.length) return { data: null, error: null, count: 0 };
    const setSql = entries.map(([k], i) => `${qcol(normalizeColumn(k))} = $${i + 1}`).join(", ");
    const setVals = entries.map(([, v]) => v);
    const where = this.whereClause(setVals.length + 1);
    const returning = this.selectColumns && this.selectColumns !== "*"
      ? splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ")
      : "*";
    const wantsData = this.selectColumns !== "*";
    const sql = `UPDATE ${this.tableName} SET ${setSql}${where.sql}${wantsData ? ` RETURNING ${returning}` : ""}`;
    const result = await pool.query(sql, [...setVals, ...where.values]);
    return { data: wantsData ? result.rows : null, error: null, count: result.rowCount || 0 };
  }

  private async executeInsertLike(): Promise<any> {
    await ensureColumns(this.tableName, [...this.referencedColumns]);
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
    const quotedCols = columns.map((c) => qcol(c)).join(", ");

    let conflictSql = "";
    if (this.mode === "upsert") {
      if (this.upsertIgnoreDuplicates) {
        conflictSql = ` ON CONFLICT (${qcol(this.upsertConflict)}) DO NOTHING`;
      } else {
        const updates = columns
          .filter((c) => c !== this.upsertConflict)
          .map((c) => `${qcol(c)} = EXCLUDED.${qcol(c)}`)
          .join(", ");
        conflictSql = ` ON CONFLICT (${qcol(this.upsertConflict)}) DO UPDATE SET ${updates || `${qcol(this.upsertConflict)} = EXCLUDED.${qcol(this.upsertConflict)}`}`;
      }
    }

    const returning = this.selectColumns && this.selectColumns !== "*"
      ? splitColumns(this.selectColumns).map((c) => qcol(c)).join(", ")
      : "*";
    const wantsData = this.selectColumns !== "*";
    const sql = `INSERT INTO ${this.tableName} (${quotedCols}) VALUES ${rowSql}${conflictSql}${wantsData ? ` RETURNING ${returning}` : ""}`;
    const result = await pool.query(sql, values);
    const data = wantsData ? (this.singleType ? result.rows[0] || null : result.rows) : null;
    return { data, error: null, count: result.rowCount || 0 };
  }

  private async executeDelete(): Promise<any> {
    await ensureColumns(this.tableName, [...this.referencedColumns]);
    const where = this.whereClause(1);
    const sql = `DELETE FROM ${this.tableName}${where.sql}`;
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

export const localHotTableClient = {
  from(table: string): LocalHotTableBuilder {
    const t = normalizeTable(table);
    if (!HOT_TABLES.has(t)) throw new Error(`localHotTableClient unsupported table: ${t}`);
    return new LocalHotTableBuilder(t);
  },
};

