import { supabaseAdmin } from "../supabase";

type RecruitRow = {
  id: number;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  created_at: string | null;
};

function normalizePhone(raw: string | null | undefined): string {
  return String(raw || "").trim();
}

async function fetchAllRecruitCandidates(): Promise<RecruitRow[]> {
  const all: RecruitRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("recruit_candidates")
      .select("id,first_name,last_name,phone,email,city,state,zip_code,created_at")
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) throw error;
    const rows = (data || []) as RecruitRow[];
    if (rows.length === 0) break;

    all.push(...rows);
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return all;
}

async function fetchExistingPhones(): Promise<Set<string>> {
  const phones = new Set<string>();
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await supabaseAdmin
      .from("masterleadrecruit")
      .select("phone")
      .range(from, to);

    if (error) throw error;
    const rows = (data || []) as Array<{ phone: string | null }>;
    if (rows.length === 0) break;

    for (const row of rows) {
      const phone = normalizePhone(row.phone);
      if (phone) phones.add(phone);
    }

    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return phones;
}

async function main() {
  if (!supabaseAdmin) {
    throw new Error("Supabase admin client not initialized");
  }

  console.log("Populating masterleadrecruit from recruit_candidates...");

  const [candidates, existingPhones] = await Promise.all([
    fetchAllRecruitCandidates(),
    fetchExistingPhones(),
  ]);

  const dedupedByPhone = new Map<string, RecruitRow>();
  for (const candidate of candidates) {
    const phone = normalizePhone(candidate.phone);
    if (!phone) continue;
    if (!dedupedByPhone.has(phone)) {
      dedupedByPhone.set(phone, candidate);
    }
  }

  const rowsToInsert = [];
  for (const [phone, row] of dedupedByPhone.entries()) {
    if (existingPhones.has(phone)) continue;
    rowsToInsert.push({
      candidate_id: row.id,
      first_name: row.first_name,
      last_name: row.last_name,
      phone,
      email: row.email,
      city: row.city,
      state: row.state,
      zip: row.zip_code,
      cnresolution: "pending",
      market: "aorecruit",
      created_at: row.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }

  if (rowsToInsert.length === 0) {
    console.log(
      JSON.stringify(
        {
          success: true,
          message: "No new rows to insert",
          recruit_candidates: candidates.length,
          unique_candidate_phones: dedupedByPhone.size,
          masterleadrecruit_existing_phones: existingPhones.size,
          inserted: 0,
        },
        null,
        2,
      ),
    );
    return;
  }

  const batchSize = 500;
  let inserted = 0;
  for (let i = 0; i < rowsToInsert.length; i += batchSize) {
    const batch = rowsToInsert.slice(i, i + batchSize);
    const { error } = await supabaseAdmin.from("masterleadrecruit").insert(batch);
    if (error) throw error;
    inserted += batch.length;
  }

  const { count: finalCount } = await supabaseAdmin
    .from("masterleadrecruit")
    .select("id", { count: "exact", head: true });

  console.log(
    JSON.stringify(
      {
        success: true,
        recruit_candidates: candidates.length,
        unique_candidate_phones: dedupedByPhone.size,
        masterleadrecruit_existing_phones: existingPhones.size,
        inserted,
        masterleadrecruit_total_after: Number(finalCount || 0),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error("populate-masterleadrecruit failed:", error?.message || error);
  process.exitCode = 1;
});

