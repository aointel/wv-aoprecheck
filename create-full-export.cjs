const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Create export directory
const exportDir = 'connectnow-full-export';
if (!fs.existsSync(exportDir)) {
  fs.mkdirSync(exportDir);
}

// Core directories to include
const includeDirs = [
  'client',
  'server', 
  'shared',
  'migrations',
  'scripts'
];

// Core files to include
const includeFiles = [
  'package.json',
  'package-lock.json',
  'tsconfig.json',
  'vite.config.ts',
  'tailwind.config.ts',
  'postcss.config.js',
  'drizzle.config.ts',
  'components.json',
  'replit.md',
  'README.md',
  'DEPLOYMENT.md',
  'WEBHOOK_SETUP.md',
  '.env',
  '.replit',
  'replit.nix'
];

console.log('🚀 Creating ConnectNow Full Export...');

// Copy directories
includeDirs.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`📁 Copying ${dir}/`);
    fs.cpSync(dir, path.join(exportDir, dir), { recursive: true });
  }
});

// Copy individual files
includeFiles.forEach(file => {
  if (fs.existsSync(file)) {
    console.log(`📄 Copying ${file}`);
    fs.copyFileSync(file, path.join(exportDir, file));
  }
});

// Create documentation
const exportReadme = `# ConnectNow Enterprise CRM - Full Export

## Project Overview
ConnectNow is a comprehensive telecommunications and lead management platform with WebRTC calling capabilities using Twilio, integrated with Neon PostgreSQL database and Stripe payments.

## Key Features
- WebRTC outbound dialing with immediate agent-to-lead conference merging
- Credit-based billing system (50, 100, 200, 500 credit packages)
- Lead management with CCSV database integration
- Recruitment module (AORecruit)
- Admin panel with multi-user management
- Gamification with AOI Cards system
- SMS integration via Zapier webhooks
- Audio Center for professional audio setup

## Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Backend**: Node.js + Express.js
- **Database**: Supabase PostgreSQL (primary) + Neon PostgreSQL (fallback)
- **ORM**: Drizzle ORM
- **UI**: shadcn/ui + Tailwind CSS
- **Communication**: Twilio Voice API + WebRTC
- **State Management**: TanStack Query

## Quick Start

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Environment Setup
Create \`.env\` file with:
\`\`\`
DATABASE_URL=your_neon_postgresql_url
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key
TWILIO_ACCOUNT_SID=your_twilio_sid
TWILIO_AUTH_TOKEN=your_twilio_token
TWILIO_API_KEY=your_twilio_api_key
TWILIO_API_SECRET=your_twilio_api_secret
TWILIO_TWIML_APP_SID=your_twiml_app_sid
\`\`\`

### 3. Database Setup
\`\`\`bash
npm run db:push
\`\`\`

### 4. Start Development
\`\`\`bash
npm run dev
\`\`\`

## Architecture Notes

### Authentication
- Supabase authentication with multi-agent support
- Credit-based access control (minimum 5 credits required)
- Role-based permissions (Super Administrator, agent)

### WebRTC Implementation
- Each agent creates unique conference rooms (\`ConnectNow-{agentId}-{timestamp}\`)
- Immediate agent-to-lead conference merging
- Power On button initializes WebRTC session
- Start Dialing button handles conference creation and calling

### Database Structure
- **Primary**: Supabase PostgreSQL for production data
- **Secondary**: Local PostgreSQL with Neon connection for development
- **Tables**: veteran_leads, user_credits, customer_data, taalk2cn, outbound_leads, appointments

### Branding Rules
- Platform name: "ConnectNow" 
- Top-left logo: ALWAYS "AO Intelligence" (never change)
- Modules: Connect (Call Connector Pro), AORecruit, outbound dialing

## WebRTC Status (Export Date)
- Token generation: ✅ Working
- Device creation: ✅ Working
- Session registration: ❌ Network/firewall blocking Twilio connection
- Status: Device status remains "unknown" - requires network configuration

## Known Issues
1. WebRTC registration fails in Replit environment (firewall/network)
2. Need to test in different hosting environment for full WebRTC functionality
3. All other features (UI, database, API) fully functional

## Deployment Options
1. **Replit**: Current hosting (WebRTC limited)
2. **Vercel/Netlify**: Frontend + serverless functions
3. **VPS/Cloud**: Full control for WebRTC requirements
4. **Heroku**: Full stack deployment

## Export Date
${new Date().toISOString()}

## Version
ConnectNow Enterprise CRM v1.0
`;

fs.writeFileSync(path.join(exportDir, 'EXPORT_README.md'), exportReadme);

// Create setup instructions
const setupInstructions = `# ConnectNow Setup Instructions

## Prerequisites
- Node.js 18+ 
- PostgreSQL database (Supabase recommended)
- Twilio account with Voice API
- (Optional) Stripe account for payments

## Step-by-Step Setup

### 1. Install Dependencies
\`\`\`bash
npm install
\`\`\`

### 2. Environment Configuration
Copy \`.env.example\` to \`.env\` and fill in:

\`\`\`env
# Database
DATABASE_URL="postgresql://username:password@hostname:port/database"
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_ANON_KEY="your-anon-key"

# Twilio Configuration
TWILIO_ACCOUNT_SID="ACxxxxx"
TWILIO_AUTH_TOKEN="your-auth-token"
TWILIO_API_KEY="SKxxxxx"
TWILIO_API_SECRET="your-api-secret"
TWILIO_TWIML_APP_SID="APxxxxx"

# Optional: Stripe
STRIPE_PUBLIC_KEY="pk_test_xxxxx"
STRIPE_SECRET_KEY="sk_test_xxxxx"
\`\`\`

### 3. Database Setup
\`\`\`bash
# Push schema to database
npm run db:push

# (Optional) Open database studio
npm run db:studio
\`\`\`

### 4. Twilio Configuration
1. Create TwiML Application in Twilio Console
2. Set Voice webhook to: \`https://your-domain.com/api/voice\`
3. Copy Application SID to TWILIO_TWIML_APP_SID

### 5. Start Development
\`\`\`bash
npm run dev
\`\`\`

### 6. Production Deployment
See DEPLOYMENT.md for platform-specific instructions.

## Troubleshooting

### WebRTC Issues
- Ensure Twilio credentials are correct
- Check network/firewall allows WebRTC traffic
- Test in different hosting environment if issues persist

### Database Connection
- Verify DATABASE_URL format
- Check database accessibility from hosting environment
- Ensure SSL is properly configured

### Build Issues
- Clear node_modules and reinstall: \`rm -rf node_modules package-lock.json && npm install\`
- Check Node.js version compatibility
- Verify all environment variables are set
`;

fs.writeFileSync(path.join(exportDir, 'SETUP_INSTRUCTIONS.md'), setupInstructions);

console.log('✅ Full export created in:', exportDir);

// Create ZIP archive
const output = fs.createWriteStream('connectnow-full-export.zip');
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', function() {
  console.log('📦 ZIP archive created: connectnow-full-export.zip');
  console.log('📊 Total size:', archive.pointer() + ' bytes');
  console.log('🚀 Export complete! Ready for deployment or transfer.');
});

archive.on('error', function(err) {
  throw err;
});

archive.pipe(output);
archive.directory(exportDir, false);
archive.finalize();