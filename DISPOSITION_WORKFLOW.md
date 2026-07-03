# Disposition Workflow Documentation

## Overview
When a disposition is applied to a lead, multiple actions occur. This document explains which dispositions trigger lead movement and what happens for each disposition.

---

## Dispositions That Are Mapped (Have Producer Resolution Codes)

All of these dispositions are sent to webhooks:

| Disposition | Producer Resolution Code | Description |
|------------|-------------------------|-------------|
| `booked` | 1 (Pres, No Sale) | Presentation resulted in booking |
| `instant_presentation` | 1 (Pres, No Sale) | Presentation happened |
| `sale` | 1 (Pres, No Sale) | Presentation happened, resulted in sale |
| `call_back` / `callback` | 1 (Pres, No Sale) | Callback requested |
| `already_been_sold` | 1 (Pres, No Sale) | Presentation happened but already sold |
| `Meet` | 1 (Pres, No Sale) | Meeting scheduled |
| `not_interested` | 2 (Pres Refused) | Refused presentation |
| `wrong_number` | 3 (Bad Phone) | Wrong/bad phone number |
| `duplicate` | 4 (Duplicate) | Duplicate lead |
| `over_age` | 5 (Over Age) | Over age limit |
| `do_not_call` / `dnc` | 6 (DNC) | Do not call |

**Note:** Dispositions that are NOT mapped (like `no_answer`, `voicemail`, `pending`) are **NOT** sent to webhooks, but are still saved to the database.

---

## What Happens When a Disposition is Applied

When any disposition is applied, the following actions occur **in order**:

### 1. Update Masterlead Database ✅
- Updates `masterlead.cnresolution` column with the disposition
- Updates `masterlead.last_contacted` timestamp
- Updates `masterlead.updated_at` timestamp
- **This happens for ALL dispositions** (mapped or unmapped)

### 2. Log to Agent Metrics ✅
- Logs to `agent_dial_metrics` table
- Records: agent email, lead info, disposition, call duration
- **This happens for ALL dispositions**

### 3. Log to Stats Tracking ✅
- Logs to `war_connects` table for daily stats
- Tracks connection metrics and outcomes
- **This happens for ALL dispositions**

### 4. Log to Call Log ✅
- Updates `call_log` table with disposition
- Records call completion details
- **This happens for ALL dispositions**

### 5. Update Watchdog Status ✅
- Updates internal watchdog system with lead status
- Marks lead as no longer pending
- **This happens for ALL dispositions**

### 6. Send to Producer Resolutions Webhook ✅
- **URL:** `https://hooks.zapier.com/hooks/catch/15730596/um82e8j/`
- **Sent for:** ALL mapped dispositions (see table above)
- **Payload includes:**
  - Lead information (name, phone, email, address)
  - Disposition and Producer Resolution code
  - Agent information
  - Call duration and notes
  - Market and timestamp

### 7. Send to Planet ALTIG Webhook ✅ (NEW - After Latest Changes)
- **URL:** `https://hooks.zapier.com/hooks/catch/2467580/uifcmkd/`
- **Sent for:** ALL mapped dispositions **BUT ONLY IF:**
  - Lead is a **hotlead** (source_table='hotleads' OR market='Hot Lead' OR is_hot_lead=true)
  - Call duration is **>= 60 seconds**
  - Valid `associate_id` exists
- **Payload includes:**
  - `lead_id` (Taalk Lead ID)
  - `associate_id` (Agent Associate ID)
  - `dispositionkey` (the disposition string)
  - `disposition` (the disposition string)

---

## Disposition-Specific Actions

Some dispositions have special handling in the code (currently logged but future features):

- **`booked`**: Future: Create appointment record, send confirmation SMS, add to calendar
- **`call_back`**: Future: Enable intelligent callback routing
- **`instant_presentation`**: Future: Trigger immediate presentation workflow, notify managers
- **`sale`**: Future: Trigger commission calculation, notify sales team
- **`not_interested`**: Future: Add to suppression list, update lead scoring
- **`do_not_call`**: Future: Add to federal DNC compliance system

---

## Important Notes

### Lead Movement
- **ALL mapped dispositions** are sent to webhooks
- The webhook recipients (Producer Resolutions and Planet ALTIG) determine what happens to the lead in their systems
- The Planet ALTIG webhook has stricter requirements (hotleads only, 60+ seconds)

### Disposition Mapping
- Only dispositions with a Producer Resolution code (1-6) are sent to webhooks
- Unmapped dispositions (like `no_answer`, `voicemail`) are saved to the database but NOT sent to webhooks

### Hotlead Requirements (Planet ALTIG)
- Planet ALTIG webhook only sends for hotleads with 60+ second calls
- This ensures quality leads are moved to the lead management system
- Producer Resolutions webhook sends for ALL mapped dispositions regardless of lead type

### Database Updates
- All dispositions update the `masterlead.cnresolution` column
- This is the source of truth for lead status
- The webhooks are notifications/triggers for external systems

---

## Summary

**What dispositions move leads?**
- **ALL mapped dispositions** (booked, sale, not_interested, wrong_number, duplicate, over_age, do_not_call, etc.) are sent to webhooks
- Planet ALTIG only receives hotleads with 60+ second calls
- Producer Resolutions receives all mapped dispositions

**What happens when a disposition is given?**
1. Database updated (masterlead, agent_dial_metrics, war_connects, call_log)
2. Webhooks sent (Producer Resolutions for all mapped, Planet ALTIG for qualifying hotleads)
3. Watchdog status updated
4. Lead stays visible in UI until "Complete Call & Dial Next" is clicked


