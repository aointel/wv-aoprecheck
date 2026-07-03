-- Backfill billing_transactions with known agent email and associate_id from source tables
-- 1) CONNECT (vdp_calls)
update billing_transactions bt
set
  agent_email = coalesce(lower(c.company_email), lower(c.personal_email), lower(h.agent_email), bt.agent_email),
  agent_associate_id = coalesce(c.associate_id, h.agent_associate_id, bt.agent_associate_id),
  agent_name = coalesce(
    nullif(trim(concat(c.first_name,' ',c.last_name)), ''),
    h.agent_name,
    bt.agent_name
  )
from vdp_calls vc
left join customers c
  on lower(c.company_email) = lower(vc.company_email)
   or lower(c.personal_email) = lower(vc.company_email)
left join agent_hierarchy h
  on h.agent_associate_id::text = vc.agent::text
where bt.source_table = 'vdp_calls'
  and bt.source_id = vc.id
  and (
    bt.agent_email ilike '%unknown%' or bt.agent_email like 'associate-%@pending-lookup.aogi'
    or bt.agent_associate_id is null
  );

-- 2) PRECHECK (verification_sessions)
update billing_transactions bt
set
  agent_email = coalesce(lower(c.company_email), lower(c.personal_email), lower(h.agent_email), bt.agent_email),
  agent_associate_id = coalesce(c.associate_id, h.agent_associate_id, bt.agent_associate_id),
  agent_name = coalesce(
    nullif(trim(concat(c.first_name,' ',c.last_name)), ''),
    h.agent_name,
    bt.agent_name
  )
from verification_sessions vs
left join customers c
  on lower(c.company_email) = lower(coalesce(vs.agent_email, vs.company_email))
   or lower(c.personal_email) = lower(coalesce(vs.agent_email, vs.company_email))
left join agent_hierarchy h
  on h.agent_associate_id = vs.associate_id
where bt.source_table = 'verification_sessions'
  and bt.source_id = vs.id
  and (
    bt.agent_email ilike '%unknown%' or bt.agent_email like 'associate-%@pending-lookup.aogi'
    or bt.agent_associate_id is null
  );

-- 3) RECRUIT (recruit_candidates)
update billing_transactions bt
set
  agent_email = coalesce(lower(c.company_email), lower(c.personal_email), lower(h.agent_email), bt.agent_email),
  agent_associate_id = coalesce(c.associate_id, h.agent_associate_id, bt.agent_associate_id),
  agent_name = coalesce(
    nullif(trim(concat(c.first_name,' ',c.last_name)), ''),
    h.agent_name,
    bt.agent_name
  )
from recruit_candidates rc
left join customers c
  on lower(c.company_email) = lower(rc.agent_email)
   or lower(c.personal_email) = lower(rc.agent_email)
left join agent_hierarchy h
  on h.agent_associate_id::text = rc.agent_id::text
where bt.source_table = 'recruit_candidates'
  and bt.transaction_id = ('recruit-' || rc.id)
  and (
    bt.agent_email ilike '%unknown%' or bt.agent_email like 'associate-%@pending-lookup.aogi'
    or bt.agent_associate_id is null
  );


