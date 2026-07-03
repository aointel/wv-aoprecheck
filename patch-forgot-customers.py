with open(r'C:\dev\AOIrail\server\auth-service.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = """        if (!agentProfile || !agentProfile.phone) {
          console.log(`❌ No agent profile or phone found for ${normalizedEmail}`);
          return res.status(403).json({
            error: 'Phone number not found in your agent profile. Please complete your agent profile first or contact support.'
          });
        }

        // Normalize both phone numbers for comparison
        const profilePhoneClean = agentProfile.phone.replace(/\\D/g, '');"""

new = """        // Fallback: check customers table if agent_profiles has no phone
        let profilePhone = agentProfile?.phone || null;
        if (!profilePhone) {
          const { data: customerRow } = await supabaseAdmin
            .from('customers')
            .select('phone')
            .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
            .maybeSingle();
          profilePhone = customerRow?.phone || null;
        }

        if (!profilePhone) {
          console.log(`❌ No phone found for ${normalizedEmail} in agent_profiles or customers`);
          return res.status(403).json({
            error: 'No phone number on file. Please contact your manager to add a phone number to your account.'
          });
        }

        // Normalize both phone numbers for comparison
        const profilePhoneClean = profilePhone.replace(/\\D/g, '');"""

assert old in content, 'Pattern not found'
content = content.replace(old, new, 1)

# Also fix the line that uses agentProfile.phone further down
old2 = "        const profilePhoneClean = agentProfile.phone.replace(/\\D/g, '');"
# already replaced above - check what comes after
with open(r'C:\dev\AOIrail\server\auth-service.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
