with open(r'C:\dev\AOIrail\server\auth-service.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix regex - lost the backslash
content = content.replace(
    "const digits = phoneToUse.replace(/D/g, '');",
    "const digits = phoneToUse.replace(/\\D/g, '');"
)

# Fix SMS body - \n\n became nn
content = content.replace(
    "your AO Intelligence passcode is: ${associateId}nnThis is also",
    "your AO Intelligence passcode is: ${associateId}\\n\\nThis is also"
)

with open(r'C:\dev\AOIrail\server\auth-service.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
