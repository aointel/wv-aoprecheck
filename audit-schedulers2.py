import re, os

server_dir = r'C:\dev\AOIrail\server'
files = sorted(os.listdir(server_dir))

schedulers = []
for fname in files:
    if not fname.endswith(('.ts', '.js')) or fname.endswith('.d.ts'):
        continue
    fpath = os.path.join(server_dir, fname)
    try:
        with open(fpath, 'r', encoding='utf-8') as f:
            content = f.read()
    except:
        continue
    
    intervals = re.findall(r'setInterval[^,\n]*,\s*(\d[\d_]*)', content)
    timeouts_sched = re.findall(r'setTimeout[^,\n]*,\s*(\d[\d_]{4,})', content)  # only big timeouts (>=10000)
    crons = re.findall(r"cron\.schedule\(['\"]([^'\"]+)['\"]", content)
    poll_intervals = re.findall(r'pollInterval\s*=\s*(\d+)', content)
    has_start = 'start()' in content or '.start()' in content
    supabase_count = len(re.findall(r'await supabase', content))
    twilio_calls = len(re.findall(r'await.*twilio|twilioClient\.|twilio\.', content))
    zapier = len(re.findall(r'zapier|ZAPIER', content, re.IGNORECASE))
    
    if intervals or crons or poll_intervals:
        all_intervals = intervals + poll_intervals
        ms_vals = [int(v.replace('_','')) for v in all_intervals]
        schedulers.append({
            'file': fname,
            'intervals_ms': ms_vals,
            'cron': crons,
            'supabase': supabase_count,
            'twilio': twilio_calls,
            'zapier': zapier,
        })

# Sort by fastest interval
schedulers.sort(key=lambda x: min(x['intervals_ms']) if x['intervals_ms'] else 99999)

print(f"{'File':<50} {'Intervals':<25} {'Cron':<30} {'SB':<5} {'Twilio':<8} {'Zapier'}")
print('-'*130)
for s in schedulers:
    ivs = ','.join(f"{v}ms" for v in s['intervals_ms'][:3])
    crons = ';'.join(s['cron'][:2])
    print(f"{s['file']:<50} {ivs:<25} {crons:<30} {s['supabase']:<5} {s['twilio']:<8} {s['zapier']}")
