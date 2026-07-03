/**
 * Utility functions for tracking masterlead contact timestamps
 */

import { apiRequest } from '@/lib/queryClient';

/**
 * Update masterlead last_contacted timestamp when a call is initiated
 * @param phoneNumber - The lead's phone number being called
 */
export async function updateMasterleadLastContacted(phoneNumber: string): Promise<void> {
  try {
    if (!phoneNumber) {
      console.warn('❌ No phone number provided for masterlead tracking');
      return;
    }

    console.log('📞 Updating masterlead last_contacted for:', phoneNumber);
    
    // Update masterlead
    const masterResponse = await apiRequest('POST', '/api/masterlead/update-last-contacted', {
      phoneNumber
    });

    // Also update hotlead
    const hotResponse = await apiRequest('POST', '/api/hotlead/update-last-contacted', {
      phoneNumber
    });

    if (masterResponse.ok) {
      const result = await masterResponse.json();
      console.log('✅ Masterlead last_contacted updated:', result.phone);
    } else {
      console.error('❌ Failed to update masterlead last_contacted:', masterResponse.statusText);
    }

    if (hotResponse.ok) {
      const result = await hotResponse.json();
      console.log('✅ Hotlead last_contacted updated:', result.phone);
    } else {
      console.error('❌ Failed to update hotlead last_contacted:', hotResponse.statusText);
    }
  } catch (error) {
    console.error('❌ Error updating lead last_contacted:', error);
  }
}