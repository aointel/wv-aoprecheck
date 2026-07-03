with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the mangled block: from "const alreadyExists" to closing "}" before createUser error
start = None
end = None
for i, line in enumerate(lines):
    if 'const alreadyExists =' in line and start is None:
        start = i
    if start and "console.error('❌ provision-agent: createUser error:" in line:
        end = i
        break

print(f'Replacing lines {start+1} to {end} (inclusive)')

new_block = [
    '      const alreadyExists =\n',
    "        createError.message?.toLowerCase().includes('already been registered') ||\n",
    "        createError.message?.toLowerCase().includes('already exists') ||\n",
    "        createError.message?.toLowerCase().includes('user already registered');\n",
    '\n',
    '      if (alreadyExists) {\n',
    '        console.log(`provision-agent: ${normalizedEmail} already exists — resetting password`);\n',
    '        try {\n',
    '          // Fast path: use user_id stored in customers\n',
    '          const { data: custRow } = await supabaseAdmin\n',
    "            .from('customers')\n",
    "            .select('user_id')\n",
    '            .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)\n',
    "            .not('user_id', 'is', null)\n",
    '            .maybeSingle();\n',
    '          let uid = custRow?.user_id;\n',
    '          if (!uid) {\n',
    '            // Fallback: look up by email\n',
    '            const { data: found } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);\n',
    '            uid = found?.user?.id;\n',
    '            if (uid) await supabaseAdmin.from(\'customers\').update({ user_id: uid }).or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);\n',
    '          }\n',
    '          if (uid) {\n',
    '            await supabaseAdmin.auth.admin.updateUserById(uid, { password: String(agentAssociateId) });\n',
    '            console.log(`provision-agent: password reset for ${normalizedEmail}`);\n',
    '          }\n',
    '        } catch (e) { console.warn(`provision-agent: password reset failed (non-critical):`, e); }\n',
    '        return res.json({ success: true, email: normalizedEmail, alreadyExists: true, associateId: agentAssociateId });\n',
    '      }\n',
    '\n',
]

lines = lines[:start] + new_block + lines[end:]

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
