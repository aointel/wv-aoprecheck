import { execSync } from 'child_process';

async function main() {
    try {
        // 1. Refresh token
        console.log('\nRefreshing token...');
        execSync('powershell -File .\\Refresh-ZohoToken.ps1');

        // 2. Verify token
        console.log('\nVerifying token...');
        execSync('powershell -File .\\Get-CurrentTokens.ps1');

        // 3. Get all users
        console.log('\nFetching all users...');
        execSync('node get-zoho-users.js');
    } catch (error) {
        console.error('Error:', error);
    }
}

main(); 