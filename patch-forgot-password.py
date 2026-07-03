with open(r'C:\dev\AOIrail\server\auth-service.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find forgotPassword method start and end
start = None
end = None
for i, line in enumerate(lines):
    if 'static async forgotPassword' in line and start is None:
        start = i
    if start is not None and i > start:
        # Find the next static async method
        if 'static async ' in line and i > start + 5:
            end = i
            break

print(f'forgotPassword: lines {start+1} to {end}')

new_method = '''  static async forgotPassword(req: Request, res: Response) {
    try {
      const { email } = req.body;

      if (!email) {
        return res.status(400).json({ error: 'Email is required' });
      }

      if (!supabaseAdmin) {
        return res.status(500).json({ error: 'Admin authentication not configured' });
      }

      const normalizedEmail = email.trim().toLowerCase();

      // 1. Look up associate_id from customers table
      const { data: customer } = await supabaseAdmin
        .from('customers')
        .select('associate_id, phone, agent_name, first_name')
        .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
        .maybeSingle();

      if (!customer || !customer.associate_id) {
        // Return success anyway to prevent email enumeration
        return res.json({ success: true, message: 'If your account exists, your passcode has been sent.' });
      }

      const associateId = String(customer.associate_id);
      const firstName = customer.first_name || (customer.agent_name || '').split(' ')[0] || 'Agent';

      // 2. Reset Supabase password to associate_id
      try {
        const { data: found } = await supabaseAdmin.auth.admin.getUserByEmail(normalizedEmail);
        if (found?.user?.id) {
          await supabaseAdmin.auth.admin.updateUserById(found.user.id, { password: associateId });
          console.log(`✅ forgotPassword: Reset password to associate_id for ${normalizedEmail}`);
        }
      } catch (resetErr) {
        console.warn('⚠️ forgotPassword: Could not reset password (non-critical):', resetErr);
      }

      // 3. Get phone — from customers or fallback to body
      let phoneToUse = customer.phone || null;
      if (!phoneToUse) {
        return res.json({
          success: true,
          noPhone: true,
          message: 'No phone on file. Your passcode is your Associate ID.',
          // Only return associateId if no phone — they must look it up from admin
        });
      }

      // Normalize phone
      const digits = phoneToUse.replace(/\\D/g, '');
      const formattedPhone = digits.length === 10 ? \`+1\${digits}\` : digits.startsWith('+') ? digits : \`+\${digits}\`;

      // 4. Send SMS with associate_id as their passcode
      const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID || (await import('./hardcoded-config')).HARDCODED_CONFIG.TWILIO_ACCOUNT_SID;
      const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN || (await import('./hardcoded-config')).HARDCODED_CONFIG.TWILIO_AUTH_TOKEN;
      const twilioPhone = (await import('./hardcoded-config')).HARDCODED_CONFIG.TWILIO_PHONE_NUMBER;

      const twilio = (await import('twilio')).default;
      const client = twilio(twilioAccountSid, twilioAuthToken);

      await client.messages.create({
        body: \`Hi \${firstName}, your AO Intelligence passcode is: \${associateId}\\n\\nThis is also your discount code for 90% off your first month of Call Connector Pro.\`,
        from: twilioPhone,
        to: formattedPhone,
      });

      console.log(\`✅ forgotPassword: Sent passcode SMS to \${formattedPhone} for \${normalizedEmail}\`);
      return res.json({ success: true, message: 'Your passcode has been sent to your phone.' });

    } catch (error) {
      console.error('Forgot password error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

'''

new_lines = lines[:start] + [new_method] + lines[end:]
print(f'Original: {len(lines)}, New: {len(new_lines)}')

with open(r'C:\dev\AOIrail\server\auth-service.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Done')
