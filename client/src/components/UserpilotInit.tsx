import { useEffect, useState } from 'react';
import { Userpilot } from 'userpilot';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';

export function UserpilotInit() {
  const { authState } = useAuth();
  const [initialized, setInitialized] = useState(false);

  // Fetch user profile data for detailed identification (optional - 404 is fine on old deployments)
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile', authState.user?.email],
    queryFn: async () => {
      if (!authState.user?.email) return null;
      try {
        const response = await fetch('/api/user/profile', {
          credentials: 'include',
          headers: {
            'user-email': authState.user.email
          }
        });
        if (!response.ok) return null;
        return response.json();
      } catch {
        return null;
      }
    },
    enabled: !!authState.user?.email,
    retry: false,
    staleTime: 5 * 60 * 1000
  });

  useEffect(() => {
    if (initialized) return;

    // Initialize Userpilot once
    try {
      Userpilot.initialize('NX-7322199a');
      console.log('✅ Userpilot initialized');
      setInitialized(true);
    } catch (error) {
      console.error('❌ Userpilot initialization error:', error);
    }
  }, [initialized]);

  useEffect(() => {
    // Identify user when authenticated and profile loaded
    if (!initialized || !authState.user?.email) return;

    try {
      const userId = userProfile?.associate_id || authState.user.email;
      const userName = userProfile?.first_name && userProfile?.last_name 
        ? `${userProfile.first_name} ${userProfile.last_name}`
        : authState.user.email.split('@')[0];
      
      Userpilot.identify(userId.toString(), {
        name: userName,
        email: authState.user.email,
        created_at: userProfile?.created_at || new Date().toISOString(),
        associate_id: userProfile?.associate_id,
        mga_team: userProfile?.mga || 'Unassigned',
        rga_team: userProfile?.rga,
        markets: userProfile?.markets,
        company: {
          id: 'aoglobelife',
          name: 'AO Globe Life',
          industry: 'Insurance',
          plan: userProfile?.plan || 'Standard'
        }
      });
      
      console.log('✅ Userpilot user identified:', userId, userName);
    } catch (error) {
      console.error('❌ Userpilot identification error:', error);
    }
  }, [initialized, authState.user?.email, userProfile]);

  return null; // This component doesn't render anything
}

