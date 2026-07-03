import re

with open('src/components/MyScore.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Change the outer scrollable body from column to row
# The sections are inside: {selectedEmail && !loading && ( <> ... </> )}
# We need to change <> to a flex row div, and add column wrappers around each section

# Change fragment to flex row
content = content.replace(
    '        {selectedEmail && !loading && (\r\n          <>\r\n',
    '        {selectedEmail && !loading && (\r\n          <div style={{ display: \'flex\', height: \'100%\', minHeight: 0, overflow: \'hidden\' }}>\r\n'
)
content = content.replace(
    '        {selectedEmail && !loading && (\n          <>\n',
    '        {selectedEmail && !loading && (\n          <div style={{ display: \'flex\', height: \'100%\', minHeight: 0, overflow: \'hidden\' }}>\n'
)

# Close </> -> </div>
content = content.replace(
    '          </>\r\n        )}\r\n      </div>\r\n    </div>',
    '          </div>\r\n        )}\r\n      </div>\r\n    </div>'
)
content = content.replace(
    '          </>\n        )}\n      </div>\n    </div>',
    '          </div>\n        )}\n      </div>\n    </div>'
)

# 2. Wrap Section 1 in a column div
# Find: first <div style={{ padding: '8px 12px' }}> after Section 1 comment
s1_start = '            {/* Section 1'
s1_inner = "            <div style={{ padding: '8px 12px' }}>"
s2_divider_old = "            <div style={dividerSt} />\r\n\r\n            {/* Section 2"
s2_divider_old2 = "            <div style={dividerSt} />\n\n            {/* Section 2"

col1_open = "            <div style={{ width: '33%', minWidth: 160, overflowY: 'auto', flexShrink: 0, borderRight: '1px solid var(--border)' }}>\r\n"
col1_open2 = "            <div style={{ width: '33%', minWidth: 160, overflowY: 'auto', flexShrink: 0, borderRight: '1px solid var(--border)' }}>\n"

col1_close_s2 = "            </div>\r\n\r\n            <div style={{ width: '34%', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>\r\n            {/* Section 2"
col1_close_s2_2 = "            </div>\n\n            <div style={{ width: '34%', overflowY: 'auto', borderRight: '1px solid var(--border)' }}>\n            {/* Section 2"

# Replace divider between S1 and S2 with col close + col open
if s2_divider_old in content:
    content = content.replace(s2_divider_old, col1_close_s2)
elif s2_divider_old2 in content:
    content = content.replace(s2_divider_old2, col1_close_s2_2)

# Insert col1 opener before Section 1's padding div
if s1_inner in content:
    idx = content.find(s1_inner)
    content = content[:idx] + col1_open + content[idx:]

# 3. Replace divider between S2 and S3 with col close + col open for S3
s3_divider_old = "            <div style={dividerSt} />\r\n\r\n            {/* Section 3"
s3_divider_old2 = "            <div style={dividerSt} />\n\n            {/* Section 3"
col2_close_s3 = "            </div>\r\n\r\n            <div style={{ flex: 1, overflowY: 'auto' }}>\r\n            {/* Section 3"
col2_close_s3_2 = "            </div>\n\n            <div style={{ flex: 1, overflowY: 'auto' }}>\n            {/* Section 3"

if s3_divider_old in content:
    content = content.replace(s3_divider_old, col2_close_s3)
elif s3_divider_old2 in content:
    content = content.replace(s3_divider_old2, col2_close_s3_2)

# 4. Close the last column before the closing </> -> </div>
content = content.replace(
    '          </div>\r\n        )}\r\n      </div>\r\n    </div>',
    '            </div>\r\n          </div>\r\n        )}\r\n      </div>\r\n    </div>'
)
content = content.replace(
    '          </div>\n        )}\n      </div>\n    </div>',
    '            </div>\n          </div>\n        )}\n      </div>\n    </div>'
)

with open('src/components/MyScore.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
