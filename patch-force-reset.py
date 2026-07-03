with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "alreadyExists: true," in line:
        # Find the start of this if block
        block_start = i - 2  # the if (alreadyExists) line
        # Find the closing return
        block_end = i + 3  # closing });
        
        new_block = [
            '      if (alreadyExists) {\n',
            '        console.log(`ℹ️ provision-agent: User already exists for ${normalizedEmail} — resetting password to current associate ID`);\n',
            '        // Always reset password to current associate ID so login works regardless of how account was created\n',
            '        try {\n',
            '          const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });\n',
            '          const existingUser = users?.find((u: any) => u.email?.toLowerCase() === normalizedEmail);\n',
            '          if (existingUser) {\n',
            '            await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password: String(agentAssociateId) });\n',
            '            console.log(`✅ provision-agent: Password reset to associate ID for ${normalizedEmail}`);\n',
            '          }\n',
            '        } catch (resetErr) {\n',
            '          console.warn(`⚠️ provision-agent: Could not reset password (non-critical):`, resetErr);\n',
            '        }\n',
            '        return res.json({\n',
            '          success: true,\n',
            '          email: normalizedEmail,\n',
            '          alreadyExists: true,\n',
            "          message: 'Account ready. Use your Associate ID as your password.',\n",
            '          associateId: agentAssociateId,\n',
            '        });\n',
            '      }\n',
        ]
        
        lines = lines[:block_start] + new_block + lines[block_end+1:]
        print(f'Replaced alreadyExists block at line {block_start+1}')
        break

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
