-- Disable the trigger that automatically creates billing_transactions from vdp_calls

DROP TRIGGER IF EXISTS vdp_calls_connect_billing_insert ON vdp_calls;

-- Optionally, you can also drop the function if you want (but keeping it is fine)
-- DROP FUNCTION IF EXISTS public.insert_connect_billing_transaction();
