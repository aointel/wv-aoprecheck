"""
Move storage.syncAllProfilesToHierarchy() and ensurePublicLiveCardTables()
OUT of the ENABLE_WORKERS block and into the always-run section just before it.
"""

with open(r'C:\dev\AOIrail\server\index.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f'Input: {len(lines)} lines')

# Find the lines to extract (0-indexed)
# storage.syncAllProfilesToHierarchy() block: lines 805-807 (0-indexed 804-806)
# ensurePublicLiveCardTables block: lines 892-899 (0-indexed 891-898)

# Build new content: remove those blocks from inside ENABLE_WORKERS,
# add them just AFTER the closing '} // end ENABLE_WORKERS' line

storage_start = 804   # 0-indexed, inclusive
storage_end   = 808   # 0-indexed, exclusive (blank line after)

livecard_start = 891  # 0-indexed (comment line: // Public no-login...)
livecard_end   = 900  # 0-indexed, exclusive (blank line after)

# Find 'end ENABLE_WORKERS' line
enable_workers_close = None
for i, line in enumerate(lines):
    if '} // end ENABLE_WORKERS' in line:
        enable_workers_close = i
        break

print(f'ENABLE_WORKERS close at line {enable_workers_close+1}')
print(f'storage block: lines {storage_start+1}-{storage_end}')
print(f'livecard block: lines {livecard_start+1}-{livecard_end}')

# Extract the blocks (strip extra indentation added by the ENABLE_WORKERS wrapper)
def de_indent(block_lines, extra='  '):
    result = []
    for l in block_lines:
        if l.startswith(extra):
            result.append(l[len(extra):])
        else:
            result.append(l)
    return result

storage_block = de_indent(lines[storage_start:storage_end])
livecard_block = de_indent(lines[livecard_start:livecard_end])

# Blank out those lines in the original (replace with empty lines)
new_lines = list(lines)
for i in range(storage_start, storage_end):
    new_lines[i] = ''
for i in range(livecard_start, livecard_end):
    new_lines[i] = ''

# Insert after close of ENABLE_WORKERS block
insert_at = enable_workers_close + 1
insert_content = (
    ['\n', '    // Always run: storage hierarchy sync and public live card setup\n']
    + storage_block
    + ['\n']
    + livecard_block
    + ['\n']
)
new_lines = new_lines[:insert_at] + insert_content + new_lines[insert_at:]

# Remove consecutive blank lines (more than 2 in a row)
final = []
blank_count = 0
for line in new_lines:
    if line.strip() == '':
        blank_count += 1
        if blank_count <= 2:
            final.append(line)
    else:
        blank_count = 0
        final.append(line)

print(f'Output: {len(final)} lines')

# Verify
for i, line in enumerate(final):
    if 'ENABLE_WORKERS' in line or 'syncAllProfilesToHierarchy' in line or 'ensurePublicLiveCardTables' in line:
        print(f'{i+1}: {line.rstrip()}')

with open(r'C:\dev\AOIrail\server\index.ts', 'w', encoding='utf-8') as f:
    f.writelines(final)

print('Done.')
