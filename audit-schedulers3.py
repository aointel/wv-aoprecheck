import re, os

server_dir = r'C:\dev\AOIrail\server'

# Also find the ones started in index.ts via import().then
with open(os.path.join(server_dir, 'index.ts'), 'r', encoding='utf-8') as f:
    idx_content = f.read()

# Find all scheduler imports in startBackground()
started = re.findall(r"import\(['\"](\./[^'\"]+)['\"]", idx_content)
print("Schedulers/workers started in index.ts startBackground():")
for s in started:
    print(f"  {s}")

# Find the setInterval in index.ts
ivals = re.findall(r'setInterval[^\n]+', idx_content)
print("\nsetInterval calls in index.ts:")
for s in ivals: print(f"  {s[:100]}")

# Find the ones that are DISABLED (commented out)
disabled = re.findall(r'//\s*import\([\'"](\./[^\'\"]+)[\'"]', idx_content)
print("\nDISABLED schedulers (commented out):")
for s in disabled: print(f"  {s}")
