import { Phone, Zap, Route, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';

interface CallConnectorProFeaturesProps {
  onUpgrade?: () => void;
}

export function CallConnectorProFeatures({ onUpgrade }: CallConnectorProFeaturesProps) {
  const { authState } = useAuth();
  const userEmail = authState?.user?.email;

  // Check if user has Call Connector Pro access
  const { data: accessData } = useQuery({
    queryKey: ['/api/call-connector-pro/access-check', userEmail],
    queryFn: async () => {
      if (!userEmail) return { hasAccess: false };
      const response = await fetch(`/api/call-connector-pro/access-check/${encodeURIComponent(userEmail)}`);
      if (!response.ok) return { hasAccess: false };
      return response.json();
    },
    enabled: !!userEmail,
    staleTime: 5 * 60 * 1000,
    retry: 1
  });

  const hasAccess = accessData?.hasAccess || false;
  const features = [
    {
      icon: Phone,
      title: "Local Presence Numbers",
      description: "Dial through your leads using numbers local to the area you're calling for higher pickup rates"
    },
    {
      icon: Zap,
      title: "AI-Driven Lead Scoring",
      description: "Our AI analyzes patterns, time of day, region, and past pickup behavior to prioritize the best prospects"
    },
    {
      icon: Route,
      title: "Smart Routing",
      description: "Intelligent routing puts you in front of prospects who are most likely to pick up"
    },
    {
      icon: Clock,
      title: "More Contacts in Less Time",
      description: "Efficient, streamlined system built around results - make more contacts with less effort"
    }
  ];

  return (
    <div className="w-full space-y-8">
      {/* Header */}
      <div className="text-center space-y-4">
        <div className="space-y-2">
          <h2 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Call Connector Pro Features
          </h2>
          <h3 className="text-4xl font-extrabold bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent">
            Professional Plan
          </h3>
        </div>
        <p className="text-xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Unlock more contacts and hotleads by upgrading today!
        </p>
      </div>

      {/* Features Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature, index) => {
          const Icon = feature.icon;
          return (
            <div
              key={index}
              className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:border-blue-500 dark:hover:border-blue-400 transition-all duration-300 hover:shadow-lg"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Icon className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 space-y-2">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Key Benefits */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg p-6 border border-blue-200 dark:border-blue-800">
        <h3 className="text-xl font-semibold mb-4 text-gray-900 dark:text-white flex items-center gap-2">
          <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
          Why Call Connector Pro?
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
            <span className="text-gray-700 dark:text-gray-300">Efficient dialing system</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
            <span className="text-gray-700 dark:text-gray-300">Streamlined workflow</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-600"></div>
            <span className="text-gray-700 dark:text-gray-300">Results-driven approach</span>
          </div>
        </div>
      </div>

      {/* Subscribe → opens SubscriptionUpgradeModal (Stripe) from parent */}
      {!hasAccess && onUpgrade && (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="text-center sm:text-left">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Professional plan — $64.99/mo
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Secure checkout with Stripe. Unlocks Call Connector Pro outbound dialing.
            </p>
          </div>
          <Button
            type="button"
            size="lg"
            onClick={() => onUpgrade()}
            className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 hover:from-blue-700 hover:via-purple-700 hover:to-blue-800 text-white font-semibold px-8 shadow-lg shrink-0"
          >
            Subscribe to Call Connector Pro
            <ArrowRight className="w-4 h-4 ml-2 inline" />
          </Button>
        </div>
      )}
      {hasAccess && (
        <p className="text-center text-sm text-green-600 dark:text-green-400 pt-4 border-t border-gray-200 dark:border-gray-700">
          You have Call Connector Pro access.
        </p>
      )}
    </div>
  );
}

