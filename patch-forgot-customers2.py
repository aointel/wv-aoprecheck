with open(r'C:\dev\AOIrail\server\auth-service.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the "No agent profile or phone" block and replace it
for i, line in enumerate(lines):
    if 'No agent profile or phone found' in line:
        # Replace lines i-1 through i+4 (the whole if block)
        start = i - 1  # the if line
        end = i + 4    # closing }
        
        new_block = [
            '        // Fallback: check customers table if agent_profiles has no phone\n',
            '        let profilePhone = agentProfile?.phone || null;\n',
            '        if (!profilePhone) {\n',
            '          const { data: customerRow } = await supabaseAdmin\n',
            "            .from('customers')\n",
            "            .select('phone')\n",
            '            .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)\n',
            '            .maybeSingle();\n',
            '          profilePhone = customerRow?.phone || null;\n',
            '        }\n',
            '\n',
            '        if (!profilePhone) {\n',
            '          console.log(`❌ No phone found for ${normalizedEmail} in agent_profiles or customers`);\n',
            '          return res.status(403).json({\n',
            "            error: 'No phone number on file. Please contact your manager to add one to your account.'\n",
            '          });\n',
            '        }\n',
        ]
        
        lines = lines[:start] + new_block + lines[end+1:]
        print(f'Replaced block at lines {start+1}-{end+1}')
        break

# Now fix the profilePhoneClean line to use profilePhone instead of agentProfile.phone
for i, line in enumerate(lines):
    if 'const profilePhoneClean = agentProfile.phone.replace' in line:
        lines[i] = "        const profilePhoneClean = profilePhone.replace(/\\D/g, '');\n"
        print(f'Fixed profilePhoneClean at line {i+1}')
        break

with open(r'C:\dev\AOIrail\server\auth-service.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
