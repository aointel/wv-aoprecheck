/**
 * Check if Twilio TaskRouter is configured in the account
 */

import twilio from 'twilio';

const TWILIO_ACCOUNT_SID = 'AC25d37aa41aed0df4fddd81ecf7abf00d';
const TWILIO_AUTH_TOKEN = 'b275d646252457344ff62528e3538ea9';

const client = twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);

async function checkTaskRouter() {
  console.log('\n🔍 CHECKING TWILIO TASKROUTER CONFIGURATION\n');
  console.log('='.repeat(60));
  console.log(`Account SID: ${TWILIO_ACCOUNT_SID}\n`);

  try {
    // Check for TaskRouter workspaces
    console.log('📋 Checking for TaskRouter workspaces...\n');
    
    const workspaces = await client.taskrouter.v1.workspaces.list();
    
    if (workspaces.length === 0) {
      console.log('❌ NO TASKROUTER WORKSPACES FOUND');
      console.log('\nTaskRouter is not set up in this Twilio account.');
      console.log('To use TaskRouter, you need to:');
      console.log('  1. Create a workspace in Twilio Console');
      console.log('  2. Create queues for different call types');
      console.log('  3. Create workers (agents)');
      console.log('  4. Create workflows to route tasks');
      console.log('\nAlternatively, you can use the existing conference-based routing');
      console.log('that is already implemented in your system.\n');
      return;
    }

    console.log(`✅ Found ${workspaces.length} workspace(s):\n`);

    for (const workspace of workspaces) {
      console.log(`📦 Workspace: ${workspace.friendlyName || workspace.sid}`);
      console.log(`   SID: ${workspace.sid}`);
      console.log(`   Event Callback URL: ${workspace.eventCallbackUrl || 'Not configured'}`);
      console.log(`   Multi-Task Enabled: ${workspace.multiTaskEnabled ? 'Yes' : 'No'}`);
      console.log('');

      // Check queues in this workspace
      try {
        const queues = await client.taskrouter.v1
          .workspaces(workspace.sid)
          .taskQueues.list();
        
        console.log(`   📊 Queues: ${queues.length}`);
        if (queues.length > 0) {
          queues.forEach(queue => {
            console.log(`      - ${queue.friendlyName || queue.sid}`);
            console.log(`        Target Workers: ${queue.targetWorkers || 'All'}`);
            console.log(`        Max Reserved Workers: ${queue.maxReservedWorkers || 'Unlimited'}`);
          });
        }
        console.log('');

        // Check workers in this workspace
        const workers = await client.taskrouter.v1
          .workspaces(workspace.sid)
          .workers.list();
        
        console.log(`   👥 Workers: ${workers.length}`);
        if (workers.length > 0) {
          workers.slice(0, 5).forEach(worker => {
            console.log(`      - ${worker.friendlyName || worker.sid}`);
            console.log(`        Activity: ${worker.activityName || 'Unknown'}`);
            console.log(`        Available: ${worker.available ? 'Yes' : 'No'}`);
          });
          if (workers.length > 5) {
            console.log(`      ... and ${workers.length - 5} more`);
          }
        }
        console.log('');

        // Check tasks in this workspace
        const tasks = await client.taskrouter.v1
          .workspaces(workspace.sid)
          .tasks.list({ limit: 10 });
        
        console.log(`   📞 Active Tasks: ${tasks.length}`);
        if (tasks.length > 0) {
          tasks.forEach(task => {
            console.log(`      - Task ${task.sid}`);
            console.log(`        Status: ${task.status}`);
            console.log(`        Priority: ${task.priority || 'Normal'}`);
            console.log(`        Queue: ${task.taskQueueFriendlyName || 'Unassigned'}`);
          });
        }
        console.log('');

        // Check workflows
        const workflows = await client.taskrouter.v1
          .workspaces(workspace.sid)
          .workflows.list();
        
        console.log(`   🔄 Workflows: ${workflows.length}`);
        if (workflows.length > 0) {
          workflows.forEach(workflow => {
            console.log(`      - ${workflow.friendlyName || workflow.sid}`);
            console.log(`        Configuration: ${workflow.configuration ? 'Configured' : 'Not configured'}`);
          });
        }
        console.log('');

      } catch (error) {
        console.log(`   ⚠️ Error fetching details: ${error.message}\n`);
      }

      console.log('─'.repeat(60));
      console.log('');
    }

    console.log('✅ TaskRouter is configured and ready to use!');
    console.log('\nYou can display this information on a dashboard page.');

  } catch (error) {
    if (error.code === 20003 || error.message.includes('not found')) {
      console.log('❌ TASKROUTER NOT AVAILABLE');
      console.log('\nTaskRouter may not be enabled for this account, or');
      console.log('there was an authentication issue.');
      console.log(`\nError: ${error.message}`);
      console.log(`Code: ${error.code || 'Unknown'}`);
    } else {
      console.error('❌ Error checking TaskRouter:', error.message);
      console.error('   Code:', error.code);
      console.error('   Status:', error.status);
    }
  }
}

checkTaskRouter();
