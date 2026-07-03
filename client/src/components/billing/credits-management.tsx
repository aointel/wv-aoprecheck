import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, DollarSign, Calendar, Phone, Info } from 'lucide-react';
import { format } from 'date-fns';

interface MissedCallTransaction {
  transaction_id: string;
  agent_email: string;
  agent_name: string;
  transaction_date: string;
  amount_usd: number;
  credits_charged: number;
  lead_name: string | null;
  lead_phone: string | null;
  description: string;
  metadata: any;
  reversal_note?: string;
}

interface CreditsManagementSectionProps {
  userEmail?: string | null;
}

export function CreditsManagementSection({ userEmail }: CreditsManagementSectionProps) {
  // Fetch missed call transactions
  const { data: missedCallTransactions, isLoading } = useQuery<MissedCallTransaction[]>({
    queryKey: ['/api/billing/missed-call-transactions', userEmail],
    queryFn: async () => {
      if (!userEmail) return [];
      const response = await fetch(`/api/billing/missed-call-transactions?email=${encodeURIComponent(userEmail)}`);
      if (!response.ok) return [];
      const data = await response.json();
      return data.transactions || [];
    },
    enabled: !!userEmail,
  });

  // Calculate total: positive = debits (charges), negative = credits (refunds)
  const totalMissedCallAmount = missedCallTransactions?.reduce((sum, t) => {
    // If it's a refund/reversal, it's negative (credit)
    // If it's a charge, it's positive (debit)
    const amount = t.transaction_type === 'refund' ? -(t.amount_usd || 0) : (t.amount_usd || 0);
    return sum + amount;
  }, 0) || 0;
  
  const totalDebits = missedCallTransactions?.filter(t => t.transaction_type !== 'refund').reduce((sum, t) => sum + (t.amount_usd || 0), 0) || 0;
  const totalCredits = missedCallTransactions?.filter(t => t.transaction_type === 'refund').reduce((sum, t) => sum + (t.amount_usd || 0), 0) || 0;

  return (
    <div className="space-y-6">
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>Missed Call Transactions</AlertTitle>
        <AlertDescription>
          View all missed call transactions. Debits (charges) are positive, Credits (refunds) are negative.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <div>
            <CardTitle>Missed Call Ledger</CardTitle>
            <CardDescription>
              {missedCallTransactions?.length || 0} transaction(s) | 
              Debits: ${totalDebits.toFixed(2)} | 
              Credits: -${totalCredits.toFixed(2)} | 
              Net: ${totalMissedCallAmount >= 0 ? '+' : ''}${totalMissedCallAmount.toFixed(2)}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4" />
              <p className="text-muted-foreground">Loading missed call credits...</p>
            </div>
          ) : !missedCallTransactions || missedCallTransactions.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Missed Call Credits</h3>
              <p className="text-muted-foreground">No missed call credits found for your account.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {missedCallTransactions.map((transaction) => {
                const isCredit = transaction.transaction_type === 'refund';
                const amount = isCredit ? -(transaction.amount_usd || 0) : (transaction.amount_usd || 0);
                const displayAmount = amount >= 0 ? `+$${Math.abs(amount).toFixed(2)}` : `-$${Math.abs(amount).toFixed(2)}`;
                
                return (
                  <div
                    key={transaction.transaction_id}
                    className="border rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-900 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Phone className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">
                              {transaction.lead_name || 'Unknown Lead'}
                            </span>
                            <Badge 
                              variant="outline" 
                              className={isCredit 
                                ? "bg-green-50 text-green-700 border-green-300" 
                                : "bg-red-50 text-red-700 border-red-300"
                              }
                            >
                              {isCredit ? 'Credit' : 'Debit'}
                            </Badge>
                          </div>
                          <div className="text-right">
                            <div className={`font-bold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                              {displayAmount}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {isCredit ? '-' : '+'}{Math.abs(transaction.credits_charged || 0)} credits
                            </div>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(transaction.transaction_date), 'MMM d, yyyy')}
                          </div>
                          {transaction.lead_phone && (
                            <div className="flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {transaction.lead_phone}
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <DollarSign className="h-3 w-3" />
                            {transaction.description || (isCredit ? 'Missed call refund' : 'Missed call charge')}
                          </div>
                        </div>
                        {transaction.reversal_note && (
                          <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-xs text-blue-700 dark:text-blue-300">
                            <Info className="h-3 w-3 inline mr-1" />
                            {transaction.reversal_note}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

