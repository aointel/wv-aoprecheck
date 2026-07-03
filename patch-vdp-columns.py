with open(r'C:\dev\AOIrail\server\vdp-service-fixed.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove licensed_states from the select (column doesn't exist in customers)
old = """          states,
          licensed_states,
          market,"""
new = """          states,
          market,"""

assert old in content, 'Pattern not found'
content = content.replace(old, new, 1)

with open(r'C:\dev\AOIrail\server\vdp-service-fixed.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
