-- Manager-scoped Live Call Board
create or replace view manager_live_call_board as
select
  h.manager_email,
  lb.*
from live_call_board lb
join agent_hierarchy h
  on lower(h.agent_email) = lower(lb.agent_email);

-- Manager Daily Metrics (today view scoped by hierarchy)
create or replace view manager_daily_metrics as
select
  h.manager_email,
  adm.*
from agent_daily_metrics adm
join agent_hierarchy h
  on lower(h.agent_email) = lower(adm.agent_email);

-- Manager Weekly Metrics (full weekly metrics scoped by hierarchy)
create or replace view manager_weekly_metrics as
select
  h.manager_email,
  awfm.*
from agent_weekly_full_metrics awfm
join agent_hierarchy h
  on lower(h.agent_email) = lower(awfm.agent_email);

-- Global Top 5 Agents Today (project-wide)
create or replace view agent_daily_top5_overall as
select *
from agent_daily_metrics
where day = date_trunc('day', now())
order by booked desc, reached desc, dials desc
limit 5;

-- Global Top 5 Agents This Week (project-wide)
create or replace view agent_weekly_top5_overall as
select *
from agent_weekly_full_metrics
where week = date_trunc('week', now())
order by weekly_booked desc, weekly_reached desc, weekly_dials desc
limit 5;


