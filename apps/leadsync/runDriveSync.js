const DriveSync = require('./DriveSync');

async function main() {
    try {
        console.log('=== Starting DriveSync Process ===\n');
        
        // Process latest file from BB folder
        const result = await DriveSync.processLatestFile();
        
        if (result && result.success) {
            console.log('Success:', result.message);
        } else {
            console.log('Process completed with issues:', result?.message || 'Unknown error');
        }

    } catch (error) {
        console.error('Error running DriveSync:', error);
        process.exit(1);
    }
}

// Run the script
main().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
    console.log('\nShutting down...');
    process.exit(0);
}); 