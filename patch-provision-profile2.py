with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Insert profile/customer-link code before the final return (line 128, 0-indexed 127)
# Find the line: "    return res.json({"  after "Created new login"
insert_at = None
for i, line in enumerate(lines):
    if 'Created new login for' in line:
        # Insert after this line (i+1), before the return
        insert_at = i + 2  # skip the blank line too
        break

assert insert_at, 'Insert point not found'

new_block = """
    const newSupabaseUserId = createData?.user?.id;

    // Link supabase user_id into customers row
    if (newSupabaseUserId) {
      try {
        await supabaseAdmin
          .from('customers')
          .update({ user_id: newSupabaseUserId })
          .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
        console.log(`✅ provision-agent: Linked user_id to customers row`);
      } catch (linkErr) {
        console.warn('⚠️ provision-agent: Failed to link user_id (non-critical):', linkErr);
      }
    }

    // Create agent_profiles row so app works immediately (diagnostic, CCPro, etc)
    try {
      const { data: existingProfile } = await supabaseAdmin
        .from('agent_profiles')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (!existingProfile) {
        await supabaseAdmin
          .from('agent_profiles')
          .insert({
            supabase_user_id: newSupabaseUserId || null,
            email: normalizedEmail,
            first_name: agentFirstName || '',
            last_name: agentLastName || '',
            phone: agentPhone || '',
            zoom_id: '',
            zoom_password: '1',
            primary_market: '',
            secondary_market: '',
            created_at: new Date().toISOString(),
          });
        console.log(`✅ provision-agent: Created agent_profiles row for ${normalizedEmail}`);
      } else if (newSupabaseUserId) {
        await supabaseAdmin
          .from('agent_profiles')
          .update({ supabase_user_id: newSupabaseUserId })
          .ilike('email', normalizedEmail);
        console.log(`✅ provision-agent: Updated supabase_user_id on existing agent_profiles`);
      }
    } catch (profileErr) {
      console.warn('⚠️ provision-agent: Failed to create agent_profiles (non-critical):', profileErr);
    }

"""

lines = lines[:insert_at] + [new_block] + lines[insert_at:]

# Also fix the createUser destructuring — need createData not just newUser
for i, line in enumerate(lines):
    if 'const { data: newUser, error: createError }' in line:
        lines[i] = line.replace('const { data: newUser, error: createError }', 'const { data: createData, error: createError }')
        print(f'Fixed createUser destructuring at line {i+1}')
    if 'if (createError)' in line or 'createError.message' in line:
        pass  # these are fine
    if '!createData' in line or 'createData?.user' in line:
        pass

# Fix the newUser reference check
for i, line in enumerate(lines):
    if 'if (createError)' in line:
        # next line or so might reference newUser
        pass
    if "!createData" not in line and "createData" not in line and 'newUser' in line:
        lines[i] = line.replace('newUser', 'createData')
        print(f'Fixed newUser ref at line {i+1}: {lines[i].rstrip()}')

# Add agentPhone variable declaration near the top of the try block
for i, line in enumerate(lines):
    if 'let agentEmail: string | null = null;' in line:
        lines[i] = line + '    let agentPhone: string | null = null;\n'
        print(f'Added agentPhone at line {i+1}')
        break

# In both customer lookup branches, capture phone
for i, line in enumerate(lines):
    if 'agentLastName = customer.last_name ||' in line and i+1 < len(lines):
        # Add agentPhone capture after agentLastName
        indent = '        '
        lines[i] = line + f'{indent}agentPhone = (customer as any).phone || null;\n'
        print(f'Added agentPhone capture at line {i+1}')

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
