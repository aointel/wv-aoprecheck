with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the CardContent container that clips the panel
old = '              <CardContent className="p-6 overflow-y-auto max-h-[calc(100vh-400px)]">\n\n                {/* Call Connector Pro Tab - Two-column layout with VDP + Dialer */}\n                {rightPanelTab === \'call-connector-pro\' && (\n                  <RecruitInboundConnectPanel userEmail={userEmail ?? \'\'} />\n                )}'
new = '              <CardContent className="p-0 overflow-hidden">\n\n                {/* Call Connector Pro Tab */}\n                {rightPanelTab === \'call-connector-pro\' && (\n                  <div className="h-[calc(100vh-300px)] min-h-[800px]">\n                    <RecruitInboundConnectPanel userEmail={userEmail ?? \'\'} />\n                  </div>\n                )}'

if old in content:
    content = content.replace(old, new, 1)
    print('Replaced container')
else:
    # Try finding it line by line
    print('Pattern not found exactly, trying line search...')
    lines = content.split('\n')
    for i, line in enumerate(lines):
        if 'overflow-y-auto max-h-[calc(100vh-400px)]' in line:
            lines[i] = line.replace('p-6 overflow-y-auto max-h-[calc(100vh-400px)]', 'p-0 overflow-hidden')
            print(f'Fixed line {i+1}')
        if 'RecruitInboundConnectPanel userEmail' in line:
            # Wrap in full height div
            indent = '                  '
            lines[i] = f'{indent}<div className="h-[calc(100vh-300px)] min-h-[800px]">\n{indent}  <RecruitInboundConnectPanel userEmail={{userEmail ?? \'\'}} />\n{indent}</div>'
            print(f'Wrapped panel at line {i+1}')
    content = '\n'.join(lines)

with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
