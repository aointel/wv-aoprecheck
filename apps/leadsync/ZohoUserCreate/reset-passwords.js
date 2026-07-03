import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://xyzcompany.supabase.co';  // Need your actual URL
const SUPABASE_SERVICE_KEY = 'your-service-role-key';    // Need your service role key

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function resetAllPasswords() {
    try {
        // Get all users first
        const { data: users, error: fetchError } = await supabase
            .from('auth.users')
            .select('id, email');

        if (fetchError) {
            throw fetchError;
        }

        console.log(`Found ${users.length} users to update`);

        // Update each user's password
        for (const user of users) {
            const { error: updateError } = await supabase.auth.admin.updateUserById(
                user.id,
                { password: 'connectnow' }
            );

            if (updateError) {
                console.error(`Failed to update ${user.email}:`, updateError);
            } else {
                console.log(`Updated password for ${user.email}`);
            }
        }

        console.log('Password reset complete!');

    } catch (error) {
        console.error('Error:', error);
    }
}

resetAllPasswords(); 