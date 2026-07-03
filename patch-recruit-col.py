with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if 'lg:col-span-3' in line and i > 2155:
        lines[i] = line.replace('lg:col-span-3', 'lg:col-span-5')
        print(f'Fixed col-span at line {i+1}')
    if 'lg:col-span-7' in line and i > 1765 and i < 1780:
        lines[i] = line.replace('lg:col-span-7', 'lg:col-span-7')  # keep at 7

# Also find the outer grid and make sure it's 12 cols
for i, line in enumerate(lines):
    if 'grid-cols-12' in line and i > 1680 and i < 1780:
        print(f'Grid at {i+1}: {line.rstrip()}')

with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
