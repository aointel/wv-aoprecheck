import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MapPin, Target, Phone, Users, Shield } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const JOIN_PRIMARY_MARKETS = ['Veteran', 'Globe Market', 'Will Kit', 'AO Vamos', 'NA'] as const;
const JOIN_SECONDARY_MARKETS = ['Will Kit', 'None'] as const;
const JOIN_PRODUCTS = ['Life', 'Accident', 'Hospital', 'Final Expense', 'Child Safe'] as const;
const US_STATE_CODES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME',
  'MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VA','VT','WA','WI','WV','WY',
] as const;
const JOIN_AOI_MODULES = [
  { id: 'connect', name: 'Connect', icon: Phone, description: 'Outbound calling and lead management' },
  { id: 'recruit', name: 'Recruit', icon: Users, description: 'Producer recruitment and onboarding' },
  { id: 'precheck', name: 'PreCheck', icon: Shield, description: 'Sale verification and compliance' },
] as const;

export function JoinPage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState('');
  const [primaryMarket, setPrimaryMarket] = useState('');
  const [secondaryMarket, setSecondaryMarket] = useState('');
  const [aoiModules, setAoiModules] = useState<string[]>([]);
  const [associateId, setAssociateId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(3);
  const [loginLoading, setLoginLoading] = useState(false);
  const [phone, setPhone] = useState('');
  const [phoneSent, setPhoneSent] = useState(false);
  const [phoneCode, setPhoneCode] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneSending, setPhoneSending] = useState(false);
  const [phoneVerifying, setPhoneVerifying] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualEmailConfirm, setManualEmailConfirm] = useState('');
  const [manualAssociateId, setManualAssociateId] = useState('');
  const [manualAssociateIdConfirm, setManualAssociateIdConfirm] = useState('');
  const [manualFirstName, setManualFirstName] = useState('');
  const [manualLastName, setManualLastName] = useState('');
  const [manualProducts, setManualProducts] = useState<string[]>([]);
  const [manualStates, setManualStates] = useState<string[]>([]);

  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const toggleJoinModule = (moduleId: string) => {
    setAoiModules((prev) =>
      prev.includes(moduleId) ? prev.filter((id) => id !== moduleId) : [...prev, moduleId],
    );
  };

  const toggleManualProduct = (product: string) => {
    setManualProducts((prev) => (prev.includes(product) ? prev.filter((p) => p !== product) : [...prev, product]));
  };

  const toggleManualState = (stateCode: string) => {
    setManualStates((prev) => (prev.includes(stateCode) ? prev.filter((s) => s !== stateCode) : [...prev, stateCode]));
  };

  // 3-second countdown when step 2 shows
  useEffect(() => {
    if (step !== 2) return;
    setCountdown(3);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [step]);

  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.toLowerCase().trim();
    if (!normalizedEmail) {
      setError('Please enter your email address.');
      return;
    }
    if (!primaryMarket) {
      setError('Please select your primary market.');
      return;
    }
    if (aoiModules.length === 0) {
      setError('Select at least one section you are applying for (Connect, Recruit, or PreCheck).');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/provision-agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          primaryMarket,
          secondaryMarket: secondaryMarket === 'None' ? '' : secondaryMarket,
          aoiModules,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.allowManual) {
          const qp = new URLSearchParams();
          qp.set('email', normalizedEmail);
          if (primaryMarket) qp.set('primaryMarket', primaryMarket);
          if (secondaryMarket) qp.set('secondaryMarket', secondaryMarket);
          if (aoiModules.length > 0) qp.set('aoiModules', aoiModules.join(','));
          setLocation(`/signup-assistance?${qp.toString()}`);
          return;
        }
        setError(data.error || 'Email not found. Contact your manager.');
        return;
      }

      setAssociateId(String(data.associateId));
      setEmail(normalizedEmail);
      setStep(2);
    } catch (err) {
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const normalizedEmail = email.toLowerCase().trim();

    if (!normalizedEmail.endsWith('@aoglobelife.com')) {
      setError('Email must be an @aoglobelife.com address.');
      return;
    }
    if (normalizedEmail !== manualEmailConfirm.toLowerCase().trim()) {
      setError('Emails do not match.');
      return;
    }
    if (!manualAssociateId || !manualAssociateIdConfirm) {
      setError('Enter and confirm Associate ID.');
      return;
    }
    if (manualAssociateId !== manualAssociateIdConfirm) {
      setError('Associate IDs do not match.');
      return;
    }
    if (!/^23\d+$/.test(manualAssociateId)) {
      setError('Associate ID must be numeric and start with 23.');
      return;
    }
    if (!primaryMarket) {
      setError('Please select your primary market.');
      return;
    }
    if (manualProducts.length === 0) {
      setError('Select at least one product.');
      return;
    }
    if (manualStates.length === 0) {
      setError('Select at least one state.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/auth/provision-agent/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          emailConfirm: manualEmailConfirm.toLowerCase().trim(),
          associateId: manualAssociateId.trim(),
          associateIdConfirm: manualAssociateIdConfirm.trim(),
          firstName: manualFirstName.trim(),
          lastName: manualLastName.trim(),
          phone: phone.trim(),
          primaryMarket,
          secondaryMarket: secondaryMarket === 'None' ? '' : secondaryMarket,
          aoiModules,
          products: manualProducts,
          states: manualStates,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error || 'Manual submission failed.');
        return;
      }
      setAssociateId(String(data.associateId));
      setEmail(normalizedEmail);
      setStep(2);
    } catch {
      setError('Manual submission failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleTakeToApp = async () => {
    if (countdown > 0) return;
    setLoginLoading(true);
    try {
      await login(email, associateId);
      toast({ title: 'Welcome!', description: 'You are now logged in.' });
      setLocation('/connect'); // startup diagnostic runs automatically on first load of /connect
    } catch (err) {
      toast({
        title: 'Login Failed',
        description: err instanceof Error ? err.message : 'Could not log in. Try going to the login page.',
        variant: 'destructive',
      });
    } finally {
      setLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg">
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
          {step === 1 && (
            <>
              <CardHeader>
                <CardTitle className="text-center text-slate-800 dark:text-slate-200">
                  Get your account
                </CardTitle>
                <p className="text-center text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Enter your work email, your markets, and the sections you are applying for. You will receive your
                  passcode (Associate ID) and can set up 2FA next.
                </p>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleContinue} className="space-y-4">
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

                  <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/80 dark:bg-blue-950/30 p-3 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-blue-900 dark:text-blue-100">
                      <MapPin className="w-4 h-4 shrink-0" />
                      Market assignment
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Primary market</Label>
                        <Select value={primaryMarket} onValueChange={setPrimaryMarket} disabled={loading}>
                          <SelectTrigger className="bg-white dark:bg-slate-900">
                            <SelectValue placeholder="Select primary" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOIN_PRIMARY_MARKETS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-600 dark:text-slate-400">Secondary market</Label>
                        <Select value={secondaryMarket} onValueChange={setSecondaryMarket} disabled={loading}>
                          <SelectTrigger className="bg-white dark:bg-slate-900">
                            <SelectValue placeholder="Optional" />
                          </SelectTrigger>
                          <SelectContent>
                            {JOIN_SECONDARY_MARKETS.map((m) => (
                              <SelectItem key={m} value={m}>
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/80 dark:bg-purple-950/30 p-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-purple-900 dark:text-purple-100">
                      <Target className="w-4 h-4 shrink-0" />
                      Sections you are applying for
                    </div>
                    <p className="text-xs text-purple-800/90 dark:text-purple-200/90">
                      Choose at least one. We save this with your account when you continue.
                    </p>
                    <div className="space-y-2">
                      {JOIN_AOI_MODULES.map((mod) => {
                        const Icon = mod.icon;
                        const on = aoiModules.includes(mod.id);
                        return (
                          <button
                            key={mod.id}
                            type="button"
                            disabled={loading}
                            onClick={() => toggleJoinModule(mod.id)}
                            className={`w-full text-left rounded-lg border-2 p-3 flex gap-3 transition-colors ${
                              on
                                ? 'border-purple-500 bg-purple-100/90 dark:bg-purple-900/40'
                                : 'border-slate-200 dark:border-slate-600 hover:border-purple-300'
                            }`}
                          >
                            <div
                              className={`p-2 rounded-md shrink-0 ${on ? 'bg-purple-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600'}`}
                            >
                              <Icon className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="text-sm font-medium text-slate-800 dark:text-slate-100">{mod.name}</div>
                              <div className="text-xs text-slate-500 dark:text-slate-400">{mod.description}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
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
                      'Continue'
                    )}
                  </Button>
                </form>

                {manualMode && (
                  <form onSubmit={handleManualSubmit} className="mt-6 space-y-4 border-t pt-5">
                    <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      Manual submit enabled. Enter and confirm your work email and associate ID from POD.
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Confirm work email</Label>
                        <Input
                          type="email"
                          value={manualEmailConfirm}
                          onChange={(e) => setManualEmailConfirm(e.target.value)}
                          placeholder="yourname@aoglobelife.com"
                          disabled={loading}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Associate ID (starts with 23)</Label>
                        <Input
                          value={manualAssociateId}
                          onChange={(e) => setManualAssociateId(e.target.value)}
                          placeholder="23xxxx"
                          disabled={loading}
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Confirm Associate ID</Label>
                        <Input
                          value={manualAssociateIdConfirm}
                          onChange={(e) => setManualAssociateIdConfirm(e.target.value)}
                          placeholder="23xxxx"
                          disabled={loading}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Phone (optional)</Label>
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          disabled={loading}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>First name (optional)</Label>
                        <Input value={manualFirstName} onChange={(e) => setManualFirstName(e.target.value)} disabled={loading} />
                      </div>
                      <div className="space-y-2">
                        <Label>Last name (optional)</Label>
                        <Input value={manualLastName} onChange={(e) => setManualLastName(e.target.value)} disabled={loading} />
                      </div>
                    </div>

                    <div className="rounded-lg border p-3 space-y-2">
                      <Label className="text-sm font-semibold">Products</Label>
                      <div className="flex flex-wrap gap-2">
                        {JOIN_PRODUCTS.map((product) => {
                          const active = manualProducts.includes(product);
                          return (
                            <button
                              key={product}
                              type="button"
                              onClick={() => toggleManualProduct(product)}
                              className={`px-3 py-1.5 rounded-md border text-xs ${active ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300'}`}
                              disabled={loading}
                            >
                              {product}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="rounded-lg border p-3 space-y-2">
                      <Label className="text-sm font-semibold">Licensed states</Label>
                      <div className="grid grid-cols-6 sm:grid-cols-10 gap-1.5">
                        {US_STATE_CODES.map((stateCode) => {
                          const active = manualStates.includes(stateCode);
                          return (
                            <button
                              key={stateCode}
                              type="button"
                              onClick={() => toggleManualState(stateCode)}
                              className={`h-7 rounded border text-[11px] font-semibold ${active ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-700 border-slate-300'}`}
                              disabled={loading}
                            >
                              {stateCode}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                      {loading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Submitting manual entry...
                        </>
                      ) : (
                        'Submit Manually'
                      )}
                    </Button>
                  </form>
                )}

                <div className="mt-6 text-center">
                  <p className="text-sm text-slate-500">
                    Already have an account?{' '}
                    <Link href="/login" className="text-blue-600 hover:underline font-medium">
                      Sign in
                    </Link>
                  </p>
                </div>
              </CardContent>
            </>
          )}

          {step === 2 && (
            <>
              <CardHeader>
                <CardTitle className="text-center text-slate-800 dark:text-slate-200">
                  Your Passcode
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Warning box */}
                <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 dark:bg-amber-900/30 dark:border-amber-500">
                  <p className="text-amber-800 dark:text-amber-200 font-bold text-base text-center leading-snug">
                    ⚠️ WRITE THIS DOWN
                  </p>
                  <p className="text-amber-700 dark:text-amber-300 text-sm text-center mt-2 leading-relaxed">
                    Your passcode is your unique Associate ID.
                    <br />
                    You will need it every time you log in.
                    <br />
                    <strong>We cannot send it to you — write it on paper.</strong>
                  </p>
                </div>

                {/* Giant passcode display */}
                <div className="text-center">
                  <p
                    className="text-5xl font-mono font-bold tracking-widest text-slate-800 dark:text-slate-100 select-all cursor-text"
                    title="Select to copy"
                  >
                    {associateId}
                  </p>
                </div>

                {/* Phone 2FA */}
                <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-semibold text-blue-800 mb-1">
                    📱 Add your phone number (recommended)
                  </p>
                  <p className="text-xs text-blue-600 mb-3">
                    If you ever lose your passcode, we can text it to you.
                  </p>

                  {!phoneSent && !phoneVerified && (
                    <div className="flex gap-2">
                      <input
                        type="tel"
                        value={phone}
                        onChange={e => { setPhone(e.target.value); setPhoneError(''); }}
                        placeholder="(555) 123-4567"
                        className="flex-1 border border-blue-300 rounded px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={!phone || phoneSending}
                        onClick={async () => {
                          setPhoneSending(true);
                          setPhoneError('');
                          try {
                            const res = await fetch('/api/auth/send-phone-code', {
                              method: 'POST',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({ email, phone })
                            });
                            const data = await res.json();
                            if (data.success) {
                              setPhoneSent(true);
                            } else {
                              setPhoneError(data.error || 'Failed to send code');
                            }
                          } catch { setPhoneError('Failed to send code'); }
                          setPhoneSending(false);
                        }}
                        className="px-3 py-2 bg-blue-600 text-white text-sm rounded disabled:opacity-50 whitespace-nowrap"
                      >
                        {phoneSending ? 'Sending...' : 'Send Code'}
                      </button>
                    </div>
                  )}

                  {phoneSent && !phoneVerified && (
                    <div className="space-y-2">
                      <p className="text-xs text-green-700">✅ Code sent! Check your phone.</p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={phoneCode}
                          onChange={e => { setPhoneCode(e.target.value); setPhoneError(''); }}
                          placeholder="6-digit code"
                          maxLength={6}
                          className="flex-1 border border-blue-300 rounded px-3 py-2 text-sm tracking-widest"
                        />
                        <button
                          type="button"
                          disabled={phoneCode.length !== 6 || phoneVerifying}
                          onClick={async () => {
                            setPhoneVerifying(true);
                            setPhoneError('');
                            try {
                              const res = await fetch('/api/auth/verify-phone-code', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ email, code: phoneCode })
                              });
                              const data = await res.json();
                              if (data.verified) {
                                setPhoneVerified(true);
                              } else {
                                setPhoneError(data.error || 'Invalid code');
                              }
                            } catch { setPhoneError('Verification failed'); }
                            setPhoneVerifying(false);
                          }}
                          className="px-3 py-2 bg-green-600 text-white text-sm rounded disabled:opacity-50"
                        >
                          {phoneVerifying ? 'Verifying...' : 'Verify'}
                        </button>
                      </div>
                      <button
                        type="button"
                        className="text-xs text-blue-600 underline"
                        onClick={() => { setPhoneSent(false); setPhoneCode(''); }}
                      >
                        Wrong number? Go back
                      </button>
                    </div>
                  )}

                  {phoneVerified && (
                    <p className="text-green-700 text-sm font-semibold">✅ Phone verified and saved!</p>
                  )}

                  {phoneError && <p className="text-red-500 text-xs mt-1">{phoneError}</p>}
                </div>

                {/* CTA Button with countdown */}
                <Button
                  onClick={handleTakeToApp}
                  disabled={countdown > 0 || loginLoading}
                  className="w-full py-3 text-base font-semibold"
                >
                  {loginLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Logging you in...
                    </>
                  ) : countdown > 0 ? (
                    `✅ I wrote it down — Take me to the app (${countdown})`
                  ) : (
                    '✅ I wrote it down — Take me to the app'
                  )}
                </Button>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
