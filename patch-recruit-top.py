with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find the candidates tab content start
for i, line in enumerate(lines):
    if "rightPanelTab === 'candidates'" in line and i > 1770:
        # Insert the inbound panel right after this opening
        # Find the next line that starts actual candidates content
        insert_at = i + 2  # after the <> or opening
        panel_block = [
            '                  {/* Inbound Call Panel - always visible at top */}\n',
            '                  <div className="mb-4 h-[600px] min-h-[600px]">\n',
            '                    <RecruitInboundConnectPanel userEmail={userEmail ?? \'\'} />\n',
            '                  </div>\n',
        ]
        lines = lines[:insert_at] + panel_block + lines[insert_at:]
        print(f'Inserted panel at line {insert_at+1}')
        break

# Also change default tab to 'candidates' (already is, but confirm)
# and remove the call-connector-pro tab entirely since panel is now on candidates
for i, line in enumerate(lines):
    if "rightPanelTab === 'call-connector-pro' && (" in line:
        # Comment out the whole block - find start and end
        start = i
        depth = 0
        for j in range(i, min(i+10, len(lines))):
            if '(' in lines[j]: depth += lines[j].count('(')
            if ')' in lines[j]: depth -= lines[j].count(')')
            if depth <= 0 and j > i:
                # Remove lines start through j+1
                lines = lines[:start] + lines[j+2:]
                print(f'Removed call-connector-pro tab block at {start+1}')
                break
        break

with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
