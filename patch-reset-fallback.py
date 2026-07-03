with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'No user_id in customers for' in line and 'cannot reset password' in line:
        # Replace lines i and i+1 (the else block closing)
        lines[i] = '            console.warn(`provision-agent: No user_id cached for ${normalizedEmail} - looking up via admin API`);\n'
        lines[i+1] = '            try {\n              const { data: found } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);\n              if (found?.user?.id) {\n                await supabaseAdmin.auth.admin.updateUserById(found.user.id, { password: String(agentAssociateId) });\n                await supabaseAdmin.from(\'customers\').update({ user_id: found.user.id }).or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);\n                console.log(`provision-agent: Reset + stored user_id for ${normalizedEmail}`);\n              }\n            } catch (_ignore) {}\n          }\n'
        print(f'Fixed at line {i+1}')
        break

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
