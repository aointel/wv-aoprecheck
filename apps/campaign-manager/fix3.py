with open('src/components/MyScore.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Step 1: Fix Section 1 column style
content = content.replace(
    "{ width: '50%', minWidth: 0, overflowY: 'auto', flexShrink: 0, border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)' }",
    "{ width: 165, flexShrink: 0, overflowY: 'auto', borderRight: '1px solid var(--border)' }"
)

# Step 2: Extract calls block from Section 1 and place in its own column
# Calls block: from "Recent Calls moved under trend" comment to its closing </div>
# Then Section 1 has two extra </div> to close the inner padding div and the column div
# The structure after trend is:
#   {/* Recent Calls */}
#   <div ...>...</div>   <- calls wrapper
#   </div>               <- closes inner padding div (opened at: <div style={{ padding: '8px 12px' }}>)
# </div>                 <- closes section 1 column

# Let's find the calls block and the section end
calls_start = '              {/* Recent Calls moved under trend */}'
section1_end_after_calls = '              </div>\n            </div>\n\n            <div style={dividerSt} />'

calls_idx = content.find(calls_start)
section1_end_idx = content.find(section1_end_after_calls)

if calls_idx < 0:
    print("calls_start not found")
    exit(1)
if section1_end_idx < 0:
    print("section1_end_after_calls not found")
    # Try to find dividerSt
    div_idx = content.find('<div style={dividerSt} />')
    print(f"dividerSt at {div_idx}")
    print("Context:", repr(content[div_idx-200:div_idx+50]) if div_idx >= 0 else "not found")
    exit(1)

# Extract calls content (from comment to before the double close)
calls_content = content[calls_idx:section1_end_idx].strip()
print(f"Calls content: {len(calls_content)} chars")

# Build new replacement:
# Close Section 1 before calls, open middle col with calls, divider, section2
new_section_boundary = (
    '            </div>\n\n'  # close inner padding div of section 1
    '            </div>\n\n'  # close section 1 column div
    '            {/* Col 2: Recent Calls */}\n'
    '            <div style={{ flex: 1, overflowY: \'auto\', borderRight: \'1px solid var(--border)\', padding: \'8px 10px\' }}>\n'
    '              ' + calls_content.replace('\n', '\n              ').rstrip() + '\n'
    '            </div>\n\n'
)

# In the original content, replace from calls_start through the old section boundary
old_block = content[calls_idx:section1_end_idx + len(section1_end_after_calls)]
content = content.replace(old_block, new_section_boundary)

# Step 3: Fix Section 2 (AOI score) column style + remove leading dividerSt
# (dividerSt div was already removed in the replacement above since section1_end includes it)
content = content.replace(
    "{ width: '50%', minWidth: 0, overflowY: 'auto', flexShrink: 0, padding: '10px 12px 16px', border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-surface)' }",
    "{ width: 195, flexShrink: 0, overflowY: 'auto', padding: '8px 10px', borderLeft: '1px solid var(--border)' }"
)

# Step 4: Fix outer body div
content = content.replace(
    "{ flex: 1, overflowY: 'auto' }",
    "{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }"
)

with open('src/components/MyScore.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
