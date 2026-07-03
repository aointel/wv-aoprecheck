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

## Deployment
1. Deploy to Replit with included configuration
2. Set environment variables in Replit Secrets
3. Configure Twilio TwiML App with webhook URLs
4. Set up Zapier webhooks for SMS integration

## Export Date
${new Date().toISOString()}

## Version
ConnectNow Enterprise CRM v1.0
`;

fs.writeFileSync(path.join(exportDir, 'EXPORT_README.md'), exportReadme);

// Create package.json with all dependencies
const packageJson = {
  "name": "connectnow-enterprise-crm",
  "version": "1.0.0",
  "description": "ConnectNow Enterprise CRM with WebRTC calling capabilities",
  "main": "server/index.ts",
  "scripts": {
    "dev": "tsx watch server/index.ts",
    "build": "vite build",
    "preview": "vite preview",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  },
  "dependencies": {
    "@chakra-ui/react": "^2.8.2",
    "@hookform/resolvers": "^3.3.4",
    "@neondatabase/serverless": "^0.9.0",
    "@radix-ui/react-accordion": "^1.1.2",
    "@radix-ui/react-alert-dialog": "^1.0.5",
    "@radix-ui/react-aspect-ratio": "^1.0.3",
    "@radix-ui/react-avatar": "^1.0.4",
    "@radix-ui/react-checkbox": "^1.0.4",
    "@radix-ui/react-collapsible": "^1.0.3",
    "@radix-ui/react-context-menu": "^2.1.5",
    "@radix-ui/react-dialog": "^1.0.5",
    "@radix-ui/react-dropdown-menu": "^2.0.6",
    "@radix-ui/react-hover-card": "^1.0.7",
    "@radix-ui/react-label": "^2.0.2",
    "@radix-ui/react-menubar": "^1.0.4",
    "@radix-ui/react-navigation-menu": "^1.1.4",
    "@radix-ui/react-popover": "^1.0.7",
    "@radix-ui/react-progress": "^1.0.3",
    "@radix-ui/react-radio-group": "^1.1.3",
    "@radix-ui/react-scroll-area": "^1.0.5",
    "@radix-ui/react-select": "^2.0.0",
    "@radix-ui/react-separator": "^1.0.3",
    "@radix-ui/react-slider": "^1.1.2",
    "@radix-ui/react-slot": "^1.0.2",
    "@radix-ui/react-switch": "^1.0.3",
    "@radix-ui/react-tabs": "^1.0.4",
    "@radix-ui/react-toast": "^1.1.5",
    "@radix-ui/react-toggle": "^1.0.3",
    "@radix-ui/react-toggle-group": "^1.0.4",
    "@radix-ui/react-tooltip": "^1.0.7",
    "@stripe/react-stripe-js": "^2.4.0",
    "@stripe/stripe-js": "^2.4.0",
    "@supabase/supabase-js": "^2.38.5",
    "@tanstack/react-query": "^5.17.15",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "cmdk": "^0.2.0",
    "date-fns": "^3.2.0",
    "drizzle-orm": "^0.29.3",
    "drizzle-zod": "^0.5.1",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "framer-motion": "^10.18.0",
    "lucide-react": "^0.307.0",
    "multer": "^1.4.5",
    "nodemailer": "^6.9.8",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-hook-form": "^7.48.2",
    "stripe": "^14.13.0",
    "tailwind-merge": "^2.2.0",
    "tailwindcss-animate": "^1.0.7",
    "twilio": "^4.20.1",
    "typescript": "^5.3.3",
    "wouter": "^3.0.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/express-session": "^1.17.10",
    "@types/multer": "^1.4.11",
    "@types/node": "^20.10.6",
    "@types/nodemailer": "^6.4.14",
    "@types/react": "^18.2.46",
    "@types/react-dom": "^18.2.18",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "drizzle-kit": "^0.20.9",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "tsx": "^4.7.0",
    "vite": "^5.0.10"
  }
}

fs.writeFileSync(path.join(exportDir, 'package.json'), JSON.stringify(packageJson, null, 2));

console.log('✅ Full export created in:', exportDir);
console.log('📦 Ready for deployment or transfer');