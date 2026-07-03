import formData from 'form-data';
import Mailgun from 'mailgun.js';
import fs from 'fs';
import path from 'path';

const MAILGUN_API_KEY = 'aa22ca853877ae0e08f8cca8f345059e-653fadca-9577b24a';
const MAILGUN_DOMAIN = 'mg.connectnow.one';

async function sendReportNow() {
  console.log('📧 Sending AO Precheck Report NOW...');
  
  // Read the HTML file
  const htmlPath = path.join(process.cwd(), 'test-verification-report.html');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  
  const mailgun = new Mailgun(formData);
  const mg = mailgun.client({ 
    username: 'api', 
    key: MAILGUN_API_KEY, 
    url: 'https://api.mailgun.net' 
  });
  
  try {
    const result = await mg.messages.create(MAILGUN_DOMAIN, {
      from: 'AO Intelligence Reports <noreply@mg.connectnow.one>',
      to: ['michaelmandella@aoglobelife.com'],
      subject: `AO Precheck Report - ${new Date().toLocaleDateString('en-US')}`,
      html: html
    });
    
    console.log('✅ Email sent successfully!');
    console.log('Result:', result);
  } catch (error: any) {
    console.error('❌ Mailgun error:', error);
    console.error('Status:', error.status);
    console.error('Details:', error.details);
  }
}

sendReportNow().then(() => process.exit(0));

