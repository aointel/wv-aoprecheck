const { Client } = require("pg");

const DATABASE_URL =
  process.env.DATABASE_POOLER_URL ||
  process.env.DATABASE_URL ||
  "postgresql://neondb_owner:npg_NASaoyV79kjf@ep-jolly-dust-ae6tqqs5-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require";

async function run() {
  const client = new Client({
    connectionString: DATABASE_URL,
    statement_timeout: 180000,
    query_timeout: 180000,
  });
  await client.connect();

  try {
    await client.query("BEGIN");

    await client.query(`
      CREATE OR REPLACE FUNCTION public.enforce_masterlead_phone_format()
      RETURNS trigger
      LANGUAGE plpgsql
      AS $$
      DECLARE
        raw_phone_digits text := regexp_replace(COALESCE(NEW.phone::text, ''), '\\D', '', 'g');
        raw_last10_digits text := regexp_replace(COALESCE(NEW.phone_last10::text, ''), '\\D', '', 'g');
        canonical11 text;
        canonical10 text;
      BEGIN
        IF raw_phone_digits = '' AND raw_last10_digits = '' THEN
          RAISE EXCEPTION 'masterlead phone is required';
        END IF;

        IF raw_phone_digits <> '' THEN
          IF length(raw_phone_digits) = 10 THEN
            canonical11 := '1' || raw_phone_digits;
          ELSIF length(raw_phone_digits) = 11 AND raw_phone_digits LIKE '1%' THEN
            canonical11 := raw_phone_digits;
          ELSE
            RAISE EXCEPTION 'invalid masterlead phone digits: %', raw_phone_digits;
          END IF;
          canonical10 := right(canonical11, 10);
        ELSE
          IF length(raw_last10_digits) <> 10 THEN
            RAISE EXCEPTION 'invalid masterlead phone_last10 digits: %', raw_last10_digits;
          END IF;
          canonical10 := raw_last10_digits;
          canonical11 := '1' || canonical10;
        END IF;

        IF canonical10 !~ '^[2-9][0-9]{2}[2-9][0-9]{6}$' THEN
          RAISE EXCEPTION 'invalid NANP phone shape: %', canonical10;
        END IF;

        NEW.phone := canonical11;
        RETURN NEW;
      END;
      $$;
    `);

    await client.query(`
      DROP TRIGGER IF EXISTS trg_masterlead_enforce_phone_format ON masterlead;
      CREATE TRIGGER trg_masterlead_enforce_phone_format
      BEFORE INSERT OR UPDATE OF phone
      ON masterlead
      FOR EACH ROW
      EXECUTE FUNCTION public.enforce_masterlead_phone_format();
    `);

    await client.query(`
      ALTER TABLE masterlead
      DROP CONSTRAINT IF EXISTS masterlead_phone_canonical_check;
      ALTER TABLE masterlead
      ADD CONSTRAINT masterlead_phone_canonical_check
      CHECK (
        regexp_replace(COALESCE(phone::text, ''), '\\D', '', 'g') ~ '^1[2-9][0-9]{2}[2-9][0-9]{6}$'
        AND regexp_replace(COALESCE(phone_last10::text, ''), '\\D', '', 'g') = right(regexp_replace(COALESCE(phone::text, ''), '\\D', '', 'g'), 10)
      ) NOT VALID;
    `);

    await client.query("COMMIT");

    console.log(
      JSON.stringify(
        {
          applied: true,
          trigger: "trg_masterlead_enforce_phone_format",
          checkConstraint: "masterlead_phone_canonical_check (NOT VALID for existing rows, enforced for new writes)",
          note: "All new/updated masterlead rows now require canonical US/NANP phone formatting and are normalized on write.",
        },
        null,
        2,
      ),
    );
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    await client.end();
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
