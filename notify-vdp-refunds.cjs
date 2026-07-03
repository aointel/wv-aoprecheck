#!/usr/bin/env node

const fetch = require('node-fetch');

const MAILGUN_API_KEY = 'aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a';
const MAILGUN_DOMAIN = 'aoglobelife.com';
const FROM_EMAIL = 'noreply@aoglobelife.com';

// Agents who received refunds
const refunds = [
  { email: 'gageharrington@aoglobelife.com', name: 'Gage Harrington', credits: 152, duplicates: 19 },
  { email: 'josiahmonett@aoglobelife.com', name: 'Josiah Monett', credits: 112, duplicates: 14 },
  { email: 'mohamedalgohaim@aoglobelife.com', name: 'Mohamed Algohaim', credits: 96, duplicates: 12 },
  { email: 'anthonylulgjuraj@aoglobelife.com', name: 'Anthony Lulgjuraj', credits: 80, duplicates: 10 },
  { email: 'devingould@aoglobelife.com', name: 'Devin Gould', credits: 80, duplicates: 10 },
  { email: 'millergerald@aoglobelife.com', name: 'Gerald Miller', credits: 72, duplicates: 9 },
  { email: 'chrislafond@aoglobelife.com', name: 'Christopher Lafond', credits: 64, duplicates: 8 },
  { email: 'lisablanco@aoglobelife.com', name: 'Lisa Blanco', credits: 64, duplicates: 8 },
  { email: 'dominiquecarter@aoglobelife.com', name: 'Dominique Carter', credits: 32, duplicates: 4 },
  { email: 'jacobvaldellon@aoglobelife.com', name: 'Jacob Valdellon', credits: 32, duplicates: 4 },
  { email: 'ankitadas@aoglobelife.com', name: 'Ankita Das', credits: 32, duplicates: 4 },
  { email: 'arthurscott@aoglobelife.com', name: 'Arthur Scott', credits: 24, duplicates: 3 },
  { email: 'bridgetcallahan@aoglobelife.com', name: 'Bridget Callahan', credits: 16, duplicates: 2 },
  { email: 'richardlafond@aoglobelife.com', name: 'Richard Lafond', credits: 16, duplicates: 2 },
  { email: 'jameshannah@aoglobelife.com', name: 'Hannah James', credits: 16, duplicates: 2 },
  { email: 'joecasiasjr@aoglobelife.com', name: 'Joe Casias', credits: 16, duplicates: 2 },
  { email: 'francesbrewer@aoglobelife.com', name: 'Frances Brewer', credits: 16, duplicates: 2 },
  { email: 'smithterrell@aoglobelife.com', name: 'Terrell Smith', credits: 16, duplicates: 2 }
];

async function sendRefundNotification(agent) {
  const subject = 'AO Intelligence VDP Credits Refund';
  
  const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
    .highlight { background: #e8f5e9; padding: 15px; border-left: 4px solid #4caf50; margin: 20px 0; }
    .credits { font-size: 32px; font-weight: bold; color: #4caf50; }
    .footer { text-align: center; margin-top: 30px; color: #666; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>VDP Credits Refund</h1>
    </div>
    <div class="content">
      <p>Hi ${agent.name},</p>
      
      <p>We identified a technical issue that caused duplicate charges for some VDP (Voice Drop Pro) calls on <strong>November 4, 2025</strong>.</p>
      
      <div class="highlight">
        <p style="margin: 0;"><strong>Your Account Has Been Credited:</strong></p>
        <p class="credits">${agent.credits} Credits</p>
        <p style="margin: 0; color: #666;">This refund covers ${agent.duplicates} duplicate VDP ${agent.duplicates === 1 ? 'call' : 'calls'} (${agent.duplicates} × 8 credits)</p>
      </div>
      
      <p><strong>What happened?</strong><br>
      Our VDP system logged some calls twice, which resulted in duplicate charges. We've fixed this issue and ensured it won't happen again.</p>
      
      <p><strong>What we've done:</strong></p>
      <ul>
        <li>Identified all duplicate charges</li>
        <li>Added ${agent.credits} credits back to your account</li>
        <li>Implemented safeguards to prevent future duplicates</li>
        <li>Cleaned up the duplicate call records</li>
      </ul>
      
      <p>Your credits have been automatically added to your <strong>credits_purchased</strong> balance and are available for use immediately.</p>
      
      <p>We apologize for any inconvenience this may have caused. If you have any questions or concerns, please don't hesitate to reach out to our support team.</p>
      
      <p>Thank you for your patience and understanding.</p>
      
      <p>Best regards,<br>
      <strong>AO Intelligence Team</strong></p>
    </div>
    <div class="footer">
      <p>© 2025 AO Globe Life | AO Intelligence Platform</p>
    </div>
  </div>
</body>
</html>
  `;

  const formData = new URLSearchParams();
  formData.append('from', `AO Intelligence <${FROM_EMAIL}>`);
  formData.append('to', agent.email);
  formData.append('subject', subject);
  formData.append('html', html);

  try {
    const response = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`api:${MAILGUN_API_KEY}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`✅ Email sent to ${agent.name} (${agent.email}) - ${agent.credits} credits`);
      return true;
    } else {
      const error = await response.text();
      console.error(`❌ Failed to send to ${agent.email}: ${response.status} - ${error}`);
      return false;
    }
  } catch (error) {
    console.error(`❌ Error sending to ${agent.email}:`, error.message);
    return false;
  }
}

async function sendAllNotifications() {
  console.log('📧 Sending VDP refund notifications to all affected agents...\n');
  
  let successCount = 0;
  let failCount = 0;
  
  for (const agent of refunds) {
    const success = await sendRefundNotification(agent);
    if (success) {
      successCount++;
    } else {
      failCount++;
    }
    // Wait 500ms between emails to avoid rate limits
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 EMAIL SUMMARY');
  console.log('='.repeat(60));
  console.log(`✅ Sent: ${successCount}`);
  console.log(`❌ Failed: ${failCount}`);
  console.log(`📈 Total agents notified: ${successCount} of ${refunds.length}`);
  console.log(`💰 Total credits refunded: ${refunds.reduce((sum, a) => sum + a.credits, 0)}`);
}

sendAllNotifications().catch(console.error);

