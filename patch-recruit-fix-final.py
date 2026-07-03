with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '<VDPStatus' in line and i > 2155:
        # Find the closing </VDPStatus>
        end = i
        for j in range(i, min(i+15, len(lines))):
            if '</VDPStatus>' in lines[j]:
                end = j
                break
        
        # Replace the whole double-wrapped block with just RecruitInboundConnectPanel
        new_block = [
            '            <RecruitInboundConnectPanel userEmail={userEmail ?? \'\'} />\n',
        ]
        
        lines = lines[:i] + new_block + lines[end+1:]
        print(f'Replaced double-wrapped VDPStatus at line {i+1} through {end+1}')
        break

with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
