with open('src/components/MyScore.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix 1: Section 1 col — remove 50% width, make it narrow fixed width with border
content = content.replace(
    "{ width: '50%', minWidth: 0, overflowY: 'auto', flexShrink: 0 }",
    "{ width: 165, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border)' }"
)

# Fix 2: Find the Recent Calls comment inside section 1 and close section 1 before it,
# open a new middle column, and close middle column before section 2

calls_marker = "{/* Recent Calls moved under trend */}"
section1_close = "            </div>\n            </div>\n          </div>\n"  # close the 3 divs of section1

# The section 1 ends with: </div></div></div> then dividerSt then section2
# We need to: close section1 before calls, open middle col, then close middle col and open section2 col

# Find closing of section 1 (triple close before dividerSt)
old_s1_end = '              </div>\n              </div>\n            </div>\n\n            <div style={dividerSt} />'
new_s1_end = '''              </div>
            </div>

            {/* Middle col: Recent Calls */}
            <div style={{ flex: 1, overflowY: 'auto', borderRight: '1px solid var(--border)', padding: '8px 10px' }}>'''

if old_s1_end in content:
    content = content.replace(old_s1_end, new_s1_end)
    print("Replaced section 1 end + divider")
else:
    # Try with different whitespace
    import re
    pattern = r'              </div>\s+</div>\s+</div>\s+\n\s+<div style=\{dividerSt\} />'
    match = re.search(pattern, content)
    if match:
        content = content[:match.start()] + new_s1_end + content[match.end():]
        print("Replaced via regex")
    else:
        print("Pattern not found, searching...")
        idx = content.find('<div style={dividerSt} />')
        if idx >= 0:
            print(f"dividerSt found at char {idx}")
            print("Context:", repr(content[idx-100:idx+50]))
        else:
            print("dividerSt not found at all")

# Fix 3: The Recent Calls section needs to close before section 2
# Find where section 2 starts and close the middle column before it
old_s2_start = '''            {/* ──────────────────── */}
            {/* Section 2 — Score */}
            {/* ──────────────────── */}
            <div style={{ width: '50%', minWidth: 0, overflowY: 'auto', flexShrink: 0, padding: '0 12px', paddingBottom: 16 }}>'''

new_s2_start = '''            </div>

            {/* Right col: AOI Score */}
            <div style={{ width: 195, flexShrink: 0, overflowY: 'auto', padding: '8px 10px', borderLeft: '1px solid var(--border)' }}>'''

if old_s2_start in content:
    content = content.replace(old_s2_start, new_s2_start)
    print("Replaced section 2 start")
else:
    print("Section 2 start not found")
    # Try partial
    partial = "{ width: '50%', minWidth: 0, overflowY: 'auto', flexShrink: 0, padding: '0 12px', paddingBottom: 16 }"
    if partial in content:
        content = content.replace(partial, "{ width: 195, flexShrink: 0, overflowY: 'auto', padding: '8px 10px' }")
        print("Replaced via partial")

# Fix 4: The outer scrollable body needs to be flex column with the 3-col row filling it
content = content.replace(
    "{ flex: 1, overflowY: 'auto' }",
    "{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }"
)
# The 3-col row needs flex: 1
content = content.replace(
    "{ display: 'flex', flexDirection: 'row', height: '100%', minHeight: 0, overflow: 'hidden' }",
    "{ flex: 1, display: 'flex', flexDirection: 'row', minHeight: 0, overflow: 'hidden' }"
)

with open('src/components/MyScore.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
