with open(r'C:\dev\AOIrail\server\index.ts', 'r', encoding='utf-8') as f:
    content = f.read()

old = "  if (!isBrowser) return next();"
new = "  if (!isBrowser) return next();\n\n  // Skip gate in development — allow browser access for local testing\n  if (process.env.NODE_ENV === 'development') return next();"

result = content.replace(old, new, 1)
assert result != content, 'replacement failed'

with open(r'C:\dev\AOIrail\server\index.ts', 'w', encoding='utf-8') as f:
    f.write(result)
print('Done')
