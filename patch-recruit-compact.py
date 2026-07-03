with open(r'C:\dev\AOIrail\client\src\components\recruit\RecruitInboundConnectPanel.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'context=' in line and 'recruit' in line:
        lines[i] = '      context="recruit"\n      compact\n      panelVariant="new"\n      cardClassName=""\n      titleClassName=""\n      hideProducerRow={false}\n'
        print(f'Updated line {i+1}')
        break

with open(r'C:\dev\AOIrail\client\src\components\recruit\RecruitInboundConnectPanel.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
