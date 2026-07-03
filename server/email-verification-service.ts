import { sendEmail } from './email';
import { supabaseAdmin } from './supabase';

// Store verification codes in memory (in production, use Redis or database)
const emailVerificationCodes = new Map<string, {
  code: string;
  email: string;
  expires: number;
  userId?: string;
}>();

// Clean up expired codes every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of emailVerificationCodes.entries()) {
    if (value.expires < now) {
      emailVerificationCodes.delete(key);
    }
  }
}, 5 * 60 * 1000);

export class EmailVerificationService {
  /**
   * Generate a 6-digit verification code
   */
  generateVerificationCode(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Send verification email to new user
   * Sends to BOTH @aoglobelife.com email AND personal_email from customer profile
   * Optionally sends SMS if phone is available in customer profile
   */
  async sendVerificationEmail(email: string, firstName?: string): Promise<{ success: boolean; code?: string; error?: string }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      const code = this.generateVerificationCode();
      
      // Store code with 15-minute expiration (use normalized email as key)
      const codeKey = `${normalizedEmail}_${Date.now()}`;
      emailVerificationCodes.set(codeKey, {
        code,
        email: normalizedEmail,
        expires: Date.now() + (15 * 60 * 1000) // 15 minutes
      });

      // Clean up old codes for this email
      for (const [key, value] of emailVerificationCodes.entries()) {
        if (value.email === normalizedEmail && value.expires < Date.now()) {
          emailVerificationCodes.delete(key);
        }
      }

      // Look up customer profile to get personal_email and phone
      let personalEmail: string | null = null;
      let phoneNumber: string | null = null;
      
      if (supabaseAdmin) {
        try {
          const { data: customer } = await supabaseAdmin
            .from('customers')
            .select('personal_email, phone, company_email')
            .or(`company_email.eq.${normalizedEmail},personal_email.eq.${normalizedEmail}`)
            .maybeSingle();
          
          if (customer) {
            // Get personal_email if different from company_email
            if (customer.personal_email && 
                customer.personal_email.toLowerCase() !== normalizedEmail &&
                customer.personal_email.trim() !== '') {
              personalEmail = customer.personal_email.toLowerCase().trim();
            }
            
            // Get phone if available and valid
            if (customer.phone && 
                customer.phone.trim() !== '' && 
                customer.phone !== '+1-555-0000' &&
                customer.phone.replace(/\D/g, '').length >= 10) {
              phoneNumber = customer.phone;
            }
          }
        } catch (customerError) {
          console.warn('⚠️ Could not lookup customer profile for verification:', customerError);
          // Continue with just the signup email
        }
      }

      const displayName = firstName || email.split('@')[0];
      const emailHtml = this.generateVerificationEmailHTML(displayName, code);
      const emailText = `Welcome to AO Intelligence! Your verification code is: ${code}. This code expires in 15 minutes.`;
      
      // Send to @aoglobelife.com email (primary)
      let primaryEmailSent = false;
      try {
        primaryEmailSent = await sendEmail({
          to: normalizedEmail,
          subject: '🚀 Welcome to AO Intelligence - Verify Your Email',
          html: emailHtml,
          text: emailText
        });
        if (primaryEmailSent) {
          console.log(`✅ Verification email sent to primary email: ${normalizedEmail}`);
        }
      } catch (primaryError) {
        console.error(`❌ Failed to send verification email to primary email ${normalizedEmail}:`, primaryError);
      }

      // Send to personal_email if available and different
      let personalEmailSent = false;
      if (personalEmail && personalEmail !== normalizedEmail) {
        try {
          personalEmailSent = await sendEmail({
            to: personalEmail,
            subject: '🚀 Welcome to AO Intelligence - Verify Your Email',
            html: emailHtml,
            text: emailText
          });
          if (personalEmailSent) {
            console.log(`✅ Verification email sent to personal email: ${personalEmail}`);
          }
        } catch (personalError) {
          console.error(`❌ Failed to send verification email to personal email ${personalEmail}:`, personalError);
        }
      }

      // Optionally send SMS if phone is available (rare case)
      let smsSent = false;
      if (phoneNumber) {
        try {
          const { smsService } = await import('./sms-service');
          const smsMessage = `Your AO Intelligence verification code is: ${code}. This code expires in 15 minutes. Do not share this code.`;
          smsSent = await smsService.sendSMS(phoneNumber, smsMessage);
          if (smsSent) {
            console.log(`✅ Verification code sent via SMS to: ${phoneNumber}`);
          } else {
            console.warn(`⚠️ Failed to send verification SMS to: ${phoneNumber}`);
          }
        } catch (smsError) {
          console.warn('⚠️ Error sending verification SMS (non-critical):', smsError);
        }
      }

      // Consider success if at least one email was sent
      if (primaryEmailSent || personalEmailSent) {
        console.log(`✅ Verification sent successfully - Primary: ${primaryEmailSent}, Personal: ${personalEmailSent}, SMS: ${smsSent}`);
        return { success: true, code };
      } else {
        console.error(`❌ Failed to send verification to any email address`);
        return { success: false, error: 'Failed to send verification email' };
      }
    } catch (error: any) {
      console.error('❌ Error sending verification email:', error);
      return { success: false, error: error.message || 'Failed to send verification email' };
    }
  }

  /**
   * Verify email code
   */
  async verifyCode(email: string, code: string): Promise<{ success: boolean; error?: string }> {
    try {
      const normalizedEmail = email.toLowerCase().trim();
      
      // Find matching code
      let foundEntry = null;
      let foundKey = null;
      
      for (const [key, value] of emailVerificationCodes.entries()) {
        if (value.email === normalizedEmail && 
            value.code === code && 
            value.expires > Date.now()) {
          foundEntry = value;
          foundKey = key;
          break;
        }
      }

      if (!foundEntry) {
        return { success: false, error: 'Invalid or expired verification code' };
      }

      // Clean up used code
      if (foundKey) {
        emailVerificationCodes.delete(foundKey);
      }

      return { success: true };
    } catch (error: any) {
      console.error('❌ Error verifying code:', error);
      return { success: false, error: error.message || 'Verification failed' };
    }
  }

  /**
   * Generate beautiful verification email HTML
   */
  private generateVerificationEmailHTML(displayName: string, code: string): string {
    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your Email - AO Intelligence</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f7fafc;">
  <table role="presentation" style="width: 100%; border-collapse: collapse; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" style="max-width: 600px; width: 100%; background: white; border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden;">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
              <div style="width: 80px; height: 80px; background: rgba(255,255,255,0.2); border-radius: 50%; margin: 0 auto 20px; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(10px);">
                <span style="font-size: 40px;">🚀</span>
              </div>
              <h1 style="margin: 0; color: white; font-size: 32px; font-weight: bold; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">Welcome to AO Intelligence!</h1>
              <p style="margin: 10px 0 0 0; color: rgba(255,255,255,0.9); font-size: 18px;">Let's get you verified</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 30px;">
              <p style="margin: 0 0 20px 0; font-size: 18px; color: #2d3748; line-height: 1.6;">
                Hi ${displayName},
              </p>
              <p style="margin: 0 0 30px 0; font-size: 16px; color: #4a5568; line-height: 1.6;">
                Welcome to AO Intelligence! We're excited to have you on board. To complete your account setup and start connecting with clients, please verify your email address using the code below.
              </p>
              
              <!-- Verification Code Box -->
              <div style="background: linear-gradient(135deg, #f0f4ff 0%, #e0e7ff 100%); border: 2px solid #667eea; border-radius: 12px; padding: 30px; text-align: center; margin: 30px 0;">
                <p style="margin: 0 0 15px 0; font-size: 14px; color: #667eea; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">Your Verification Code</p>
                <div style="background: white; border-radius: 8px; padding: 20px; display: inline-block; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.2);">
                  <span style="font-size: 36px; font-weight: bold; color: #667eea; letter-spacing: 8px; font-family: 'Courier New', monospace;">${code}</span>
                </div>
                <p style="margin: 15px 0 0 0; font-size: 12px; color: #718096;">This code expires in 15 minutes</p>
              </div>
              
              <p style="margin: 30px 0 0 0; font-size: 16px; color: #4a5568; line-height: 1.6;">
                Enter this code in the verification screen to complete your account setup. Once verified, you'll have full access to all AO Intelligence features.
              </p>
              
              <!-- Info Box -->
              <div style="background: #f7fafc; border-left: 4px solid #667eea; border-radius: 8px; padding: 20px; margin: 30px 0;">
                <p style="margin: 0; font-size: 14px; color: #4a5568; line-height: 1.6;">
                  <strong style="color: #667eea;">💡 Tip:</strong> If you didn't request this verification code, you can safely ignore this email. Your account will remain secure.
                </p>
              </div>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background: #f7fafc; padding: 30px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0 0 10px 0; font-size: 14px; color: #718096;">
                <strong style="color: #2d3748;">AO Intelligence</strong> | Empowering Agents, Connecting Clients
              </p>
              <p style="margin: 0; font-size: 12px; color: #a0aec0;">
                This is an automated email. Please do not reply to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;
  }
}

export const emailVerificationService = new EmailVerificationService();
