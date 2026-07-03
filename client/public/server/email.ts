import { MailService } from '@sendgrid/mail';
import { User, Team } from '@shared/schema';

// NOTE: This is a placeholder implementation since we don't have an actual SendGrid API key
// When a real SENDGRID_API_KEY is provided, uncomment the following:
/*
if (!process.env.SENDGRID_API_KEY) {
  console.warn("SENDGRID_API_KEY environment variable not set. Email functionality will be limited.");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY || '');
*/

export interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    // In a real implementation with API key:
    // await mailService.send(params);
    
    // For now just log the email that would be sent
    console.log('Sending email (placeholder):', {
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text?.substring(0, 100) + '...',
      html: params.html ? 'HTML content included' : undefined
    });
    
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export async function sendInvitationEmail(
  inviter: User,
  invitedEmail: string,
  role: string,
  team: Team
): Promise<boolean> {
  const inviteLink = `${process.env.APP_URL || 'http://localhost:3000'}/register?email=${encodeURIComponent(invitedEmail)}&team=${team.id}&role=${role}`;
  
  const params: EmailParams = {
    to: invitedEmail,
    from: 'noreply@ao-precheck.com',
    subject: `You've been invited to join AO Pre-Check as a ${role}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2563eb;">AO Pre-Check Invitation</h2>
        <p>Hello,</p>
        <p>You've been invited by <strong>${inviter.fullName}</strong> to join AO Pre-Check as a <strong>${role}</strong> in the <strong>${team.name}</strong> team.</p>
        <p>AO Pre-Check is a Quality Department CRM application focused on streamlining call management and performance evaluation.</p>
        <div style="margin: 30px 0;">
          <a href="${inviteLink}" style="background-color: #2563eb; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Accept Invitation & Register</a>
        </div>
        <p>If you have any questions, please contact your team administrator.</p>
        <p>This invitation will expire in 7 days.</p>
        <hr style="border: 1px solid #eee; margin: 30px 0;" />
        <p style="color: #666; font-size: 12px;">If you did not expect this invitation, you can safely ignore this email.</p>
      </div>
    `,
    text: `
      AO Pre-Check Invitation
      
      Hello,
      
      You've been invited by ${inviter.fullName} to join AO Pre-Check as a ${role} in the ${team.name} team.
      
      AO Pre-Check is a Quality Department CRM application focused on streamlining call management and performance evaluation.
      
      Accept Invitation & Register: ${inviteLink}
      
      If you have any questions, please contact your team administrator.
      
      This invitation will expire in 7 days.
      
      If you did not expect this invitation, you can safely ignore this email.
    `
  };
  
  return await sendEmail(params);
}