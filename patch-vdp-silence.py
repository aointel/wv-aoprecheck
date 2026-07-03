with open(r'C:\dev\AOIrail\client\src\components\connectnow\VDPStatus.tsx', 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if '} else if (response.status === 404) {' in line and i > 1180:
        # Replace lines i through i+13 (the 404 error block)
        new_block = (
            '        } else if (response.status === 404) {\n'
            '          // Agent has no VDP configuration — silently skip, no error shown\n'
            '          console.log(`ℹ️ VDPStatus: No VDP config for ${userEmail} — VDP not enabled for this agent`);\n'
            '          setLoading(false);\n'
            '          return;\n'
        )
        # Find the end of this else-if block (the closing })
        end = i + 1
        while end < len(lines) and '        }' not in lines[end]:
            end += 1
        
        lines = lines[:i] + [new_block] + lines[end:]
        print(f'Patched 404 handler at line {i+1}, removed through line {end+1}')
        break

with open(r'C:\dev\AOIrail\client\src\components\connectnow\VDPStatus.tsx', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print('Done')
