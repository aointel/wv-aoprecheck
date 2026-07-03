# GPT-4 Analysis Request

Use the attached JSON dataset to analyze call quality and data integrity for this exact scope:
- group code: VBEU1
- city is missing
- exclude group code: PAVET

## Tasks
1. Identify records where declared location fields look inconsistent with call metadata.
2. Find repeat patterns by state, area code, campaign, and transfer outcome.
3. Rank likely bad data clusters (high confidence first) and explain why.
4. Propose remediation rules we can automate (validation + correction workflow).
5. Provide a concise action plan: quick wins (today), medium-term (this week), and structural fixes.

## Output format
- Executive summary (5-10 bullets)
- Key findings table
- High-confidence anomaly list (top 100)
- Suggested validation rules (pseudocode)
- Risk notes / false-positive caveats

## Context summary (auto-generated)
```json
{
  "sourceCsv": "C:\\dev\\AOIrail\\server\\sql\\1e186c90-5ca5-4915-868c-7092a85fd5a6.csv",
  "db": "michaelmandella",
  "scope": {
    "groupCode": "VBEU1",
    "missingCityOnly": true,
    "excludedGroupCode": "PAVET"
  },
  "counts": {
    "csvRows": 2114,
    "scopedRows": 1037,
    "uniqueCallIds": 1037,
    "fetchedCalls": 1037,
    "failedCalls": 0,
    "transferredRows": 1037,
    "rowsWithTaalkPayload": 1037
  }
}
```
