const { createClient } = require("@supabase/supabase-js");

const SUPABASE_URL = "https://ycztjetxwpfgtrzeyytt.supabase.co";
const SUPABASE_SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InljenRqZXR4d3BmZ3RyemV5eXR0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNzE3NDAzNywiZXhwIjoyMDUyNzUwMDM3fQ.hMzptgc6G5kaWSzDcBn6gOuc4FolW6x5IALWuUk16i0";

const email = String(process.argv[2] || "").toLowerCase().trim();
const password = String(process.argv[3] || "");

if (!email || !password) {
  console.error("Usage: node server/scripts/create-or-reset-auth-user.cjs <email> <password>");
  process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function findUserByEmail(targetEmail) {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) throw error;
    const user = (data?.users || []).find(
      (u) => String(u?.email || "").toLowerCase().trim() === targetEmail,
    );
    return user || null;
  } catch (err) {
    throw new Error(`Failed listing users: ${err?.message || String(err)}`);
  }
}

async function run() {
  const existing = await findUserByEmail(email);
  if (existing?.id) {
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
    });
    if (updateError) {
      throw new Error(`Failed updating existing user: ${updateError.message}`);
    }
    console.log(JSON.stringify({ ok: true, action: "updated_password", email, user_id: existing.id }, null, 2));
    return;
  }

  const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError) {
    throw new Error(`Failed creating user: ${createError.message}`);
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        action: "created_user",
        email,
        user_id: created?.user?.id || null,
      },
      null,
      2,
    ),
  );
}

run().catch((err) => {
  console.error(err?.message || String(err));
  process.exit(1);
});
