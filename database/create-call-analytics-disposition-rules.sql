-- Call Analytics: disposition rules per outcome (editable via UI; used to build AI prompt and enforce rules).
-- If no rows, code falls back to built-in DISPOSITION_MODEL.

CREATE TABLE IF NOT EXISTS call_analytics_disposition_rules (
  id TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  description TEXT NOT NULL,
  prompt_instructions TEXT,
  min_duration_sec INTEGER,
  max_duration_sec INTEGER,
  scorecard_zero BOOLEAN DEFAULT FALSE,
  transcript_indicators JSONB DEFAULT '[]',
  must_not_contain JSONB DEFAULT '[]',
  call_outcome_mapping JSONB NOT NULL DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_disposition_rules_active_sort ON call_analytics_disposition_rules(active, sort_order);

COMMENT ON TABLE call_analytics_disposition_rules IS 'Per-disposition rules and prompt text for call analytics AI. Editable in Call Analytics Admin.';

-- Seed with default rules (match DISPOSITION_MODEL in code)
INSERT INTO call_analytics_disposition_rules (id, label, description, prompt_instructions, min_duration_sec, max_duration_sec, scorecard_zero, transcript_indicators, must_not_contain, call_outcome_mapping, sort_order, active) VALUES
('no_answer_vm', 'No Answer / Voicemail', 'Prospect did NOT speak. Voicemail (beep, leave a message), disconnected, or ring-out. One-sided: only agent talking, no prospect replies.', NULL, NULL, NULL, TRUE, '["leave a message", "after the beep", "not available", "voicemail", "message machine", "one-sided", "only agent speaking"]', '["prospect said", "client said", "they said", "customer replied"]', '["NO_SHOW"]', 0, TRUE),
('spanish', 'Spanish', 'Prospect or context indicates need for Spanish speaker (we don''t have one). Transcript mentions: spanish, español, speak spanish, habla español. Usually short (< 2 min). Do NOT use CALLBACK.', NULL, NULL, 150, FALSE, '["spanish", "español", "espanol", "speak spanish", "habla español"]', '[]', '["OTHER"]', 1, TRUE),
('sale', 'Sale', 'Prospect purchased / closed the sale. Money committed, policy sold.', NULL, NULL, NULL, FALSE, '["sold", "purchased", "signed", "enrolled", "payment", "policy", "closed the sale"]', '[]', '["SOLD"]', 2, TRUE),
('booked', 'Booked', 'Agent scheduled a SPECIFIC appointment (date and/or time set). Use only when an appointment was actually set—not just "call back later".', NULL, 30, NULL, FALSE, '["appointment", "scheduled", "set for", "date", "time", "calendar", "tomorrow at", "next week"]', '["just call back", "call me later", "no specific time"]', '["BOOKED"]', 3, TRUE),
('call_back', 'Call Back', 'Prospect wants to be called back later but NO specific appointment was set. "Call me later", "try again tomorrow", interest but no date/time set.', NULL, NULL, NULL, FALSE, '["call back", "call me later", "try again", "reach out later", "not a good time", "busy right now"]', '[]', '["CALLBACK"]', 4, TRUE),
('instant_presentation', 'Instant Presentation', 'Full presentation was given but no sale, no appointment, no callback set. Prospect heard the full pitch. ONLY valid when call is at least 8 minutes (480 seconds). Shorter calls cannot be "full presentation"—use call_back or not_interested instead.', NULL, 480, NULL, FALSE, '["full presentation", "went through the pitch", "explained the product", "heard everything"]', '["voicemail", "leave a message", "no answer"]', '["OTHER"]', 5, TRUE),
('not_interested', 'Not Interested', 'Prospect said no, needs to think, raised objections and is not moving forward. Not interested, objection, think about it.', NULL, NULL, NULL, FALSE, '["not interested", "no thanks", "think about it", "objection", "not right now", "maybe later", "don''t need"]', '[]', '["THINK", "OBJECTION"]', 6, TRUE)
ON CONFLICT (id) DO NOTHING;
