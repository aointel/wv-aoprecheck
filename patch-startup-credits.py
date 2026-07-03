with open(r'C:\dev\AOIrail\client\src\components\outbound-dialer\StartupSequence.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the "Buy Credits" button block from the fail state (lines 958-971)
old_fail = """            {creditPurchaseModal ? (
              <Button
                type="button"
                size="sm"
                onClick={() => creditPurchaseModal.openCreditPurchaseModal()}
                className="h-8 text-xs bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-semibold border-0"
              >
                Buy Credits
              </Button>
            ) : (
              <Button size="sm" asChild className="h-8 text-xs bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-semibold border-0">
                <a href="/dashboard/billing-dashboard">Buy Credits</a>
              </Button>
            )}"""

new_fail = """{/* Buy Credits removed — agents do not purchase credits here */}"""

# Remove the warn/pass state buy credits block (lines 980-995)
old_warn = """      {step.fixType === 'credits' && (step.status === 'pass' || step.status === 'warn') && (
        <div className="ml-[30px] mt-2 flex flex-wrap items-center gap-2">
          {creditPurchaseModal ? (
            <Button
              type="button"
              size="sm"
              onClick={() => creditPurchaseModal.openCreditPurchaseModal()}
              className="h-8 text-xs bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-semibold border-0"
            >
              Buy Credits
            </Button>
          ) : (
            <Button size="sm" asChild className="h-8 text-xs bg-amber-500/90 hover:bg-amber-400 text-slate-950 font-semibold border-0">
              <a href="/dashboard/billing-dashboard">Buy Credits</a>
            </Button>
          )}
        </div>
      )}"""

new_warn = """{/* Buy Credits warn/pass panel removed */}"""

assert old_fail in content, 'fail block not found'
assert old_warn in content, 'warn block not found'

content = content.replace(old_fail, new_fail, 1)
content = content.replace(old_warn, new_warn, 1)

with open(r'C:\dev\AOIrail\client\src\components\outbound-dialer\StartupSequence.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('StartupSequence done')

# Fix Login.tsx - remove "your Associate ID" from password label
with open(r'C:\dev\AOIrail\client\src\pages\Login.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

old_label = 'Passcode (your Associate ID)'
new_label = 'Passcode'

assert old_label in content, 'label not found'
content = content.replace(old_label, new_label, 1)

with open(r'C:\dev\AOIrail\client\src\pages\Login.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
print('Login.tsx done')
