import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Phone, DollarSign, AlertTriangle, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreditNotification {
  type: 'connect' | 'low_balance' | 'purchase';
  agentId: string;
  amount: number;
  newBalance: number;
  clientName?: string;
  phoneNumber?: string;
  timestamp: string;
}

export function CreditNotifications() {
  const [notifications, setNotifications] = useState<CreditNotification[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    // DISABLED: /ws credit notifications — endpoint returns 400 and spams reconnects
    return () => {};
  }, []);

  const showCreditToast = (notification: CreditNotification) => {
    const isLowBalance = notification.newBalance <= 10;
    
    if (notification.type === 'connect') {
      toast({
        title: (
          <div className="flex items-center space-x-2">
            <Phone className="h-4 w-4 text-blue-600" />
            <span>AOI Connect Charged</span>
          </div>
        ),
        description: (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>📞 {notification.clientName || 'Client'}</span>
              <span className="text-red-600 font-medium">-${Math.abs(notification.amount).toFixed(2)}</span>
            </div>
            <div className="text-sm text-gray-600">
              Balance: ${notification.newBalance.toFixed(2)}
              {isLowBalance && (
                <Badge variant="destructive" className="ml-2">Low Balance</Badge>
              )}
            </div>
          </div>
        ),
        duration: 5000,
      });
    } else if (notification.type === 'low_balance') {
      toast({
        title: (
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-orange-600" />
            <span>Low Credit Balance</span>
          </div>
        ),
        description: (
          <div className="space-y-1">
            <div>Balance: ${notification.newBalance.toFixed(2)}</div>
            <div className="text-sm text-gray-600">Consider adding more credits to continue using AOI services</div>
          </div>
        ),
        variant: "destructive",
        duration: 8000,
      });
    } else if (notification.type === 'purchase') {
      toast({
        title: (
          <div className="flex items-center space-x-2">
            <CreditCard className="h-4 w-4 text-green-600" />
            <span>Credits Added</span>
          </div>
        ),
        description: (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span>Credit Purchase</span>
              <span className="text-green-600 font-medium">+${notification.amount.toFixed(2)}</span>
            </div>
            <div className="text-sm text-gray-600">
              New Balance: ${notification.newBalance.toFixed(2)}
            </div>
          </div>
        ),
        duration: 5000,
      });
    }
  };

  return null; // This component only handles notifications, no UI
}

// Hook for accessing credit notifications
export function useCreditNotifications() {
  const [notifications, setNotifications] = useState<CreditNotification[]>([]);

  useEffect(() => {
    // DISABLED: /ws — see CreditNotifications component
    return () => {};
  }, []);

  return { notifications };
}