with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the slow listUsers pagination with direct customers.user_id lookup
old = """        // Always reset password to raw associate ID — paginate through all users to find by email
        try {
          let foundUser: any = null;
          let page = 1;
          while (!foundUser) {
            const { data: { users }, error: listErr } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 1000 });
            if (listErr || !users?.length) break;
            foundUser = users.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
            if (foundUser || users.length < 1000) break;
            page++;
          }
          if (foundUser) {
            await supabaseAdmin.auth.admin.updateUserById(foundUser.id, { password: String(agentAssociateId) });
            console.log(`✅ provision-agent: Password reset to associate ID for ${normalizedEmail}`);
          } else {
            console.warn(`⚠️ provision-agent: Could not find user to reset password for ${normalizedEmail}`);
          }
        } catch (resetErr) {
          console.warn(`⚠️ provision-agent: Could not reset password (non-critical):`, resetErr);
        }"""

new = """        // Reset password using user_id stored in customers table — fast, no listUsers scan
        try {
          const { data: custRow } = await supabaseAdmin
            .from('customers')
            .select('user_id')
            .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
            .not('user_id', 'is', null)
            .maybeSingle();

          if (custRow?.user_id) {
            await supabaseAdmin.auth.admin.updateUserById(custRow.user_id, { password: String(agentAssociateId) });
            console.log(`✅ provision-agent: Password reset to associate ID for ${normalizedEmail}`);
          } else {
            console.warn(`⚠️ provision-agent: No user_id in customers for ${normalizedEmail} — cannot reset password`);
          }
        } catch (resetErr) {
          console.warn(`⚠️ provision-agent: Could not reset password (non-critical):`, resetErr);
        }"""

assert old in content, 'Pattern not found'
content = content.replace(old, new, 1)

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
