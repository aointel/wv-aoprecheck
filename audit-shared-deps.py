import re, os

server_dir = r'C:\dev\AOIrail\server'

# Files that are imported by many others = shared utilities
import_map = {}  # filename -> list of files that import it

files = [f for f in os.listdir(server_dir) if f.endswith(('.ts', '.js')) and not f.endswith('.d.ts')]

for fname in files:
    fpath = os.path.join(server_dir, fname)
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        continue
    # find local imports
    imports = re.findall(r"from ['\"](\./[^'\"]+)['\"]", content)
    imports += re.findall(r"import\(['\"](\./[^'\"]+)['\"]", content)
    for imp in imports:
        imp_clean = imp.replace('./', '').split('/')[0]
        if imp_clean not in import_map:
            import_map[imp_clean] = []
        import_map[imp_clean].append(fname)

# Sort by usage count
sorted_deps = sorted(import_map.items(), key=lambda x: -len(x[1]))
print("Shared dependencies (by import count):")
print(f"{'Module':<45} {'Count':<6} {'Imported By'}")
print('-'*100)
for mod, importers in sorted_deps[:30]:
    imp_str = ', '.join(sorted(set(importers))[:5])
    if len(set(importers)) > 5:
        imp_str += f' ... +{len(set(importers))-5}'
    print(f"{mod:<45} {len(set(importers)):<6} {imp_str}")
