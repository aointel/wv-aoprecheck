import { pool } from "./db";

type IncrementParams = {
  callSid: string;
  toNumber?: string | null;
  direction?: string | null;
  status?: string | null;
};

let ensureSchemaPromise: Promise<void> | null = null;

function normalizePhoneLast10(value: string | null | undefined): string {
  const digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  if (digits.length >= 10) return digits.slice(-10);
  return "";
}

async function ensureCounterSchema(): Promise<void> {
  if (!ensureSchemaPromise) {
    ensureSchemaPromise = (async () => {
      await pool.query(`
        ALTER TABLE masterlead
        ADD COLUMN IF NOT EXISTS call_attempts integer NOT NULL DEFAULT 0
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS lead_call_counter_events (
          call_sid text PRIMARY KEY,
          lead_id bigint NULL,
          phone_last10 text NOT NULL,
          direction text NULL,
          status text NULL,
          created_at timestamptz NOT NULL DEFAULT NOW()
        )
      `);
    })().catch((err) => {
      ensureSchemaPromise = null;
      throw err;
    });
  }
  await ensureSchemaPromise;
}

function isEligibleOutboundAttempt(params: IncrementParams): boolean {
  const direction = String(params.direction || "").toLowerCase();
  const status = String(params.status || "").toLowerCase();
  if (direction !== "outbound") return false;
  return status === "initiated" || status === "ringing" || status === "in-progress";
}

export async function incrementLeadCallAttemptCounter(params: IncrementParams): Promise<void> {
  const callSid = String(params.callSid || "").trim();
  if (!callSid) return;
  if (!isEligibleOutboundAttempt(params)) return;

  const phoneLast10 = normalizePhoneLast10(params.toNumber);
  if (!phoneLast10) return;

  await ensureCounterSchema();

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const eventInsert = await client.query<{ call_sid: string }>(
      `
        INSERT INTO lead_call_counter_events (call_sid, phone_last10, direction, status)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (call_sid) DO NOTHING
        RETURNING call_sid
      `,
      [callSid, phoneLast10, params.direction || null, params.status || null],
    );

    if ((eventInsert.rowCount || 0) === 0) {
      await client.query("COMMIT");
      return;
    }

    const updatedLead = await client.query<{ id: string }>(
      `
        WITH target AS (
          SELECT id
          FROM masterlead
          WHERE RIGHT(REGEXP_REPLACE(COALESCE(phone::text, ''), '\\D', '', 'g'), 10) = $1
             OR RIGHT(REGEXP_REPLACE(COALESCE(phone_number::text, ''), '\\D', '', 'g'), 10) = $1
          ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id DESC
          LIMIT 1
        )
        UPDATE masterlead ml
        SET call_attempts = COALESCE(ml.call_attempts, 0) + 1
        FROM target
        WHERE ml.id = target.id
        RETURNING ml.id::text AS id
      `,
      [phoneLast10],
    );

    if ((updatedLead.rowCount || 0) > 0) {
      await client.query(
        `UPDATE lead_call_counter_events SET lead_id = $2 WHERE call_sid = $1`,
        [callSid, updatedLead.rows[0].id],
      );
    }

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

