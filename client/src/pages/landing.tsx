import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  Phone,
  Users,
  Calendar,
  Clock,
  BookOpen,
  TrendingUp,
  CheckCircle2,
  FileText,
  Award,
  Brain,
  ShieldCheck,
  Target,
  BarChart3,
  PlayCircle,
  Bookmark,
  GraduationCap,
  HelpCircle,
  ArrowRight,
  Video,
  FileText as FileTextIcon,
  ChevronLeft,
  ChevronRight,
  Zap,
  Presentation,
  Settings,
  DollarSign,
  MessageSquare,
  Video as VideoIcon,
  BarChart,
  UserCheck,
  Sparkles
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { AOIScore } from "@/components/aoi/AOIScore";
import { CustomLoader } from "@/components/ui/custom-loader";
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { ArticleModal } from "@/components/modals/ArticleModal";

// Comprehensive articles organized by section - "Getting Started" first, then creative ones
const platformArticles = [
  // CONNECT Section
  {
    id: 1,
    category: "CONNECT",
    title: "Getting Started with Call Connector",
    description: "Your complete beginner's guide to outbound dialing, lead queues, and call management",
    readTime: "8 min read",
    icon: Phone,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/outbound-dialer",
    content: `
      <h2>Welcome to Call Connector Pro</h2>
      <p>Call Connector Pro is your powerful outbound dialing platform designed to maximize your productivity and sales success.</p>
      
      <h3>Key Features</h3>
      <ul>
        <li><strong>Smart Lead Queues:</strong> Organize leads by priority, location, and status</li>
        <li><strong>Auto-Dialing:</strong> Streamlined dialing with one-click calling</li>
        <li><strong>Call Disposition:</strong> Quickly categorize and track call outcomes</li>
        <li><strong>Lead Management:</strong> Track progress, notes, and follow-ups</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Navigate to the Outbound Dialer from your dashboard</li>
        <li>Select your lead queue (My Leads, Plus Leads, or Hot Leads)</li>
        <li>Click "Ready to Launch" to start dialing</li>
        <li>Use the disposition buttons after each call to track outcomes</li>
      </ol>
    `
  },
  {
    id: 2,
    category: "CONNECT",
    title: "Mastering Lead Queue Strategies",
    description: "Advanced techniques for organizing leads, prioritizing calls, and maximizing conversion rates",
    readTime: "10 min read",
    icon: Target,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/outbound-dialer",
    content: `
      <h2>Lead Queue Mastery</h2>
      <p>Learn how to strategically organize and prioritize your leads for maximum efficiency.</p>
      
      <h3>Queue Types</h3>
      <ul>
        <li><strong>My Leads:</strong> Your assigned leads organized by box (In Town, Road Trip, etc.)</li>
        <li><strong>Plus Leads:</strong> High-value leads with premium features</li>
        <li><strong>Hot Leads:</strong> Priority leads requiring immediate attention</li>
      </ul>
      
      <h3>Pro Tips</h3>
      <ul>
        <li>Focus on priority 99 leads first for best results</li>
        <li>Use the search function to quickly find specific leads</li>
        <li>Track your position in each queue to manage workflow</li>
        <li>Switch between queues based on time zones and availability</li>
      </ul>
    `
  },
  {
    id: 3,
    category: "CONNECT",
    title: "Call Disposition Best Practices",
    description: "How to effectively categorize calls, track outcomes, and improve your follow-up process",
    readTime: "7 min read",
    icon: CheckCircle2,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/outbound-dialer",
    content: `
      <h2>Effective Call Disposition</h2>
      <p>Proper call disposition is crucial for tracking performance and managing follow-ups.</p>
      
      <h3>Common Dispositions</h3>
      <ul>
        <li><strong>Booked:</strong> Appointment scheduled - set callback date</li>
        <li><strong>Callback:</strong> Lead requested follow-up - schedule callback</li>
        <li><strong>Not Interested:</strong> Lead declined - mark appropriately</li>
        <li><strong>No Answer:</strong> No response - will retry later</li>
      </ul>
      
      <h3>Best Practices</h3>
      <ul>
        <li>Always disposition immediately after each call</li>
        <li>Add notes for context and follow-up reminders</li>
        <li>Set accurate callback dates for better scheduling</li>
        <li>Use consistent disposition categories for reporting</li>
      </ul>
    `
  },

  // INTELLIGENCE Section
  {
    id: 4,
    category: "INTELLIGENCE",
    title: "Getting Started with AO Intelligence",
    description: "Your introduction to AI-powered presentations, analytics, and automated workflows",
    readTime: "10 min read",
    icon: Brain,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-intel",
    content: `
      <h2>Welcome to AO Intelligence</h2>
      <p>AO Intelligence leverages AI to enhance your sales process, automate workflows, and provide powerful insights.</p>
      
      <h3>Core Features</h3>
      <ul>
        <li><strong>AI Presentations:</strong> Automated slide generation and presentation flow</li>
        <li><strong>Analytics Dashboard:</strong> Real-time performance metrics and insights</li>
        <li><strong>Lead Intelligence:</strong> AI-powered lead scoring and recommendations</li>
        <li><strong>Workflow Automation:</strong> Streamline repetitive tasks</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Access AO Intelligence from your dashboard</li>
        <li>Review your AOI Score to understand your performance</li>
        <li>Explore the analytics dashboard for insights</li>
        <li>Start your first AI-powered presentation</li>
      </ol>
    `
  },
  {
    id: 5,
    category: "INTELLIGENCE",
    title: "Unlocking AI Presentation Power",
    description: "Create stunning, personalized presentations that close more deals with AI assistance",
    readTime: "12 min read",
    icon: Presentation,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-intel",
    content: `
      <h2>AI-Powered Presentations</h2>
      <p>Transform your sales presentations with AI-generated content tailored to each prospect.</p>
      
      <h3>Presentation Features</h3>
      <ul>
        <li><strong>Dynamic Content:</strong> AI adapts slides based on client needs</li>
        <li><strong>Real-time Updates:</strong> Content updates as you gather information</li>
        <li><strong>Visual Analytics:</strong> Track engagement and optimize delivery</li>
        <li><strong>Custom Branding:</strong> Personalize with your company colors</li>
      </ul>
      
      <h3>Pro Tips</h3>
      <ul>
        <li>Let AI suggest the best slide flow for each client</li>
        <li>Use analytics to see which slides resonate most</li>
        <li>Customize AI suggestions to match your style</li>
        <li>Review and refine AI-generated content before presenting</li>
      </ul>
    `
  },
  {
    id: 6,
    category: "INTELLIGENCE",
    title: "Understanding Your AOI Score",
    description: "Decode your performance metrics, identify improvement areas, and reach elite status",
    readTime: "9 min read",
    icon: BarChart3,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-intel",
    content: `
      <h2>Your AOI Score Explained</h2>
      <p>Your AOI Score is a comprehensive metric that measures your overall performance across key areas.</p>
      
      <h3>Score Components</h3>
      <ul>
        <li><strong>Dial to Connect (20%):</strong> How efficiently you reach live people</li>
        <li><strong>Appointment Rate (20%):</strong> Your ability to book appointments</li>
        <li><strong>Presentation Rate (15%):</strong> Completion of full presentations</li>
        <li><strong>Closing Rate (25%):</strong> Your conversion success</li>
        <li><strong>Follow-up Consistency (10%):</strong> Consistent execution</li>
        <li><strong>Lead Quality (10%):</strong> Accuracy in lead qualification</li>
      </ul>
      
      <h3>Improving Your Score</h3>
      <ul>
        <li>Focus on improving your lowest-scoring component</li>
        <li>Track trends over time to see progress</li>
        <li>Compare with team averages for context</li>
        <li>Set specific goals for each component</li>
      </ul>
    `
  },

  // RECRUIT Section
  {
    id: 7,
    category: "RECRUIT",
    title: "Getting Started with AO Recruit",
    description: "Begin building your team with candidate management, interview scheduling, and tracking tools",
    readTime: "7 min read",
    icon: Users,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-recruit",
    content: `
      <h2>Welcome to AO Recruit</h2>
      <p>AO Recruit helps you build and manage your team with powerful candidate tracking and interview tools.</p>
      
      <h3>Key Features</h3>
      <ul>
        <li><strong>Candidate Management:</strong> Track candidates through the entire recruitment process</li>
        <li><strong>Interview Scheduling:</strong> Coordinate interviews with built-in calendar</li>
        <li><strong>Progress Tracking:</strong> Monitor candidate journey stages</li>
        <li><strong>Team Building:</strong> Build your organization efficiently</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Access AO Recruit from your dashboard</li>
        <li>Add your first candidate or import from a list</li>
        <li>Schedule an interview using the calendar</li>
        <li>Track progress through recruitment stages</li>
      </ol>
    `
  },
  {
    id: 8,
    category: "RECRUIT",
    title: "Building Your Dream Team",
    description: "Advanced strategies for identifying top talent, conducting effective interviews, and onboarding",
    readTime: "11 min read",
    icon: UserCheck,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-recruit",
    content: `
      <h2>Team Building Excellence</h2>
      <p>Learn how to identify, attract, and retain top performers for your organization.</p>
      
      <h3>Recruitment Strategies</h3>
      <ul>
        <li><strong>Targeted Sourcing:</strong> Find candidates who fit your culture</li>
        <li><strong>Effective Screening:</strong> Use tools to identify best matches</li>
        <li><strong>Structured Interviews:</strong> Consistent evaluation process</li>
        <li><strong>Onboarding Excellence:</strong> Set new hires up for success</li>
      </ul>
      
      <h3>Pro Tips</h3>
      <ul>
        <li>Use the candidate journey tracker to identify bottlenecks</li>
        <li>Schedule interviews during optimal times for both parties</li>
        <li>Follow up promptly to maintain candidate interest</li>
        <li>Track metrics to improve your recruitment process</li>
      </ul>
    `
  },
  {
    id: 9,
    category: "RECRUIT",
    title: "Mastering Candidate Journey Tracking",
    description: "Optimize your recruitment pipeline with stage-based tracking and analytics",
    readTime: "8 min read",
    icon: TrendingUp,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-recruit",
    content: `
      <h2>Candidate Journey Optimization</h2>
      <p>Track candidates through each stage of recruitment to identify improvements and accelerate hiring.</p>
      
      <h3>Journey Stages</h3>
      <ul>
        <li><strong>Initial Contact:</strong> First outreach and response</li>
        <li><strong>Qualification:</strong> Assessing fit and interest</li>
        <li><strong>Interview:</strong> Meeting and evaluation</li>
        <li><strong>Offer:</strong> Extending and negotiating</li>
        <li><strong>Onboarding:</strong> Integration into team</li>
      </ul>
      
      <h3>Optimization Tips</h3>
      <ul>
        <li>Identify which stages have the highest drop-off rates</li>
        <li>Reduce time between stages to maintain momentum</li>
        <li>Use analytics to predict candidate success</li>
        <li>Automate follow-ups to stay top-of-mind</li>
      </ul>
    `
  },

  // PRECHECK Section
  {
    id: 10,
    category: "PRECHECK",
    title: "Getting Started with AO Precheck",
    description: "Learn verification workflows, screenshot validation, and client approval processes",
    readTime: "6 min read",
    icon: ShieldCheck,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-precheck",
    content: `
      <h2>Welcome to AO Precheck</h2>
      <p>AO Precheck ensures compliance and verification through automated screenshot validation and approval workflows.</p>
      
      <h3>Core Features</h3>
      <ul>
        <li><strong>Screenshot Validation:</strong> AI-powered verification of submitted screenshots</li>
        <li><strong>Client Approval:</strong> Streamlined approval process</li>
        <li><strong>Compliance Tracking:</strong> Ensure all requirements are met</li>
        <li><strong>Workflow Management:</strong> Track verification status</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Access AO Precheck from your dashboard</li>
        <li>Start a new verification session</li>
        <li>Submit required screenshots</li>
        <li>Track approval status</li>
      </ol>
    `
  },
  {
    id: 11,
    category: "PRECHECK",
    title: "AI-Powered Verification Mastery",
    description: "Leverage AI to validate screenshots, detect issues, and ensure perfect compliance",
    readTime: "9 min read",
    icon: Sparkles,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-precheck",
    content: `
      <h2>AI Verification Excellence</h2>
      <p>Use AI-powered validation to ensure accuracy and compliance in your verification process.</p>
      
      <h3>AI Capabilities</h3>
      <ul>
        <li><strong>Image Analysis:</strong> AI reviews screenshots for completeness</li>
        <li><strong>Issue Detection:</strong> Automatically flags potential problems</li>
        <li><strong>Quality Scoring:</strong> Rates submission quality</li>
        <li><strong>Smart Suggestions:</strong> Recommends improvements</li>
      </ul>
      
      <h3>Best Practices</h3>
      <ul>
        <li>Ensure screenshots are clear and complete</li>
        <li>Follow AI suggestions for better results</li>
        <li>Review AI feedback before resubmitting</li>
        <li>Use AI insights to improve your process</li>
      </ul>
    `
  },

  // MEET Section
  {
    id: 12,
    category: "MEETINGS",
    title: "Getting Started with AO Meet",
    description: "Master appointment scheduling, Zoom integrations, and presentation tracking",
    readTime: "9 min read",
    icon: Calendar,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-meet",
    content: `
      <h2>Welcome to AO Meet</h2>
      <p>AO Meet streamlines your appointment scheduling and meeting management with powerful integrations.</p>
      
      <h3>Key Features</h3>
      <ul>
        <li><strong>Smart Scheduling:</strong> Automated appointment booking</li>
        <li><strong>Zoom Integration:</strong> Seamless video meeting setup</li>
        <li><strong>Presentation Tracking:</strong> Monitor meeting progress</li>
        <li><strong>Calendar Sync:</strong> Keep everything in sync</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Connect your calendar and Zoom account</li>
        <li>Set your availability preferences</li>
        <li>Schedule your first appointment</li>
        <li>Track presentations and outcomes</li>
      </ol>
    `
  },
  {
    id: 13,
    category: "MEETINGS",
    title: "Zoom Integration Secrets",
    description: "Maximize your Zoom meetings with automated setup, recording, and follow-up workflows",
    readTime: "10 min read",
    icon: Video,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/ao-meet",
    content: `
      <h2>Zoom Integration Mastery</h2>
      <p>Unlock the full potential of Zoom integration for seamless meeting experiences.</p>
      
      <h3>Integration Features</h3>
      <ul>
        <li><strong>Auto-Join:</strong> Automatic meeting room joining</li>
        <li><strong>Recording Management:</strong> Automatic recording and storage</li>
        <li><strong>Waiting Room:</strong> Professional client experience</li>
        <li><strong>Follow-up Automation:</strong> Post-meeting workflows</li>
      </ul>
      
      <h3>Pro Tips</h3>
      <ul>
        <li>Set up automated meeting reminders</li>
        <li>Use waiting rooms for professional touch</li>
        <li>Enable automatic recording for review</li>
        <li>Configure follow-up emails automatically</li>
      </ul>
    `
  },

  // ANALYTICS Section
  {
    id: 14,
    category: "ANALYTICS",
    title: "Getting Started with Analytics",
    description: "Navigate your performance dashboard, understand metrics, and make data-driven decisions",
    readTime: "8 min read",
    icon: BarChart3,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/analytics",
    content: `
      <h2>Welcome to Analytics</h2>
      <p>Your analytics dashboard provides powerful insights into your performance and helps you make informed decisions.</p>
      
      <h3>Key Metrics</h3>
      <ul>
        <li><strong>Call Performance:</strong> Dial, connect, and conversion rates</li>
        <li><strong>Sales Metrics:</strong> Revenue, policies sold, and trends</li>
        <li><strong>Time Analysis:</strong> Call duration and efficiency</li>
        <li><strong>Trend Reports:</strong> Performance over time</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Review your dashboard overview</li>
        <li>Explore different metric categories</li>
        <li>Set up custom date ranges</li>
        <li>Export reports for analysis</li>
      </ol>
    `
  },
  {
    id: 15,
    category: "ANALYTICS",
    title: "Advanced Reporting Techniques",
    description: "Create custom reports, identify trends, and use data to optimize your sales strategy",
    readTime: "11 min read",
    icon: BarChart,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/analytics",
    content: `
      <h2>Advanced Reporting</h2>
      <p>Go beyond basic metrics with advanced reporting and analysis techniques.</p>
      
      <h3>Report Types</h3>
      <ul>
        <li><strong>Performance Reports:</strong> Detailed activity analysis</li>
        <li><strong>Trend Analysis:</strong> Identify patterns over time</li>
        <li><strong>Comparative Reports:</strong> Compare periods or teams</li>
        <li><strong>Custom Dashboards:</strong> Build your own views</li>
      </ul>
      
      <h3>Analysis Techniques</h3>
      <ul>
        <li>Identify peak performance times</li>
        <li>Compare metrics across different periods</li>
        <li>Spot trends before they become problems</li>
        <li>Use data to set realistic goals</li>
      </ul>
    `
  },

  // BILLING Section
  {
    id: 16,
    category: "BILLING",
    title: "Getting Started with Billing",
    description: "Understand credit systems, track usage, and manage your platform costs effectively",
    readTime: "5 min read",
    icon: DollarSign,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/billing-dashboard",
    content: `
      <h2>Welcome to Billing</h2>
      <p>Manage your credits, track usage, and optimize costs with our comprehensive billing system.</p>
      
      <h3>Key Features</h3>
      <ul>
        <li><strong>Credit Management:</strong> Monitor and manage your credits</li>
        <li><strong>Usage Tracking:</strong> See exactly how credits are used</li>
        <li><strong>Billing Reports:</strong> Detailed usage breakdowns</li>
        <li><strong>Cost Optimization:</strong> Identify savings opportunities</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Check your current credit balance</li>
        <li>Review recent usage and transactions</li>
        <li>Set up usage alerts if needed</li>
        <li>Explore billing reports</li>
      </ol>
    `
  },
  {
    id: 17,
    category: "BILLING",
    title: "Credit Optimization Strategies",
    description: "Maximize value from your credits, reduce waste, and get the most from your investment",
    readTime: "7 min read",
    icon: Zap,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/billing-dashboard",
    content: `
      <h2>Credit Optimization</h2>
      <p>Learn how to get maximum value from your credit allocation and reduce unnecessary spending.</p>
      
      <h3>Optimization Tips</h3>
      <ul>
        <li><strong>Track Usage Patterns:</strong> Identify peak usage times</li>
        <li><strong>Eliminate Waste:</strong> Remove unused features or services</li>
        <li><strong>Batch Operations:</strong> Group activities for efficiency</li>
        <li><strong>Monitor Trends:</strong> Spot unusual usage patterns</li>
      </ul>
      
      <h3>Best Practices</h3>
      <ul>
        <li>Review billing reports monthly</li>
        <li>Set budgets for different services</li>
        <li>Use credits strategically during peak times</li>
        <li>Take advantage of bulk credit discounts</li>
      </ul>
    `
  },

  // TRAINING Section
  {
    id: 18,
    category: "TRAINING",
    title: "Getting Started with Training",
    description: "Access video tutorials, interactive guides, and certification programs to level up your skills",
    readTime: "12 min read",
    icon: GraduationCap,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/training",
    content: `
      <h2>Welcome to Training Academy</h2>
      <p>Your comprehensive learning center with courses, certifications, and resources to master the platform.</p>
      
      <h3>Training Resources</h3>
      <ul>
        <li><strong>Video Tutorials:</strong> Step-by-step video guides</li>
        <li><strong>Interactive Courses:</strong> Hands-on learning experiences</li>
        <li><strong>Certification Programs:</strong> Earn credentials</li>
        <li><strong>Knowledge Base:</strong> Searchable documentation</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Browse available courses by category</li>
        <li>Start with beginner courses</li>
        <li>Track your progress</li>
        <li>Earn certificates as you complete courses</li>
      </ol>
    `
  },
  {
    id: 19,
    category: "TRAINING",
    title: "Certification Path Mastery",
    description: "Navigate certification programs, track progress, and become a platform expert",
    readTime: "10 min read",
    icon: Award,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/training",
    content: `
      <h2>Certification Excellence</h2>
      <p>Earn certifications to demonstrate your expertise and advance your career.</p>
      
      <h3>Certification Levels</h3>
      <ul>
        <li><strong>Beginner:</strong> Foundation skills and basics</li>
        <li><strong>Intermediate:</strong> Advanced features and workflows</li>
        <li><strong>Expert:</strong> Master-level techniques</li>
        <li><strong>Specialist:</strong> Focused expertise areas</li>
      </ul>
      
      <h3>Certification Benefits</h3>
      <ul>
        <li>Demonstrate expertise to clients</li>
        <li>Unlock advanced features</li>
        <li>Access exclusive resources</li>
        <li>Join expert communities</li>
      </ul>
    `
  },

  // LIVE BOARD Section
  {
    id: 20,
    category: "LIVE BOARD",
    title: "Getting Started with Live Call Board",
    description: "Monitor team performance in real-time, track metrics, and optimize team productivity",
    readTime: "7 min read",
    icon: Target,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/live-call-board",
    content: `
      <h2>Welcome to Live Call Board</h2>
      <p>Real-time team performance monitoring and analytics to help you manage and optimize your team.</p>
      
      <h3>Key Features</h3>
      <ul>
        <li><strong>Real-time Metrics:</strong> Live performance data</li>
        <li><strong>Team Leaderboards:</strong> See top performers</li>
        <li><strong>Activity Monitoring:</strong> Track team activity</li>
        <li><strong>Performance Alerts:</strong> Get notified of important events</li>
      </ul>
      
      <h3>Getting Started</h3>
      <ol>
        <li>Access Live Call Board from dashboard</li>
        <li>View real-time team metrics</li>
        <li>Explore leaderboards and rankings</li>
        <li>Set up performance alerts</li>
      </ol>
    `
  },
  {
    id: 21,
    category: "LIVE BOARD",
    title: "Team Performance Optimization",
    description: "Use live data to identify opportunities, coach team members, and drive results",
    readTime: "9 min read",
    icon: TrendingUp,
    gradient: "from-blue-600 via-purple-600 to-blue-700",
    link: "/dashboard/live-call-board",
    content: `
      <h2>Team Optimization</h2>
      <p>Leverage live performance data to improve team results and individual performance.</p>
      
      <h3>Optimization Strategies</h3>
      <ul>
        <li><strong>Identify Top Performers:</strong> Learn from the best</li>
        <li><strong>Spot Struggling Agents:</strong> Provide timely support</li>
        <li><strong>Team Benchmarks:</strong> Set realistic goals</li>
        <li><strong>Real-time Coaching:</strong> Immediate feedback</li>
      </ul>
      
      <h3>Best Practices</h3>
      <ul>
        <li>Review live board regularly throughout the day</li>
        <li>Use data to guide coaching conversations</li>
        <li>Celebrate wins and recognize achievements</li>
        <li>Address issues before they become problems</li>
      </ul>
    `
  }
];

