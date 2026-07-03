import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import { Link } from 'wouter';

export function ForgotPasscodePage() {
  const [email, setEmail] = useState('');
  const [associateId, setAssociateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [found, setFound] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setFound(false);
    setAssociateId('');

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/send-passcode-sms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.error || 'Email not found. Contact your manager.');
        return;
      }

      setAssociateId(String(data.associateId || ''));
      setFound(true);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="text-4xl font-bold mb-2">
            <span
              className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent"
              style={{
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                display: 'inline-block',
                lineHeight: '1.2',
              }}
            >
              AO Intelligence
            </span>
          </div>
          <div className="text-slate-600 dark:text-slate-400 text-lg">
            <span className="italic">powered by</span>{' '}
            <span className="font-bold text-blue-600 dark:text-blue-400">ConnectNow</span>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-center text-slate-800 dark:text-slate-200">
              Retrieve Your Passcode
            </CardTitle>
            <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1">
              Enter your AO Globe Life email to view your passcode.
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            {!found ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email Address
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="yourname@aoglobelife.com"
                    disabled={loading}
                    className="w-full"
                    required
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-600 dark:text-red-400 font-medium">{error}</p>
                )}

                <Button type="submit" className="w-full py-2 text-base font-medium" disabled={loading}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Looking you up...
                    </>
                  ) : (
                    'Show My Passcode'
                  )}
                </Button>
              </form>
            ) : (
              <div className="space-y-6">
                <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 dark:bg-amber-900/30 dark:border-amber-500">
                  <p className="text-amber-800 dark:text-amber-200 font-bold text-base text-center leading-snug">
                    Your passcode:
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm text-center mt-2 leading-relaxed">
                    Write this down and keep it safe.
                  </p>
                </div>

                <div className="text-center">
                  <p
                    className="text-5xl font-mono font-bold tracking-widest text-slate-800 dark:text-slate-100 select-all cursor-text"
                    title="Select to copy"
                  >
                    {associateId}
                  </p>
                </div>
              </div>
            )}

            <div className="text-center">
              <Link href="/login" className="text-sm text-blue-600 hover:underline font-medium">
                ← Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
