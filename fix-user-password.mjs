import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://ycztjetxwpfgtrzeyytt.supabase.co',
  'sb_secret_ZWfZCxFwF_SteBQsC8mqZA_wadaDLRd'
);

const email = 'zeljkolalovic@aoglobelife.com';

// 1. Get associate_id from customers
const { data: customer } = await sb.from('customers')
  .select('associate_id, user_id, company_email')
  .or(`company_email.eq.${email},personal_email.eq.${email}`)
  .maybeSingle();

console.log('Customer:', customer);

if (!customer?.associate_id) {
  console.error('No associate_id found');
  process.exit(1);
}

const password = String(customer.associate_id);
console.log('Password will be:', password);

// 2. Find Supabase user
let userId = customer.user_id;

if (!userId) {
  // Try getUserByEmail - paginate
  let page = 1;
  while (true) {
    const { data: { users } } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    const found = users?.find(u => u.email?.toLowerCase() === email);
    if (found) { userId = found.id; break; }
    if (!users?.length || users.length < 1000) break;
    page++;
  }
}

console.log('User ID:', userId);

if (!userId) {
  // Create the user fresh
  const { data: newUser, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  console.log('Created new user:', newUser?.user?.id, error?.message);
} else {
  // Reset password
  const { error } = await sb.auth.admin.updateUserById(userId, { password });
  console.log('Password reset:', error ? error.message : 'SUCCESS');
  
  // Store user_id
  await sb.from('customers').update({ user_id: userId })
    .or(`company_email.eq.${email},personal_email.eq.${email}`);
  console.log('user_id stored in customers');
}
