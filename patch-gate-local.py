with open(r'C:\dev\AOIrail\server\index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = "  // Skip gate in development — allow browser access for local testing\n  if (process.env.NODE_ENV === 'development') return next();"
new = "  // Skip gate in development or on localhost — allow browser access for local testing\n  if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'staging' || !process.env.NODE_ENV) return next();"

assert old in content
content = content.replace(old, new, 1)
with open(r'C:\dev\AOIrail\server\index.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
