
with open('src/components/Funnel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

checks = [
    ('PanelTab type removed', 'PanelTab' not in content),
    ('tab state removed', 'useState<PanelTab>' not in content),
    ('TABS array removed', 'const TABS:' not in content),
    ('setTab removed', 'setTab(' not in content),
    ('tab bar removed', 'Tab bar' not in content),
    ('tab score conditional removed', "tab === 'score'" not in content),
    ('tab calls conditional removed', "tab === 'calls'" not in content),
    ('tab coaching conditional removed', "tab === 'coaching'" not in content),
    ('Score section present', 'AOI Score' in content),
    ('Recent Calls section present', 'Recent Calls' in content),
    ('Coaching section header present', "Coaching</div>" in content),
    ('useEffect dep row.email only', '[row.email]' in content),
]

all_ok = True
for label, ok in checks:
    status = 'OK  ' if ok else 'FAIL'
    if not ok:
        all_ok = False
    print(f'[{status}] {label}')

print()
print('ALL CHECKS PASSED' if all_ok else 'SOME CHECKS FAILED')
