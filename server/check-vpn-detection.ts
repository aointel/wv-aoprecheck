/**
 * Script to check VPN detection status in verification sessions
 * 
 * Usage:
 *   tsx server/check-vpn-detection.ts                    # Show summary stats
 *   tsx server/check-vpn-detection.ts --all              # Show all sessions with VPN
 *   tsx server/check-vpn-detection.ts --session <id>     # Check specific session
 *   tsx server/check-vpn-detection.ts --recent           # Show last 50 sessions
 */

import { supabaseAdmin } from './supabase.js';

async function checkVPNDetection() {
  const args = process.argv.slice(2);
  const showAll = args.includes('--all');
  const recent = args.includes('--recent');
  const sessionIndex = args.indexOf('--session');
  const sessionId = sessionIndex !== -1 ? args[sessionIndex + 1] : null;

  if (!supabaseAdmin) {
    console.error('❌ Supabase not available');
    process.exit(1);
  }

  try {
    if (sessionId) {
      // Check specific session
      const { data: session, error } = await supabaseAdmin
        .from('verification_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) {
        console.error('❌ Error fetching session:', error);
        return;
      }

      if (!session) {
        console.log(`❌ Session ${sessionId} not found`);
        return;
      }

      console.log('\n📋 VPN Detection for Session:', sessionId);
      console.log('='.repeat(80));
      
      console.log('\n🔵 CLIENT IP INFO:');
      console.log(`   IP Address: ${session.client_ip_address || 'Not captured'}`);
      console.log(`   ISP: ${session.client_isp || 'Unknown'}`);
      console.log(`   Location: ${session.client_city || 'Unknown'}, ${session.client_region || ''}, ${session.client_country || ''}`);
      console.log(`   VPN Detected: ${session.client_is_vpn ? '✅ YES' : '❌ NO'}`);
      if (session.client_is_vpn) {
        console.log(`   Proxy: ${session.client_is_proxy ? 'Yes' : 'No'}`);
        console.log(`   Hosting: ${session.client_is_hosting ? 'Yes' : 'No'}`);
        console.log(`   Reason: ${session.client_vpn_detection_reason || 'Unknown'}`);
      }

      console.log('\n🟢 AGENT IP INFO:');
      console.log(`   IP Address: ${session.agent_ip_address || 'Not captured'}`);
      console.log(`   ISP: ${session.agent_isp || 'Unknown'}`);
      console.log(`   Location: ${session.agent_city || 'Unknown'}, ${session.agent_region || ''}, ${session.agent_country || ''}`);
      console.log(`   VPN Detected: ${session.agent_is_vpn ? '✅ YES' : '❌ NO'}`);
      if (session.agent_is_vpn) {
        console.log(`   Proxy: ${session.agent_is_proxy ? 'Yes' : 'No'}`);
        console.log(`   Hosting: ${session.agent_is_hosting ? 'Yes' : 'No'}`);
        console.log(`   Reason: ${session.agent_vpn_detection_reason || 'Unknown'}`);
      }

      console.log('\n🚩 IP ANALYSIS:');
      if (session.ip_flag_status) {
        console.log(`   Flag Status: ${session.ip_flag_status.toUpperCase()}`);
        console.log(`   Reason: ${session.ip_flag_reason || 'N/A'}`);
      } else {
        console.log('   Analysis pending...');
      }

      return;
    }

    // Get summary statistics
    const { data: allSessions, error: countError } = await supabaseAdmin
      .from('verification_sessions')
      .select('client_is_vpn, agent_is_vpn, ip_flag_status, created_at');

    if (countError) {
      console.error('❌ Error fetching sessions:', countError);
      return;
    }

    const totalSessions = allSessions?.length || 0;
    const clientVpnCount = allSessions?.filter(s => s.client_is_vpn === true).length || 0;
    const agentVpnCount = allSessions?.filter(s => s.agent_is_vpn === true).length || 0;
    const bothVpnCount = allSessions?.filter(s => s.client_is_vpn === true && s.agent_is_vpn === true).length || 0;
    const criticalCount = allSessions?.filter(s => s.ip_flag_status === 'critical').length || 0;
    const flaggedCount = allSessions?.filter(s => s.ip_flag_status === 'flagged').length || 0;
    const suspiciousCount = allSessions?.filter(s => s.ip_flag_status === 'suspicious').length || 0;

    console.log('\n📊 VPN Detection Summary');
    console.log('='.repeat(80));
    console.log(`Total Sessions: ${totalSessions}`);
    console.log(`\nVPN Usage:`);
    console.log(`  Client using VPN: ${clientVpnCount} (${((clientVpnCount / totalSessions) * 100).toFixed(1)}%)`);
    console.log(`  Agent using VPN: ${agentVpnCount} (${((agentVpnCount / totalSessions) * 100).toFixed(1)}%)`);
    console.log(`  Both using VPN: ${bothVpnCount} (${((bothVpnCount / totalSessions) * 100).toFixed(1)}%)`);
    console.log(`\nFlag Status:`);
    console.log(`  Critical: ${criticalCount}`);
    console.log(`  Flagged: ${flaggedCount}`);
    console.log(`  Suspicious: ${suspiciousCount}`);
    console.log(`  Valid: ${totalSessions - criticalCount - flaggedCount - suspiciousCount}`);

    if (showAll || recent) {
      // Get detailed list
      let query = supabaseAdmin
        .from('verification_sessions')
        .select('session_id, first_name, last_name, client_is_vpn, agent_is_vpn, client_isp, agent_isp, ip_flag_status, ip_flag_reason, created_at')
        .or('client_is_vpn.eq.true,agent_is_vpn.eq.true')
        .order('created_at', { ascending: false });

      if (recent) {
        query = query.limit(50);
      }

      const { data: vpnSessions, error: vpnError } = await query;

      if (vpnError) {
        console.error('❌ Error fetching VPN sessions:', vpnError);
        return;
      }

      console.log(`\n\n🔍 Sessions with VPN Detection (${vpnSessions?.length || 0}):`);
      console.log('='.repeat(80));

      vpnSessions?.forEach((session: any, index: number) => {
        console.log(`\n${index + 1}. Session: ${session.session_id}`);
        console.log(`   Client: ${session.first_name} ${session.last_name}`);
        console.log(`   Created: ${new Date(session.created_at).toLocaleString()}`);
        console.log(`   Client VPN: ${session.client_is_vpn ? '✅' : '❌'} ${session.client_isp || 'N/A'}`);
        console.log(`   Agent VPN: ${session.agent_is_vpn ? '✅' : '❌'} ${session.agent_isp || 'N/A'}`);
        if (session.ip_flag_status) {
          console.log(`   Flag: ${session.ip_flag_status.toUpperCase()} - ${session.ip_flag_reason?.substring(0, 100) || 'N/A'}`);
        }
      });
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkVPNDetection().then(() => process.exit(0)).catch((error) => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});

