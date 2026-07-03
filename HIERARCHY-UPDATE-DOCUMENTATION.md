# Agent Hierarchy Update Documentation

## Overview

This document explains how agent hierarchies are determined and updated from the Producer List CSV file.

## How Hierarchies Are Determined

Agent hierarchies are built from the **Producer List CSV file** using the following mapping:

### CSV Column Mapping

| CSV Column | Maps To | Database Field | Description |
|------------|---------|----------------|-------------|
| `Associate ID` | Agent ID | `agent_associate_id` | Unique identifier for the agent |
| `Executive Producer` | **MGA** (Managing General Agent) | `mga_name`, `mga_associate_id` | The agent's direct manager/supervisor |
| `Chief Executive Producer` | **RGA** (Regional General Agent) | `rga_name`, `rga_associate_id` | The agent's regional manager (higher level than MGA) |
| `Agent` | Agent Name | `agent_name` | Full name of the agent |
| `Company Email` | Agent Email | `agent_email` | Company email address |
| `AOI MARKET` | Market | `aoi_market` | Primary market designation |
| `AO Market 2` | Secondary Market | `ao_market_2` | Secondary market designation |
| `Designated Market` | Designated Market | `designated_market` | Designated market designation |

### Hierarchy Structure

```
RGA (Regional General Agent)
  └── MGA (Managing General Agent)
       └── Agent
```

- **RGA (Chief Executive Producer)**: Higher-level manager, typically manages multiple MGAs
- **MGA (Executive Producer)**: Direct manager/supervisor of agents
- **Agent**: Individual agent with an associate_id

## Update Process

### Script: `update-hierarchies-from-csv.mjs`

This script updates the `agent_hierarchy` table with hierarchy relationships from the CSV file.

#### Steps:

1. **Parse CSV File**: Reads `Producer List 1.2.26.csv` and parses all rows
2. **Build Name Lookup Map**: Creates a map of Agent Name → Associate ID from the CSV
3. **Process Hierarchy Relationships**:
   - For each agent row:
     - Extracts Executive Producer → looks up MGA associate_id
     - Extracts Chief Executive Producer → looks up RGA associate_id
     - Creates hierarchy record with agent, MGA, and RGA information
4. **Deduplicate Records**: Removes duplicate entries by `agent_associate_id` (keeps last occurrence)
5. **Upsert to Database**: Batch upserts all records to `agent_hierarchy` table

#### Key Logic:

- **MGA Resolution**: Executive Producer name is looked up in the CSV to find the corresponding Associate ID
- **RGA Resolution**: Chief Executive Producer name is looked up in the CSV to find the corresponding Associate ID
- **Not Found Handling**: If an Executive Producer or Chief Executive Producer name doesn't exist in the CSV, the MGA/RGA fields are set to `null` (but agent record is still created)

### Example

Given CSV row:
```
Associate ID: 158
Executive Producer: ANDREW BISHOP
Chief Executive Producer: RYAN STENGLEIN
Agent: STEFAN JOHANNSSON
Company Email: stefanjohannsson@aoglobelife.com
```

The script:
1. Looks up "ANDREW BISHOP" → finds Associate ID 3 (from CSV)
2. Looks up "RYAN STENGLEIN" → finds Associate ID 193 (from CSV)
3. Creates hierarchy record:
   ```
   agent_associate_id: 158
   agent_name: STEFAN JOHANNSSON
   agent_email: stefanjohannsson@aoglobelife.com
   mga_associate_id: 3
   mga_name: ANDREW BISHOP
   rga_associate_id: 193
   rga_name: RYAN STENGLEIN
   ```

## Database Table: `agent_hierarchy`

### Schema:

- `agent_associate_id` (INTEGER, PRIMARY KEY, UNIQUE): The agent's associate ID
- `agent_name` (TEXT): Full name of the agent
- `agent_email` (TEXT): Company email address
- `mga_associate_id` (INTEGER, NULLABLE): Associate ID of the MGA (Executive Producer)
- `mga_name` (TEXT, NULLABLE): Name of the MGA
- `rga_associate_id` (INTEGER, NULLABLE): Associate ID of the RGA (Chief Executive Producer)
- `rga_name` (TEXT, NULLABLE): Name of the RGA
- `aoi_market` (TEXT, NULLABLE): Primary market
- `ao_market_2` (TEXT, NULLABLE): Secondary market
- `designated_market` (TEXT, NULLABLE): Designated market
- `created_at` (TIMESTAMP): Record creation timestamp
- `updated_at` (TIMESTAMP): Record update timestamp

### Unique Constraint:

- `agent_associate_id` must be unique (one record per agent)

## Running the Update Script

```bash
node update-hierarchies-from-csv.mjs
```

### Output:

The script provides detailed output including:
- Number of records processed
- Number of MGAs/RGAs not found in lookup
- Deduplication statistics
- Upsert progress and results
- Final summary with hierarchy statistics

### Example Output:

```
📊 SUMMARY:
   ✅ Processed: 4352 records
   ✅ Deduplicated: 4344 unique records
   ✅ Upserted: 4344 records
   ❌ Errors: 0 records
   📈 With MGA: 4253
   📈 With RGA: 3585
   📈 With both MGA and RGA: 3572
```

## Important Notes

1. **Name Matching**: Hierarchy resolution is case-insensitive and uses exact name matching from the CSV
2. **Missing Hierarchies**: If an Executive Producer or Chief Executive Producer name doesn't exist in the CSV, the corresponding MGA/RGA fields will be `null`
3. **Deduplication**: If multiple CSV rows have the same `Associate ID`, only one record is kept (last occurrence or one with hierarchy data)
4. **Upsert Behavior**: Records are upserted using `agent_associate_id` as the conflict key, meaning existing records are updated rather than creating duplicates

## Related Scripts

- `update-associate-ids-from-csv.mjs`: Updates associate IDs in the `customers` table
- `trigger-producerlist-sync.cjs`: Syncs hierarchy from `producerlist` table (uses mga/rga columns)
- `populate-agent-hierarchy.cjs`: Alternative script for populating hierarchies (older version)

## Troubleshooting

### MGA/RGA Not Found

If you see warnings like:
```
⚠️  MGA "JOHN TONG" not found for agent MICHAEL GOEYARDI (127388)
```

This means:
- The Executive Producer name "JOHN TONG" doesn't exist as an Agent name in the CSV
- The agent record will still be created, but `mga_associate_id` will be `null`
- Check if the Executive Producer name matches exactly (case-insensitive) an Agent name in the CSV

### Duplicate Associate IDs

If duplicates are found:
- The script automatically deduplicates them
- Only one record per `agent_associate_id` is kept
- The script prefers records with hierarchy data when duplicates exist

