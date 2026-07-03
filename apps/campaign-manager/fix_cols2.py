with open('src/components/MyScore.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# The calls block starts at the comment and ends before the closing of section 1
# We need to cut it from section 1 and put it in the middle column

calls_start_marker = '              {/* Recent Calls moved under trend */}'
calls_end_marker = '            </div>\n\n            {/* Middle col: Recent Calls */}\n            <div style={{ flex: 1, overflowY: \'auto\', borderRight: \'1px solid var(--border)\', padding: \'8px 10px\' }}>\n\n            </div>'

# Find where calls start in section 1
calls_idx = content.find(calls_start_marker)
if calls_idx < 0:
    print("Calls marker not found")
    exit(1)

# Find the middle column empty block  
middle_col_empty = '            {/* Middle col: Recent Calls */}\n            <div style={{ flex: 1, overflowY: \'auto\', borderRight: \'1px solid var(--border)\', padding: \'8px 10px\' }}>\n\n            </div>'
middle_idx = content.find(middle_col_empty)
if middle_idx < 0:
    print("Middle col not found")
    # Try finding it differently
    alt = '{/* Middle col: Recent Calls */}'
    alt_idx = content.find(alt)
    print(f"Alt marker at: {alt_idx}")
    print("Context:", repr(content[alt_idx-10:alt_idx+200]) if alt_idx >= 0 else "not found")
    exit(1)

print(f"Calls start at char {calls_idx}, middle col at char {middle_idx}")

# Extract the calls content (from calls_start to before section1's double close)
# The section 1 closes with: </div></div> then empty line then middle col
# Calls content ends just before '            </div>\n\n            {/* Middle col'
section1_close_after_calls = '            </div>\n\n            {/* Middle col: Recent Calls */'

end_of_calls = content.find(section1_close_after_calls, calls_idx)
if end_of_calls < 0:
    print("Could not find end of calls")
    exit(1)

calls_content = content[calls_idx:end_of_calls]
print(f"Calls content length: {len(calls_content)}")
print("First 100:", repr(calls_content[:100]))

# Remove calls from section 1
content_without_calls = content[:calls_idx] + content[end_of_calls:]

# Now put calls content into the middle column
middle_col_with_content = (
    '{/* Middle col: Recent Calls */}\n'
    '            <div style={{ flex: 1, overflowY: \'auto\', borderRight: \'1px solid var(--border)\', padding: \'8px 10px\' }}>\n'
    '              ' + calls_content.replace('\n              ', '\n              ') + '\n'
    '            </div>'
)

# In content_without_calls, replace the empty middle col
content_final = content_without_calls.replace(
    '{/* Middle col: Recent Calls */}\n            <div style={{ flex: 1, overflowY: \'auto\', borderRight: \'1px solid var(--border)\', padding: \'8px 10px\' }}>\n\n            </div>',
    middle_col_with_content
)

with open('src/components/MyScore.tsx', 'w', encoding='utf-8') as f:
    f.write(content_final)

print("Done")
