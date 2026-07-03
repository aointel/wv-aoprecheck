# Disposition Duration Requirements Report

## Summary
This document outlines all duration requirements for setting dispositions in the Call Connector Pro dialer.

---

## Exempt Dispositions (No Duration Required)
These dispositions can be set at any time, even for calls with 0 seconds duration:

- `no_answer`
- `no_answer_vm`
- `no_answer_voicemail`
- `wrong_number`
- `wrong number`
- `bad_number`

**Reason:** These represent calls that never connected or were invalid, so no duration is expected.

---

## Duration Requirements by Disposition

### 20 Seconds Required (> 20 seconds)
These dispositions require the call to have lasted **more than 20 seconds**:

- `callback`
- `call_back`
- `not_interested`
- `dnc`
- `do_not_call`
- `do-not-call`
- `do not call`

**Validation:** `callDurationSeconds > 20`

---

### 45 Seconds Required (> 45 seconds)
These dispositions require the call to have lasted **more than 45 seconds**:

- `booked`
- `appointment_set`
- `appointment`
- `instant_presentation`

**Validation:** `callDurationSeconds > 45` (or `>= 45` for instant_presentation in some places)

**Note:** There's a slight inconsistency:
- `CallControls.tsx` line 138: `instant_presentation` requires `>= 45` seconds
- `OutboundDialerInterface.tsx` line 5639: `instant_presentation` requires `< 45` (blocked if less than 45)
- `RecruitOutboundDialerInterface.tsx` line 5573: `instant_presentation` requires `< 45` (blocked if less than 45)

---

### 60 Seconds Required (> 60 seconds)
**Location:** `CallDisposition.tsx` line 92

All other dispositions requiring validation need **more than 60 seconds**:

- `already_been_sold`
- `medically_uninsurable`
- `over_age`
- `duplicate`
- Any other disposition not listed above

**Validation:** `callDurationSeconds > 60`

**Note:** This is only enforced in `CallDisposition.tsx`. Other files use 45 seconds as the default.

---

### No Duration Requirement (if duration > 0)
- `sale`

**Validation:** `callDurationSeconds > 0` (any positive duration is acceptable)

**Location:** `CallControls.tsx` line 142-144

---

## Special Rules

### Calls Over 45 Seconds Must Have Disposition
**Location:** Multiple places in `OutboundDialerInterface.tsx` and `RecruitOutboundDialerInterface.tsx`

**Rule:** If a call lasted **more than 45 seconds**, the agent **cannot**:
- Mark the lead as "called" without a disposition
- Skip to the next lead without a disposition
- Complete the call without a disposition

**Validation:** `if (currentCallDuration > 45 && !dispositionApplied) { BLOCK }`

**Reason:** Prevents agents from churning through leads by immediately ending answered calls.

---

### AOIntel Leads Always Require Disposition
**Location:** `OutboundDialerInterface.tsx` and `RecruitOutboundDialerInterface.tsx`

**Rule:** AOIntel leads **cannot** be marked as "called" without a disposition, regardless of call duration.

**Validation:** Checks `currentLead.aointel === true` or `currentLead.aointel === 1`

---

## Inconsistencies Found

### 1. Instant Presentation Duration
- **CallControls.tsx:** Requires `>= 45` seconds
- **OutboundDialerInterface.tsx:** Blocks if `< 45` seconds (same effect, different check)
- **RecruitOutboundDialerInterface.tsx:** Blocks if `< 45` seconds

**Recommendation:** Standardize to `>= 45` seconds everywhere.

### 2. Default Duration for Other Dispositions
- **CallDisposition.tsx:** Requires `> 60` seconds for other dispositions
- **CallControls.tsx:** Requires `> 45` seconds for other dispositions

**Recommendation:** Standardize to one value (likely 45 seconds based on majority usage).

---

## Implementation Locations

### Frontend Validation
1. **CallControls.tsx** (lines 124-159)
   - `canUseDisposition()` function
   - Used to disable/enable disposition buttons

2. **CallDisposition.tsx** (lines 70-93)
   - `canUseDisposition()` function
   - Different logic (60 seconds for others)

3. **OutboundDialerInterface.tsx** (lines 5596-5643)
   - `handleDispositionSelect()` function
   - Shows toast errors if duration requirement not met

4. **RecruitOutboundDialerInterface.tsx** (lines 5530-5579)
   - `handleDispositionSelect()` function
   - Same validation as OutboundDialerInterface

### Backend Validation
1. **server/agent-dial-metrics-tracker.ts** (lines 148-167)
   - Blocks logging events without duration
   - Blocks certain dispositions without duration

2. **server/routes.ts** (lines 17770-17780)
   - Validates dispositions requiring call validation
   - Checks for duration before allowing disposition

---

## Summary Table

| Disposition | Minimum Duration | Validation Location |
|------------|------------------|---------------------|
| no_answer, wrong_number, etc. | 0 seconds (exempt) | All files |
| callback, not_interested, dnc | > 20 seconds | All files |
| booked, appointment_set | > 45 seconds | All files |
| instant_presentation | >= 45 seconds | CallControls.tsx |
| instant_presentation | < 45 blocked | OutboundDialerInterface.tsx |
| sale | > 0 seconds | CallControls.tsx |
| Other dispositions | > 60 seconds | CallDisposition.tsx |
| Other dispositions | > 45 seconds | CallControls.tsx |
| Calls > 45s | Must have disposition | OutboundDialerInterface.tsx |

---

## Recommendations

1. **Standardize instant_presentation** to `>= 45` seconds everywhere
2. **Standardize default duration** for other dispositions to `> 45` seconds (matches majority)
3. **Document the "calls > 45s require disposition" rule** more clearly in UI
4. **Consider making duration requirements configurable** per market/team if needed