const recentActivity = [
  { section: "CONNECT", title: "Call Connector Training", progress: 12, total: 16, icon: Phone, color: "text-blue-600", bgColor: "from-blue-50 to-blue-100" },
  { section: "MEET", title: "AO Meet Appointment Booked", progress: 1, total: 1, icon: Calendar, color: "text-emerald-600", bgColor: "from-emerald-50 to-emerald-100" },
  { section: "PRECHECK", title: "Precheck Verification Complete", progress: 3, total: 5, icon: ShieldCheck, color: "text-amber-600", bgColor: "from-amber-50 to-amber-100" },
  { section: "AO RECRUIT", title: "Recruitment Best Practices", progress: 8, total: 20, icon: Users, color: "text-indigo-600", bgColor: "from-indigo-50 to-indigo-100" }
];

const myCourses = [
  {
    id: 1,
    name: "Mastering Call Connector",
    lessons: "15/15",
    status: "Complete",
    level: "Intermediate",
    category: "Connect",
    icon: Phone,
    color: "blue"
  },
  {
    id: 2,
    name: "AO Intelligence Basics",
    lessons: "12/15",
    status: "Ongoing",
    level: "Beginner",
    category: "Intelligence",
    icon: Brain,
    color: "purple"
  },
  {
    id: 3,
    name: "Advanced Recruitment",
    lessons: "8/20",
    status: "Ongoing",
    level: "Expert",
    category: "Recruit",
    icon: Users,
    color: "indigo"
  }
];

