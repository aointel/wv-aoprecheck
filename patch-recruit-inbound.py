with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add import
old_import = "import { RecruitOutboundDialerInterface } from '../components/outbound-dialer/RecruitOutboundDialerInterface';"
new_import = """import { RecruitOutboundDialerInterface } from '../components/outbound-dialer/RecruitOutboundDialerInterface';
import { RecruitInboundConnectPanel } from '../components/recruit/RecruitInboundConnectPanel';"""

assert old_import in content, 'import not found'
content = content.replace(old_import, new_import, 1)

# Replace the call-connector-pro tab content
old_tab = """                {rightPanelTab === 'call-connector-pro' && (
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    {/* Left: VDP Status with aorecruit context */}
                    <div>
                      <VDPStatus
                        userEmail={userEmail ?? ''}
                        context="aorecruit"
                      />
                    </div>
                    {/* Right: Recruit dialer */}
                    <div>
                      <RecruitOutboundDialerInterface />
                    </div>
                  </div>
                )}"""

new_tab = """                {rightPanelTab === 'call-connector-pro' && (
                  <RecruitInboundConnectPanel userEmail={userEmail ?? ''} />
                )}"""

assert old_tab in content, 'tab content not found'
content = content.replace(old_tab, new_tab, 1)

with open(r'C:\dev\AOIrail\client\src\pages\AORecruit.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
