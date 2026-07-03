with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'lg:col-span-5' in line and i > 2155:
        # Add h-full to the div
        lines[i] = line.replace('lg:col-span-5">', 'lg:col-span-5 h-full">')
        print(f'Added h-full at line {i+1}')
        # Next line is the RecruitInboundConnectPanel — wrap it
        if i+1 < len(lines) and 'RecruitInboundConnectPanel' in lines[i+1]:
            lines[i+1] = lines[i+1].replace(
                '<RecruitInboundConnectPanel',
                '<div className="h-full min-h-[800px]"><RecruitInboundConnectPanel'
            ).replace(' />', ' /></div>')
            print(f'Wrapped panel at line {i+2}')
        break

with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
