// Hotlead last_contacted tracking functionality
import { apiRequest } from '@/lib/queryClient';

/**
 * Updates the last_contacted timestamp for a hotlead when a call is initiated
 */
async function updateHotleadLastContacted(phoneNumber: string): Promise<void> {
  try {
    if (!phoneNumber) {
      console.warn('❌ No phone number provided for hotlead tracking');
      return;
    }

    console.log('📞 Updating hotlead last_contacted for:', phoneNumber);
    
    const response = await apiRequest('POST', '/api/hotlead/update-last-contacted', {
      phoneNumber
    });

    if (response.ok) {
      const result = await response.json();
      console.log('✅ Hotlead last_contacted updated:', result.phone);
    } else {
      console.error('❌ Failed to update hotlead last_contacted:', response.statusText);
    }
  } catch (error) {
    console.error('❌ Error updating hotlead last_contacted:', error);
  }
}

/**
 * Updates both masterlead AND hotlead last_contacted timestamps
 */
async function updateAllLeadLastContacted(phoneNumber: string): Promise<void> {
  try {
    if (!phoneNumber) {
      console.warn('❌ No phone number provided for lead tracking');
      return;
    }

    console.log('📞 Updating ALL lead last_contacted for:', phoneNumber);
    
    // Update masterlead
    const masterResponse = await apiRequest('POST', '/api/masterlead/update-last-contacted', {
      phoneNumber
    });

    // Update hotlead
    const hotResponse = await apiRequest('POST', '/api/hotlead/update-last-contacted', {
      phoneNumber
    });

    if (masterResponse.ok && hotResponse.ok) {
      console.log('✅ ALL lead last_contacted updated for:', phoneNumber);
    } else {
      console.error('❌ Some lead updates failed for:', phoneNumber);
    }
  } catch (error) {
    console.error('❌ Error updating all lead last_contacted:', error);
  }
}

export { updateHotleadLastContacted, updateAllLeadLastContacted };