const courseTopicData = [
  { name: "Connect", value: 40, color: "#3b82f6" },
  { name: "Intelligence", value: 30, color: "#8b5cf6" },
  { name: "Recruit", value: 20, color: "#6366f1" },
  { name: "Precheck", value: 10, color: "#f59e0b" }
];

export default function Landing() {
  const { authState } = useAuth();
  const { user } = authState;
  const [location] = useLocation();
  const userEmail = user?.email || 'cnsysop@aoglobelife.com';
  const firstName = authState.profile?.firstName
    || (authState.profile as any)?.first_name
    || (user as any)?.user_metadata?.first_name
    || (user as any)?.user_metadata?.full_name?.split(' ')[0]
    || userEmail?.split('@')[0]
    || 'there';
  const displayName = typeof firstName === 'string' ? firstName.charAt(0).toUpperCase() + firstName.slice(1).toLowerCase() : 'there';
  const [currentArticleIndex, setCurrentArticleIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [articleImages, setArticleImages] = useState<Record<number, string>>({});
  const [selectedArticle, setSelectedArticle] = useState<typeof platformArticles[0] | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('CONNECT');
  const { toast } = useToast();

  // Get unique categories
  const categories = Array.from(new Set(platformArticles.map(a => a.category)));
  const currentCategoryIndex = categories.indexOf(selectedCategory);
  const nextCategory = categories[currentCategoryIndex + 1] || categories[0];
  
  // Filter articles by selected category
  const filteredArticles = platformArticles.filter(a => a.category === selectedCategory);
  // Always show 6 articles: current category first, then fill from others
  const articlesToShow = filteredArticles.length >= 6
    ? filteredArticles.slice(0, 6)
    : [...filteredArticles, ...platformArticles.filter(a => a.category !== selectedCategory)].slice(0, 6);

  // Fetch dashboard stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/dashboard/landing-stats'],
    queryFn: async () => {
      return {
        ongoing: 5,
        complete: 37,
        certificates: 25,
        hoursSpent: 705
      };
    }
  });

  // Generate images for articles
  const generateImageMutation = useMutation({
    mutationFn: async (article: typeof platformArticles[0]) => {
      const response = await fetch('/api/landing/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          articleTitle: article.title,
          category: article.category,
          description: article.description
        })
      });
      if (!response.ok) throw new Error('Failed to generate image');
      const data = await response.json();
      return { articleId: article.id, imageUrl: data.imageUrl };
    },
    onSuccess: (data) => {
      setArticleImages(prev => ({ ...prev, [data.articleId]: data.imageUrl }));
    },
    onError: (error) => {
      console.error('Failed to generate image:', error);
    }
  });

  // Generate images for visible articles when category changes
  useEffect(() => {
    // Generate images for first 4 articles in current category
    filteredArticles.slice(0, 4).forEach(article => {
      if (!articleImages[article.id]) {
        generateImageMutation.mutate(article);
      }
    });
    // Also generate for hero article
    if (currentArticle && !articleImages[currentArticle.id]) {
      generateImageMutation.mutate(currentArticle);
    }
  }, [selectedCategory]);


  // Rotate articles within current category every 5 seconds
  useEffect(() => {
    if (isPaused) return;
    
    const interval = setInterval(() => {
      setCurrentArticleIndex((prev) => (prev + 1) % filteredArticles.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [isPaused, filteredArticles.length]);

  // Reset to first article when category changes
  useEffect(() => {
    setCurrentArticleIndex(0);
  }, [selectedCategory]);

  const currentArticle = filteredArticles[currentArticleIndex] || filteredArticles[0];
  const ArticleIcon = currentArticle?.icon || Phone;

  const goToArticle = (index: number) => {
    setCurrentArticleIndex(index);
    // Generate image if not already generated
    if (!articleImages[filteredArticles[index].id]) {
      generateImageMutation.mutate(filteredArticles[index]);
    }
  };

  const goToPrevious = () => {
    const newIndex = (currentArticleIndex - 1 + filteredArticles.length) % filteredArticles.length;
    goToArticle(newIndex);
  };

  const goToNext = () => {
    const newIndex = (currentArticleIndex + 1) % filteredArticles.length;
    goToArticle(newIndex);
  };

  const openArticleModal = (article: typeof platformArticles[0]) => {
    setSelectedArticle(article);
    setIsModalOpen(true);
    // Generate image if not already generated
    if (!articleImages[article.id]) {
      generateImageMutation.mutate(article);
    }
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <CustomLoader size="lg" text="Loading dashboard..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      <div className="p-6 space-y-6">
        {/* Welcome greeting */}
        <div className="flex flex-col">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100 tracking-tight">
            Welcome, {displayName}
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-0.5">
            Here&apos;s your overview for today
          </p>
        </div>

        {/* Hero | AOI Score (same row, same height); AOI Score column half width */}
        <div className="grid grid-cols-1 lg:grid-cols-6 gap-6">
          {/* Hero tile */}
          <div className="lg:col-span-5 order-1">
            <div
              className="relative overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-purple-700 rounded-3xl p-6 text-white shadow-2xl min-h-[200px] h-full"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              {currentArticle && articleImages[currentArticle.id] && (
                <div className="absolute inset-0 opacity-20">
                  <img
                    src={articleImages[currentArticle.id]}
                    alt={currentArticle.title}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="absolute inset-0 bg-black/30" />
              <div className="relative z-10">
                {currentArticle && (
                  <>
                    <Badge className="bg-white/20 text-white border-0 backdrop-blur-sm mb-2 text-xs px-2 py-0.5">
                      {currentArticle.category}
                    </Badge>
                    <h1 className="text-2xl font-bold mb-2 tracking-tight">
                      {currentArticle.title}
                    </h1>
                    <p className="text-sm text-blue-100 font-medium mb-3 max-w-2xl line-clamp-2">
                      {currentArticle.description}
                    </p>
                    <div className="flex items-center gap-4">
                      <Button
                        className="bg-white/20 hover:bg-white/30 text-white border border-white/30 backdrop-blur-sm h-8 px-4 text-xs"
                        onClick={() => openArticleModal(currentArticle)}
                      >
                        Read Article
                        <ArrowRight className="h-3 w-3 ml-1" />
                      </Button>
                      <div className="flex items-center gap-2">
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 h-6 w-6"
                            onClick={goToPrevious}
                          >
                            <ChevronLeft className="h-3 w-3" />
                          </Button>
                          <div className="flex gap-1 items-center">
                            {filteredArticles.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => goToArticle(index)}
                                className={`h-1.5 rounded-full transition-all ${
                                  index === currentArticleIndex ? "bg-white w-6" : "bg-white/40 w-1.5 hover:bg-white/60"
                                }`}
                                aria-label={`Go to article ${index + 1}`}
                              />
                            ))}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 h-6 w-6"
                            onClick={goToNext}
                          >
                            <ChevronRight className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="flex items-center gap-1 text-blue-100">
                          <FileTextIcon className="h-3 w-3" />
                          <span className="text-xs">{currentArticle.readTime}</span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
              <div className="absolute top-0 right-0 -mt-2 -mr-2 w-16 h-16 bg-white/10 rounded-full blur-sm" />
              <div className="absolute bottom-0 left-0 -mb-4 -ml-4 w-20 h-20 bg-white/5 rounded-full blur-sm" />
              {currentArticle && (
                <div className="absolute top-1/2 right-8 -translate-y-1/2 opacity-10">
                  <ArticleIcon className="h-20 w-20 text-white" />
                </div>
              )}
            </div>
          </div>
          {/* AOI Score - minimal, right of Hero, half-width column */}
          <div className="lg:col-span-1 order-2 min-h-[200px]">
            <AOIScore agentEmail={userEmail} minimal className="h-full" />
          </div>
        </div>

        {/* Platform Articles (left, below hero) | Recent Activity (right) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platform Articles - left, 3 columns 1 row */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 lg:col-span-2 order-1">
            <CardHeader>
              <CardTitle className="text-xl font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                Platform Articles
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4 overflow-x-auto pb-2 border-b border-slate-200 dark:border-slate-700">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`text-sm font-semibold transition-colors whitespace-nowrap ${
                      category === selectedCategory
                        ? "text-blue-600 dark:text-blue-400"
                        : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {articlesToShow.slice(0, 3).map((article) => {
                    const Icon = article.icon;
                    const hasImage = articleImages[article.id];
                    return (
                      <Card
                        key={article.id}
                        className="overflow-hidden cursor-pointer hover:shadow-md transition-all border-slate-200 dark:border-slate-700"
                        onClick={() => openArticleModal(article)}
                      >
                        <div className={`h-24 bg-gradient-to-br ${article.gradient} relative overflow-hidden`}>
                          {hasImage ? (
                            <img
                              src={articleImages[article.id]}
                              alt={article.title}
                              className="w-full h-full object-cover opacity-80"
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                              <Icon className="h-12 w-12 text-white" />
                            </div>
                          )}
                          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/80 via-purple-600/80 to-blue-700/80" />
                          <Badge className="absolute top-2 left-2 bg-white/20 text-white border-0 text-[10px]">
                            {article.category}
                          </Badge>
                        </div>
                        <CardContent className="p-3">
                          <h3 className="font-semibold text-sm mb-1 text-slate-900 dark:text-slate-100 line-clamp-2">
                            {article.title}
                          </h3>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mb-2 line-clamp-2">
                            {article.description}
                          </p>
                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">{article.readTime}</span>
                            <Button variant="ghost" size="sm" className="h-6 px-2 text-xs">
                              Read <ArrowRight className="h-3 w-3 ml-0.5" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

          {/* Recent Activity - right */}
          <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 lg:col-span-1 order-2">
            <CardHeader>
              <CardTitle className="text-xl font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {recentActivity.map((item) => {
                const Icon = item.icon;
                const progress = (item.progress / item.total) * 100;
                return (
                  <div key={`${item.section}-${item.title}`}>
                    <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
                      {item.section}
                    </div>
                    <div className="flex items-center gap-3">
                      <div
                        className={`h-12 w-12 rounded-lg bg-gradient-to-br ${item.bgColor} dark:from-slate-700 dark:to-slate-800 flex items-center justify-center flex-shrink-0`}
                      >
                        <Icon className={`h-6 w-6 ${item.color}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-2">
                          {item.title}
                        </p>
                        <div className="relative h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full bg-gradient-to-r ${item.bgColor}`}
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-500 dark:text-slate-400 mt-1 block">
                          {item.progress}/{item.total}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Summary Cards - hidden */}
        <div className="hidden grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 border-blue-200 dark:border-blue-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-1">Ongoing</p>
                  <p className="text-3xl font-bold text-blue-800 dark:text-blue-200">{stats?.ongoing || 5}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-blue-200 dark:bg-blue-800/50 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-blue-700 dark:text-blue-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/20 dark:to-green-800/20 border-green-200 dark:border-green-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-green-700 dark:text-green-300 mb-1">Complete</p>
                  <p className="text-3xl font-bold text-green-800 dark:text-green-200">{stats?.complete || 37}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-green-200 dark:bg-green-800/50 flex items-center justify-center">
                  <CheckCircle2 className="h-6 w-6 text-green-700 dark:text-green-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 border-orange-200 dark:border-orange-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">Certificates</p>
                  <p className="text-3xl font-bold text-orange-800 dark:text-orange-200">{stats?.certificates || 25}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-orange-200 dark:bg-orange-800/50 flex items-center justify-center">
                  <Award className="h-6 w-6 text-orange-700 dark:text-orange-300" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-purple-700 dark:text-purple-300 mb-1">Hours Spent</p>
                  <p className="text-3xl font-bold text-purple-800 dark:text-purple-200">{stats?.hoursSpent || 705}</p>
                </div>
                <div className="h-12 w-12 rounded-lg bg-purple-200 dark:bg-purple-800/50 flex items-center justify-center">
                  <Clock className="h-6 w-6 text-purple-700 dark:text-purple-300" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>



        {/* Main Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - My Courses */}
          <div className="lg:col-span-2 space-y-8">
            {/* My Courses Table */}
            <div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent mb-6">
                My Courses
              </h2>
              <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-200 dark:divide-slate-700">
                    {myCourses.map((course) => {
                      const Icon = course.icon;
                      const progress = parseInt(course.lessons.split('/')[0]) / parseInt(course.lessons.split('/')[1]) * 100;
                      const colorClasses = {
                        blue: {
                          icon: "text-blue-600 dark:text-blue-400",
                          bg: "bg-blue-100 dark:bg-blue-900/30",
                          badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                        },
                        purple: {
                          icon: "text-purple-600 dark:text-purple-400",
                          bg: "bg-purple-100 dark:bg-purple-900/30",
                          badge: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                        },
                        indigo: {
                          icon: "text-indigo-600 dark:text-indigo-400",
                          bg: "bg-indigo-100 dark:bg-indigo-900/30",
                          badge: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
                        }
                      };
                      const colors = colorClasses[course.color as keyof typeof colorClasses];
                      return (
                        <div key={course.id} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className={`h-12 w-12 rounded-lg ${colors.bg} flex items-center justify-center flex-shrink-0`}>
                              <Icon className={`h-6 w-6 ${colors.icon}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-2">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">{course.name}</h3>
                                <span className="text-sm text-slate-600 dark:text-slate-400">{course.lessons}</span>
                              </div>
                              <div className="flex items-center gap-2 mb-3">
                                <Badge 
                                  variant={course.status === 'Complete' ? 'default' : 'secondary'}
                                  className={course.status === 'Complete' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0' : colors.badge}
                                >
                                  {course.status}
                                </Badge>
                                <span className="text-sm text-slate-500 dark:text-slate-400">{course.level}</span>
                                <span className="text-sm text-slate-500 dark:text-slate-400">•</span>
                                <span className="text-sm text-slate-500 dark:text-slate-400">{course.category}</span>
                              </div>
                              <Progress value={progress} className="h-2" />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right Column - Charts & Continue Learning */}
          <div className="space-y-8">
            {/* Course Topic Chart - hidden */}
            <Card className="hidden bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700">
              <CardHeader>
                <CardTitle className="text-xl font-semibold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
                  Course Topic
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ChartContainer
                  config={{
                    connect: { label: "Connect", color: "#3b82f6" },
                    intelligence: { label: "Intelligence", color: "#8b5cf6" },
                    recruit: { label: "Recruit", color: "#6366f1" },
                    precheck: { label: "Precheck", color: "#f59e0b" }
                  }}
                  className="h-[200px]"
                >
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={courseTopicData}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={70}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {courseTopicData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                    </PieChart>
                  </ResponsiveContainer>
                </ChartContainer>
                <div className="text-center mt-4">
                  <p className="text-3xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">42</p>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Total Courses</p>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>

      {/* Article Modal */}
      <ArticleModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        article={selectedArticle}
      />
    </div>
  );
}
