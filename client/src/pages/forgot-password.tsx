import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link } from 'wouter';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [message, setMessage] = useState('');
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setIsLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await response.json();
      const assoc = typeof data.associateId === 'string' ? data.associateId : '';
      setMessage(
        assoc
          ? `Your passcode is: ${assoc}`
          : data.message || 'Your passcode is unavailable — check your Planet profile or contact your manager.',
      );
      setDone(true);
    } catch (err) {
      toast({ title: 'Error', description: 'Something went wrong. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="text-4xl font-bold mb-2">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent" style={{ WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', display: 'inline-block', lineHeight: '1.2' }}>
              AO Intelligence
            </span>
          </div>
          <div className="text-slate-600 dark:text-slate-400 text-lg">
            <span className="italic">powered by</span>{' '}
            <span className="font-bold text-blue-600 dark:text-blue-400">ConnectNow</span>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold">
              {done ? '✅ Passcode Sent' : 'Retrieve Your Passcode'}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-4">
            {!done ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400 text-center">
                  Enter your email to view your passcode.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@aoglobelife.com"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    required
                    autoFocus
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || !email.trim()}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading...</> : 'Show My Passcode'}
                </Button>
              </form>
            ) : (
              <div className="text-center space-y-4 py-2">
                <p className="text-slate-700 dark:text-slate-300">{message}</p>
                <p className="text-sm text-slate-500">Once you have your passcode, use it to log in.</p>
                <Button asChild className="w-full">
                  <Link href="/login">← Back to Login</Link>
                </Button>
              </div>
            )}
            {!done && (
              <div className="mt-4 text-center">
                <Link href="/login" className="text-sm text-blue-600 hover:underline flex items-center justify-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Back to Login
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default ForgotPasswordPage;
