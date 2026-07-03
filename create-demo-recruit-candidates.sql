-- Create demo recruit candidates with AI summaries for cnsysop@aoglobelife.com
-- These will be used for testing Call Connector Pro (AO Recruit)

-- First, insert into recruit_candidates table
INSERT INTO recruit_candidates (
  first_name,
  last_name,
  phone,
  email,
  city,
  state,
  zip_code,
  status,
  position,
  experience,
  agent_id,
  agent_email,
  current_stage_id,
  ai_summary,
  notes,
  created_at,
  updated_at
) VALUES
-- Candidate 1: John Smith - Experienced Sales Professional
(
  'John',
  'Smith',
  '+15035551234',
  'john.smith@example.com',
  'Denver',
  'CO',
  '80202',
  'new',
  'Sales Agent',
  '5 years insurance sales experience',
  '999',
  'cnsysop@aoglobelife.com',
  1,
  '[{"key":"Background","value":"John has 5 years of experience in insurance sales, previously worked at State Farm. Strong communication skills and proven track record of meeting sales goals."},{"key":"Interest Level","value":"High interest in joining the team. Currently exploring opportunities and looking for a company with good growth potential."},{"key":"Availability","value":"Available to start within 2 weeks. Prefers full-time position with flexible scheduling."},{"key":"Compensation Expectations","value":"Looking for base salary plus commission structure. Expects to earn $50k+ in first year."},{"key":"Next Steps","value":"Follow up in 3 days to discuss interview scheduling. Send company overview and benefits package."}]',
  'Demo candidate for testing Call Connector Pro (Recruit)',
  NOW(),
  NOW()
),
-- Candidate 2: Sarah Johnson - Recent Graduate
(
  'Sarah',
  'Johnson',
  '+15035552345',
  'sarah.johnson@example.com',
  'Phoenix',
  'AZ',
  '85001',
  'new',
  'Entry Level Sales',
  'Recent graduate, internship experience',
  '999',
  'cnsysop@aoglobelife.com',
  1,
  '[{"key":"Background","value":"Recent college graduate with degree in Business Administration. Completed summer internship at local insurance agency. Eager to start career in sales."},{"key":"Interest Level","value":"Very interested in entry-level opportunity. Enthusiastic about learning and growing within the company."},{"key":"Availability","value":"Immediately available. Flexible with schedule and willing to work weekends if needed."},{"key":"Compensation Expectations","value":"Open to entry-level compensation. Focused on learning and career development opportunities."},{"key":"Next Steps","value":"Schedule phone interview to discuss training program and growth opportunities. Send application form."}]',
  'Demo candidate for testing Call Connector Pro (Recruit)',
  NOW(),
  NOW()
),
-- Candidate 3: Michael Chen - Career Changer
(
  'Michael',
  'Chen',
  '+15035553456',
  'michael.chen@example.com',
  'Seattle',
  'WA',
  '98101',
  'new',
  'Sales Representative',
  '10 years customer service, transitioning to sales',
  '999',
  'cnsysop@aoglobelife.com',
  1,
  '[{"key":"Background","value":"10 years of customer service experience in retail and hospitality. Strong interpersonal skills and problem-solving abilities. Looking to transition into sales role."},{"key":"Interest Level","value":"Moderate interest. Wants to learn more about commission structure and training program before making decision."},{"key":"Availability","value":"Can start in 4 weeks after giving notice to current employer. Prefers daytime schedule."},{"key":"Compensation Expectations","value":"Needs to maintain current income level ($45k). Interested in base + commission model."},{"key":"Next Steps","value":"Send detailed compensation breakdown and training schedule. Schedule follow-up call in 1 week."}]',
  'Demo candidate for testing Call Connector Pro (Recruit)',
  NOW(),
  NOW()
),
-- Candidate 4: Emily Rodriguez - Experienced Insurance Agent
(
  'Emily',
  'Rodriguez',
  '+15035554567',
  'emily.rodriguez@example.com',
  'Austin',
  'TX',
  '78701',
  'new',
  'Senior Sales Agent',
  '8 years insurance industry experience',
  '999',
  'cnsysop@aoglobelife.com',
  1,
  '[{"key":"Background","value":"8 years of experience in insurance sales, licensed in multiple states. Currently working at competitor but open to new opportunities. Strong referral network."},{"key":"Interest Level","value":"High interest. Actively looking for better commission structure and support system. Quick decision maker."},{"key":"Availability","value":"Can start immediately after contract negotiation. Prefers remote/hybrid work option."},{"key":"Compensation Expectations","value":"Expects $70k+ first year with potential for $100k+. Interested in leadership opportunities."},{"key":"Next Steps","value":"Schedule in-person interview this week. Prepare competitive offer package. Discuss team structure."}]',
  'Demo candidate for testing Call Connector Pro (Recruit)',
  NOW(),
  NOW()
),
-- Candidate 5: David Thompson - Part-Time Seeker
(
  'David',
  'Thompson',
  '+15035555678',
  'david.thompson@example.com',
  'Portland',
  'OR',
  '97201',
  'new',
  'Part-Time Sales',
  'Current full-time job, seeking side income',
  '999',
  'cnsysop@aoglobelife.com',
  1,
  '[{"key":"Background","value":"Currently employed full-time in unrelated field. Looking for part-time sales opportunity to supplement income. Some customer service experience."},{"key":"Interest Level","value":"Interested in part-time option only. Flexible with hours but prefers evenings and weekends."},{"key":"Availability","value":"Available evenings after 6pm and weekends. Limited weekday availability due to current job."},{"key":"Compensation Expectations","value":"Understands part-time rates. Mainly interested in commission-based structure."},{"key":"Next Steps","value":"Confirm part-time position availability and commission structure. Schedule evening call to discuss details."}]',
  'Demo candidate for testing Call Connector Pro (Recruit)',
  NOW(),
  NOW()
);

-- Now insert corresponding entries into masterleadrecruit table
-- This links them to the queue/assignment system
INSERT INTO masterleadrecruit (
  candidate_id,
  first_name,
  last_name,
  phone,
  email,
  city,
  state,
  zip,
  cn_email,
  cnresolution,
  assigned_date,
  market,
  created_at,
  updated_at
)
SELECT 
  id as candidate_id,
  first_name,
  last_name,
  phone,
  email,
  city,
  state,
  zip_code as zip,
  'cnsysop@aoglobelife.com' as cn_email,
  'pending' as cnresolution,
  NOW() as assigned_date,
  'aorecruit' as market,
  created_at,
  updated_at
FROM recruit_candidates
WHERE agent_email = 'cnsysop@aoglobelife.com'
  AND created_at >= NOW() - INTERVAL '1 minute'
  AND phone IN ('+15035551234', '+15035552345', '+15035553456', '+15035554567', '+15035555678');

-- Verify the inserts
SELECT 
  rc.id,
  rc.first_name,
  rc.last_name,
  rc.phone,
  rc.status,
  mlr.id as mlr_id,
  mlr.cn_email,
  mlr.cnresolution
FROM recruit_candidates rc
LEFT JOIN masterleadrecruit mlr ON mlr.candidate_id = rc.id
WHERE rc.agent_email = 'cnsysop@aoglobelife.com'
  AND rc.phone IN ('+15035551234', '+15035552345', '+15035553456', '+15035554567', '+15035555678')
ORDER BY rc.created_at DESC;
