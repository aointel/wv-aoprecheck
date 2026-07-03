with open(r'C:\dev\AOIrail\client\src\components\recruit\RecruitInboundConnectPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'cardClassName' in line or 'titleClassName' in line or 'title="AO Recruit"' in line:
        lines[i] = ''  # remove these props
        print(f'Removed line {i+1}: {line.rstrip()}')

with open(r'C:\dev\AOIrail\client\src\components\recruit\RecruitInboundConnectPanel.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
