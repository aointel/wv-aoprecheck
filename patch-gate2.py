with open(r'C:\dev\AOIrail\server\index.ts', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove the duplicate session store + session middleware block (lines 259-287 approx)
# Find "// Session store we can clear at midnight PST" (the OLD one, not our new one)
# and remove through the closing of the session() call

dup_start = None
dup_end = None
for i, line in enumerate(lines):
    # The original comment had "we can clear at midnight PST"
    if 'Session store we can clear at midnight PST' in line:
        dup_start = i
    if dup_start is not None and dup_end is None:
        # Remove through the old "app.use(session({...}));" block
        # It ends at the line "  }));" after sameSite setting
        if i > dup_start + 5 and line.strip() == '}));':
            dup_end = i
            break

print(f'Duplicate block: lines {dup_start+1} to {dup_end+1}')
for j in range(dup_start, dup_end+1):
    print(f'  {j+1}: {lines[j].rstrip()}')

new_lines = lines[:dup_start] + lines[dup_end+1:]
print(f'Original: {len(lines)}, After removal: {len(new_lines)}')

with open(r'C:\dev\AOIrail\server\index.ts', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Done.')
