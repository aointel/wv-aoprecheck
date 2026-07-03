import re, os

scheduler_summary = []
server_dir = r'C:\dev\AOIrail\server'
files = os.listdir(server_dir)
for fname in files:
    if fname.endswith(('.ts', '.js')) and not fname.endswith('.d.ts'):
        fpath = os.path.join(server_dir, fname)
        try:
            with open(fpath, 'r', encoding='utf-8') as f:
                content = f.read()
            intervals = re.findall(r'setInterval[^\d]*(\d+)', content)
            crons = re.findall(r"cron\.schedule\(['\"]([^'\"]+)['\"]", content)
            supabase_count = len(re.findall(r'await supabase', content))
            if intervals or crons:
                scheduler_summary.append({
                    'file': fname,
                    'intervals_ms': intervals,
                    'cron': crons,
                    'supabase_awaits': supabase_count
                })
        except Exception as e:
            pass

def sort_key(x):
    if x['intervals_ms']:
        return min(int(v.replace('_','')) for v in x['intervals_ms'])
    return 9999

for s in sorted(scheduler_summary, key=sort_key):
    print(f"{s['file']}: every {s['intervals_ms']}ms, cron={s['cron']}, db_calls={s['supabase_awaits']}")
