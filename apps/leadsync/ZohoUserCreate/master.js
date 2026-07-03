const { compareAgents } = require('./compare-agents.js');
const { updateQueueMembers } = require('./update-queue-members.js');

async function runAll() {
    try {
        console.log('1. Comparing agents...');
        await compareAgents();

        console.log('\n2. Updating queue members...');
        await updateQueueMembers();

        console.log('\nAll processes completed successfully!');
    } catch (error) {
        console.error('Error:', error);
    }
}

module.exports = {
    refreshTokens
};

runAll(); 