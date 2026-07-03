
with open('C:/TaalkCenterTracker/src/components/Funnel.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

original_len = len(content)

# 1. Remove PanelTab type
content = content.replace("type PanelTab = 'score' | 'calls' | 'coaching';\n\n", '')

# 2. Remove tab state line
content = content.replace("  const [tab, setTab] = useState<PanelTab>('score');\n", '')

# 3. Fix calls useEffect - remove tab condition
content = content.replace(
    "  // Load calls tab data on tab switch\n  useEffect(() => {\n    if (tab !== 'calls' || !row.email) return;",
    "  // Load calls data on mount\n  useEffect(() => {\n    if (!row.email) return;"
)

# 4. Fix coaching useEffect - combined replacement (dep array + condition)
content = content.replace(
    "  }, [tab, row.email]);\n\n  // Load coaching tab data on tab switch\n  useEffect(() => {\n    if (tab !== 'coaching' || !row.email) return;",
    "  }, [row.email]);\n\n  // Load coaching data on mount\n  useEffect(() => {\n    if (!row.email) return;"
)

# 5. Fix coaching dep array (second [tab, row.email])
content = content.replace("  }, [tab, row.email]);\n\n  const handleAddNote", "  }, [row.email]);\n\n  const handleAddNote")

# 6. Remove TABS array and setTab usage
import re

content = re.sub(
    r"  const TABS: \{ key: PanelTab; label: string \}\[\] = \[\n.*?\n.*?\n.*?\n  \];\n\n  return \(",
    "  return (",
    content,
    flags=re.DOTALL
)

# 7. Remove tab bar div (from header)
content = re.sub(
    r"        \{/\* Tab bar \*/\}\n        <div style=\{\{ display: 'flex', gap: 0 \}\}>\n.*?</div>\n      </div>",
    '      </div>',
    content,
    flags=re.DOTALL
)

print(f"Original: {original_len} chars, New: {len(content)} chars, Diff: {len(content)-original_len}")

# Check for score conditional
idx = content.find("TAB: Score")
if idx > 0:
    print(f"'TAB: Score' at index: {idx}")
    print(repr(content[idx-40:idx+100]))

with open('C:/TaalkCenterTracker/src/components/Funnel.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File written.")
