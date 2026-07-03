with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Find the success return after createUser and insert profile creation before it
old = """    console.log(`✅ provision-agent: Created login for ${normalizedEmail} (associate_id: ${agentAssociateId})`);

    return res.json({
      success: true,
      email: normalizedEmail,
      alreadyExists: false,
      message: 'Account created. Use your Associate ID as your password.',
      associateId: agentAssociateId,
    });"""

new = """    console.log(`✅ provision-agent: Created login for ${normalizedEmail} (associate_id: ${agentAssociateId})`);

    const newSupabaseUserId = newUser?.user?.id;

    // Update customers table: link supabase user_id so the app can find them
    if (newSupabaseUserId) {
      try {
        await supabaseAdmin
          .from('customers')
          .update({ user_id: newSupabaseUserId })
          .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`);
        console.log(`✅ provision-agent: Linked user_id ${newSupabaseUserId} to customers row`);
      } catch (linkErr) {
        console.warn('⚠️ provision-agent: Failed to link user_id to customers (non-critical):', linkErr);
      }
    }

    // Create agent_profiles row so the app works immediately (diagnostic test, CCPro, etc)
    try {
      // Check if profile already exists first
      const { data: existingProfile } = await supabaseAdmin
        .from('agent_profiles')
        .select('id')
        .ilike('email', normalizedEmail)
        .maybeSingle();

      if (!existingProfile) {
        const nameParts = `${agentFirstName || ''} ${agentLastName || ''}`.trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        await supabaseAdmin
          .from('agent_profiles')
          .insert({
            supabase_user_id: newSupabaseUserId || null,
            email: normalizedEmail,
            first_name: firstName,
            last_name: lastName,
            phone: agentPhone || '',
            zoom_id: '',
            zoom_password: '1',
            primary_market: '',
            secondary_market: '',
            created_at: new Date().toISOString(),
          });
        console.log(`✅ provision-agent: Created agent_profiles row for ${normalizedEmail}`);
      } else {
        // Profile exists — update supabase_user_id if we have it
        if (newSupabaseUserId) {
          await supabaseAdmin
            .from('agent_profiles')
            .update({ supabase_user_id: newSupabaseUserId })
            .ilike('email', normalizedEmail);
        }
        console.log(`✅ provision-agent: agent_profiles already exists for ${normalizedEmail}`);
      }
    } catch (profileErr) {
      console.warn('⚠️ provision-agent: Failed to create agent_profiles (non-critical):', profileErr);
    }

    return res.json({
      success: true,
      email: normalizedEmail,
      alreadyExists: false,
      message: 'Account created. Use your Associate ID as your password.',
      associateId: agentAssociateId,
    });"""

assert old in content, 'Target not found in provision-agent'
result = content.replace(old, new, 1)

# Also need agentPhone variable — add it to the lookup block
# After agentAssociateId is set, grab phone too
old2 = """    if (associateId) {
      // Look up by associate_id in customers table
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name, agent_name')
        .eq('associate_id', associateId)
        .maybeSingle();"""

new2 = """    let agentPhone: string | null = null;

    if (associateId) {
      // Look up by associate_id in customers table
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name, agent_name, phone')
        .eq('associate_id', associateId)
        .maybeSingle();"""

result = result.replace(old2, new2, 1)

# Also update the email lookup to get phone
old3 = """      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name, agent_name')
        .or(`company_email.eq.${email.toLowerCase()},personal_email.eq.${email.toLowerCase()}`)
        .maybeSingle();"""

new3 = """      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('company_email, personal_email, associate_id, first_name, last_name, agent_name, phone')
        .or(`company_email.eq.${email.toLowerCase()},personal_email.eq.${email.toLowerCase()}`)
        .maybeSingle();"""

result = result.replace(old3, new3, 1)

# Set agentPhone after customer lookup in both branches
old4 = """        agentEmail = customer.company_email || customer.personal_email;
        agentAssociateId = String(customer.associate_id);
        agentFirstName = customer.first_name || (customer.agent_name || '').split(' ')[0] || null;
        agentLastName = customer.last_name || (customer.agent_name || '').split(' ').slice(1).join(' ') || null;
      } else {
        agentEmail = customer.company_email || customer.personal_email;
        agentAssociateId = String(customer.associate_id);
        agentFirstName = customer.first_name || null;
        agentLastName = customer.last_name || null;
      }"""

new4 = """        agentEmail = customer.company_email || customer.personal_email;
        agentAssociateId = String(customer.associate_id);
        agentFirstName = customer.first_name || (customer.agent_name || '').split(' ')[0] || null;
        agentLastName = customer.last_name || (customer.agent_name || '').split(' ').slice(1).join(' ') || null;
        agentPhone = (customer as any).phone || null;
      } else {
        agentEmail = customer.company_email || customer.personal_email;
        agentAssociateId = String(customer.associate_id);
        agentFirstName = customer.first_name || null;
        agentLastName = customer.last_name || null;
        agentPhone = (customer as any).phone || null;
      }"""

result = result.replace(old4, new4, 1)

with open(r'C:\dev\AOIrail\server\routes-agent-provision.ts', 'w', encoding='utf-8') as f:
    f.write(result)
print('Done')
