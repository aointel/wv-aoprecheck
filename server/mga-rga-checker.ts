import { supabaseAdmin } from './supabase';

/**
 * Check if a user is an MGA or RGA based on their associate_id in the mga_rga_directory table
 * @param userEmail - The user's email address
 * @returns Promise<boolean> - true if user is MGA/RGA, false otherwise
 */
export async function isUserMgaOrRga(userEmail: string): Promise<boolean> {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not initialized');
    return false;
  }

  try {
    // Step 1: Get the user's associate_id from the customers table
    const { data: customer, error: customerError } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .eq('company_email', userEmail.toLowerCase().trim())
      .maybeSingle();

    if (customerError) {
      console.error(`❌ Error fetching customer for ${userEmail}:`, customerError);
      return false;
    }

    if (!customer?.associate_id) {
      console.log(`⚠️ No associate_id found for ${userEmail} in customers table`);
      return false;
    }

    console.log(`🔍 Checking MGA/RGA status for ${userEmail} (associate_id: ${customer.associate_id})`);

    // Step 2: Check if this associate_id exists in the mga_rga_directory table
    const { data: mgaRga, error: mgaRgaError } = await supabaseAdmin
      .from('mga_rga_directory')
      .select('associate_id, name, role')
      .eq('associate_id', customer.associate_id)
      .maybeSingle();

    if (mgaRgaError) {
      console.error(`❌ Error checking mga_rga_directory for associate_id ${customer.associate_id}:`, mgaRgaError);
      return false;
    }

    if (mgaRga) {
      console.log(`✅ ${userEmail} is an ${mgaRga.role}: ${mgaRga.name} (associate_id: ${mgaRga.associate_id})`);
      return true;
    }

    console.log(`⚠️ ${userEmail} (associate_id: ${customer.associate_id}) is NOT in mga_rga_directory`);
    return false;

  } catch (error) {
    console.error(`❌ Error in isUserMgaOrRga for ${userEmail}:`, error);
    return false;
  }
}

/**
 * Get MGA/RGA details for a user
 * @param userEmail - The user's email address
 * @returns Promise<{isMgaRga: boolean, role?: string, name?: string}> - MGA/RGA status and details
 */
export async function getMgaRgaDetails(userEmail: string): Promise<{
  isMgaRga: boolean;
  role?: string;
  name?: string;
  associateId?: number;
}> {
  if (!supabaseAdmin) {
    console.error('❌ Supabase admin client not initialized');
    return { isMgaRga: false };
  }

  try {
    // Step 1: Get the user's associate_id from the customers table
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('associate_id')
      .eq('company_email', userEmail.toLowerCase().trim())
      .maybeSingle();

    if (!customer?.associate_id) {
      return { isMgaRga: false };
    }

    // Step 2: Check if this associate_id exists in the mga_rga_directory table
    const { data: mgaRga } = await supabaseAdmin
      .from('mga_rga_directory')
      .select('associate_id, name, role')
      .eq('associate_id', customer.associate_id)
      .maybeSingle();

    if (mgaRga) {
      return {
        isMgaRga: true,
        role: mgaRga.role,
        name: mgaRga.name,
        associateId: mgaRga.associate_id
      };
    }

    return { isMgaRga: false };

  } catch (error) {
    console.error(`❌ Error in getMgaRgaDetails for ${userEmail}:`, error);
    return { isMgaRga: false };
  }
}

