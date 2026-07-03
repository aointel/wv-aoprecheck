with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = """        // Always reset password to current associate ID so login works regardless of how account was created
        try {
          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const existingUser = users?.find((u: any) => u.email?.toLowerCase() === normalizedEmail);
          if (existingUser) {
            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: String(agentAssociateId) });
            console.log(`✅ provision-agent: Password reset to associate ID for ${normalizedEmail}`);
          }
        } catch (resetErr) {
          console.warn(`⚠️ provision-agent: Could not reset password (non-critical):`, resetErr);
        }"""

new = """        // Always reset password to raw associate ID — paginate through all users to find by email
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

assert old in content, 'Pattern not found'
content = content.replace(old, new, 1)

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
