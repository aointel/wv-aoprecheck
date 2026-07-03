with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# 1. Replace the existing VDPStatus in the right column with compact + children version
for i, line in enumerate(lines):
    if '<VDPStatus' in line and i > 2160 and 'AO Recruit VDP' in ''.join(lines[i:i+10]):
        # Find the closing /> of this VDPStatus
        end = i
        for j in range(i, min(i+15, len(lines))):
            if '/>' in lines[j]:
                end = j
                break
        
        new_block = [
            '            <VDPStatus\n',
            '              userEmail={userEmail}\n',
            '              context="recruit"\n',
            '              compact\n',
            '              panelVariant="new"\n',
            '              cardClassName=""\n',
            '              titleClassName=""\n',
            '            >\n',
            '              <RecruitInboundConnectPanel userEmail={userEmail ?? \'\'} />\n',
            '            </VDPStatus>\n',
        ]
        
        lines = lines[:i] + new_block + lines[end+1:]
        print(f'Replaced VDPStatus at line {i+1}')
        break

# 2. Remove the RecruitInboundConnectPanel we inserted into the candidates tab
new_lines = []
skip = 0
for i, line in enumerate(lines):
    if skip > 0:
        skip -= 1
        continue
    # Remove the block we added to candidates tab
    if '{/* Inbound Call Panel - always visible at top */}' in line:
        skip = 3  # skip the div + RecruitInboundConnectPanel + closing div
        continue
    new_lines.append(line)

print(f'Removed inbound panel from candidates tab, lines reduced by {len(lines)-len(new_lines)}')
lines = new_lines

with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
