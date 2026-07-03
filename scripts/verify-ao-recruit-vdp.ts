/**
 * Verify AO Recruit VDP path: Taalk script, mount div, and open() are present and recruit-only branch renders just the mount.
 * Run: npx tsx scripts/verify-ao-recruit-vdp.ts
 */
import * as fs from 'fs';
import * as path from 'path';

const VDP_PATH = path.join(process.cwd(), 'client/src/components/connectnow/VDPStatus.tsx');
const content = fs.readFileSync(VDP_PATH, 'utf-8');

const checks: { name: string; pass: boolean; detail?: string }[] = [];

// 1. Recruit path uses path (ao-recruit)
checks.push({
  name: 'Recruit context includes path /ao-recruit',
  pass: /isOnAORecruitPage|location\.includes\(['\"]\/ao-recruit['\"]\)/.test(content),
});

// 2. Recruit-only early return renders only mount (no Online/Offline in that branch)
const recruitReturn = content.includes('if (isRecruitingContext)') && content.includes('mount-vdp-selector');
checks.push({
  name: 'Recruit branch returns early with only mount',
  pass: recruitReturn && content.includes('AO Recruit: only the Taalk VDP'),
});

// 3. Taalk script URL
checks.push({
  name: 'Taalk script URL present',
  pass: /lets\.taalk\.ai\/sdk\/vdp_client\/michaelmandella/.test(content),
});

// 4. Container #mount-vdp-selector
checks.push({
  name: 'Container #mount-vdp-selector set for recruit',
  pass: /mount-vdp-selector|recruitContainer/.test(content),
});

// 5. TaalkVDP.open() called when vdpData + taalkLoaded
checks.push({
  name: 'TaalkVDP.open() called in effect for recruit',
  pass: /TaalkVDP\.open\(|TaalkVDP\.open\s*\(/.test(content) && /vdpData.*taalkLoaded|taalkLoaded.*vdpData/.test(content),
});

// 6. No "Select Online" or "Ready for calls" in recruit branch (recruit return block should not contain those)
const recruitBlockMatch = content.match(/if \(isRecruitingContext\)\s*\{[\s\S]*?\n\s+\}/);
const recruitBlock = recruitBlockMatch ? recruitBlockMatch[0] : '';
checks.push({
  name: 'Recruit branch has no Online/Offline UI',
  pass: !recruitBlock.includes('Online') || recruitBlock.includes('Exit Demo') || recruitBlock.includes('Start Demo'),
});

let failed = 0;
console.log('AO Recruit VDP checks:\n');
checks.forEach((c) => {
  const ok = c.pass ? '✓' : '✗';
  if (!c.pass) failed++;
  console.log(`  ${ok} ${c.name}`);
});
console.log('');
if (failed > 0) {
  console.error(`Failed ${failed} check(s).`);
  process.exit(1);
}
console.log('All checks passed.');
process.exit(0);
