with open(r'C:\dev\AOIrail\server\vdp-service-fixed.ts', 'r', encoding='utf-8') as f:
    content = f.read()

# Check current import
import re
imports = re.findall(r"from './supabase'[^\n]*", content)
print('Current import:', imports[:3])

# Replace: import supabase with supabaseAdmin, use admin client for customers query
old_import = "import { supabase } from './supabase';"
new_import = "import { supabaseAdmin as supabase } from './supabase';"

if old_import in content:
    content = content.replace(old_import, new_import, 1)
    print('Fixed import')
else:
    # Try other patterns
    old2 = "import { supabase, supabaseAdmin } from './supabase';"
    if old2 in content:
        content = content.replace(old2, "import { supabaseAdmin as supabase } from './supabase';", 1)
        print('Fixed combined import')
    else:
        # Just find any supabase import
        for line in content.split('\n')[:20]:
            if 'supabase' in line and 'import' in line:
                print('Found import line:', line)

with open(r'C:\dev\AOIrail\server\vdp-service-fixed.ts', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
