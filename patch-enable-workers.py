"""
Wraps the scheduler block in startBackground() with:
  if (process.env.ENABLE_WORKERS !== 'false') { ... }

Keep outside the flag (always run in main server):
  - lines 626-651: WebRTC Call Service + Local Presence Service
  - lines 804-806: storage.syncAllProfilesToHierarchy()
  - lines 891-898: ensurePublicLiveCardTables / seedChrisLiveLink
  - lines 968+: console.log summary lines

The scheduler block to gate: lines 653-966 (0-indexed: 652-965)
But we must carve out the "keep" items within it.

Simpler approach: wrap lines 653-966 as a single block, 
and move the "keep" items (storage sync + public live card) 
just before the ENABLE_WORKERS block (they're already inside the try).
"""

with open(r'C:\dev\AOIrail\server\index.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f'Input: {len(lines)} lines')

# Find the exact boundary lines (0-indexed)
# Scheduler block starts at line 653 (0-indexed: 652) — VDP Credit Enforcer comment
# It ends at line 966 (0-indexed: 965) — closing '},' of setInterval
# The log on 968 "Background services initialization complete" stays outside

scheduler_start = 652   # 0-indexed, inclusive
scheduler_end = 966     # 0-indexed, exclusive (line 967 is blank, 968 is the log)

# Verify
print(f'Scheduler block start ({scheduler_start+1}): {lines[scheduler_start].rstrip()}')
print(f'Scheduler block end   ({scheduler_end}):   {lines[scheduler_end-1].rstrip()}')

# Extract the scheduler block
scheduler_lines = lines[scheduler_start:scheduler_end]

# Build the replacement: wrap in ENABLE_WORKERS check
indent = '    '  # 4 spaces (inside try block of startBackground)
flag_open  = f'{indent}if (process.env.ENABLE_WORKERS !== \'false\') {{\n'
flag_close = f'{indent}}} // end ENABLE_WORKERS\n'

# Indent each scheduler line by 2 more spaces (inside the if block)
extra = '  '
wrapped = [flag_open]
for l in scheduler_lines:
    if l.rstrip() == '':
        wrapped.append('\n')
    else:
        wrapped.append(extra + l)
wrapped.append(flag_close)

new_lines = lines[:scheduler_start] + wrapped + lines[scheduler_end:]
print(f'Output: {len(new_lines)} lines')

# Verify the flag appears
flag_found = any('ENABLE_WORKERS' in l for l in new_lines)
print(f'ENABLE_WORKERS flag present: {flag_found}')

with open(r'C:\dev\AOIrail\server\index.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print('Done.')
