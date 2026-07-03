import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertCircle, ArrowLeft, Loader2 } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';

const PRIMARY_MARKETS = ['Veteran', 'Globe Market', 'Will Kit', 'AO Vamos', 'NA'] as const;
const SECONDARY_MARKETS = ['Will Kit', 'None'] as const;
const AOI_MODULES = ['connect', 'recruit', 'precheck'] as const;
const STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','IA','ID','IL','IN','KS','KY','LA','MA','MD','ME',
  'MI','MN','MO','MS','MT','NC','ND','NE','NH','NJ','NM','NV','NY','OH','OK','OR','PA','RI','SC','SD','TN',
  'TX','UT','VA','VT','WA','WI','WV','WY',
] as const;

const parseList = (value: string | null) =>
  (value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export function SignupAssistancePage() {
  const query = useMemo(() => new URLSearchParams(window.location.search), []);
  const initialEmail = (query.get('email') || '').toLowerCase().trim();
  const initialPrimaryMarket = query.get('primaryMarket') || '';
  const initialSecondaryMarket = query.get('secondaryMarket') || '';
  const initialModules = parseList(query.get('aoiModules')).filter((item) =>
    AOI_MODULES.includes(item as (typeof AOI_MODULES)[number]),
  );

  const [email, setEmail] = useState(initialEmail);
  const [emailConfirm, setEmailConfirm] = useState(initialEmail);
  const [associateId, setAssociateId] = useState('');
  const [associateIdConfirm, setAssociateIdConfirm] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [primaryMarket, setPrimaryMarket] = useState(initialPrimaryMarket);
  const [secondaryMarket, setSecondaryMarket] = useState(initialSecondaryMarket);
  const [aoiModules, setAoiModules] = useState<string[]>(initialModules);
  const [states, setStates] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [createdAssociateId, setCreatedAssociateId] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');

  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const toggleArrayValue = (
    value: string,
    list: string[],
    setter: Dispatch<SetStateAction<string[]>>,
  ) => {
    setter(list.includes(value) ? list.filter((entry) => entry !== value) : [...list, value]);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedEmailConfirm = emailConfirm.toLowerCase().trim();
    const cleanAssociateId = associateId.trim();
    const cleanAssociateIdConfirm = associateIdConfirm.trim();

    if (!normalizedEmail.endsWith('@aoglobelife.com')) {
      setError('Email must be an @aoglobelife.com address.');
      return;
    }
    if (normalizedEmail !== normalizedEmailConfirm) {
      setError('Emails do not match.');
      return;
    }
    if (!/^23\d+$/.test(cleanAssociateId)) {
      setError('Associate ID must be numeric and start with 23.');
      return;
    }
    if (cleanAssociateId !== cleanAssociateIdConfirm) {
      setError('Associate IDs do not match.');
      return;
    }
    if (!primaryMarket) {
      setError('Select a primary market.');
      return;
    }
    if (aoiModules.length === 0) {
      setError('Select at least one section (Connect, Recruit, PreCheck).');
      return;
    }
    if (states.length === 0) {
      setError('Select at least one state.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/provision-agent/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: normalizedEmail,
          emailConfirm: normalizedEmailConfirm,
          associateId: cleanAssociateId,
          associateIdConfirm: cleanAssociateIdConfirm,
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          primaryMarket,
          secondaryMarket: secondaryMarket === 'None' ? '' : secondaryMarket,
          aoiModules,
          states,
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) {
        setError(data.error || 'Manual signup failed.');
        return;
      }

      const issuedAssociateId = String(data.associateId || cleanAssociateId).trim();
      setCreatedAssociateId(issuedAssociateId);
      setCreatedEmail(normalizedEmail);
      toast({
        title: 'Account created',
        description: 'Write down your Associate ID. It is your password at sign in.',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Manual signup failed.');
    } finally {
      setLoading(false);
    }
  };

  if (createdAssociateId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-3xl shadow-xl">
          <CardHeader>
            <CardTitle className="text-center text-slate-800 dark:text-slate-200">Your Passcode</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="bg-amber-50 border-2 border-amber-400 rounded-lg p-4 dark:bg-amber-900/30 dark:border-amber-500">
              <p className="text-amber-800 dark:text-amber-200 font-bold text-base text-center leading-snug">
                ⚠️ WRITE THIS DOWN
              </p>
              <p className="text-amber-700 dark:text-amber-300 text-sm text-center mt-2 leading-relaxed">
                Your passcode is your unique Associate ID.
                <br />
                You will use this as your password when you sign in.
                <br />
                <strong>We cannot send it to you later - write it on paper.</strong>
              </p>
            </div>

            <div className="text-center">
              <p className="text-5xl font-mono font-bold tracking-widest text-slate-800 dark:text-slate-100 select-all cursor-text">
                {createdAssociateId}
              </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg dark:bg-blue-900/20 dark:border-blue-800">
              <p className="text-sm text-blue-800 dark:text-blue-200 font-medium">
                Next step: sign in, set your password, and complete 2FA before app access.
              </p>
            </div>

            <Button
              className="w-full py-3 text-base font-semibold"
              onClick={() => setLocation(`/login?email=${encodeURIComponent(createdEmail || email)}`)}
            >
              ✅ I wrote it down - Continue to Sign In
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <Card className="w-full max-w-3xl shadow-xl">
        <CardHeader className="space-y-3 pb-2">
          <div className="mx-auto w-14 h-14 bg-gradient-to-br from-orange-500 to-red-600 rounded-full flex items-center justify-center">
            <AlertCircle className="w-7 h-7 text-white" />
          </div>
          <CardTitle className="text-2xl text-center">Manual Signup</CardTitle>
          <CardDescription className="text-center">
            We could not verify your account automatically. Complete this form to continue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Email (@aoglobelife.com)</Label>
                <Input value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Confirm Email</Label>
                <Input value={emailConfirm} onChange={(e) => setEmailConfirm(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>Associate ID</Label>
                <Input value={associateId} onChange={(e) => setAssociateId(e.target.value)} required />
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Your Associate ID is located in your agent profile in{' '}
                  <a
                    href="https://pod.planetaltig.com"
                    target="_blank"
                    rel="noreferrer"
                    className="underline font-medium"
                  >
                    pod.planetaltig.com
                  </a>
                  . You will need a manager to get this for you.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Confirm Associate ID</Label>
                <Input value={associateIdConfirm} onChange={(e) => setAssociateIdConfirm(e.target.value)} required />
              </div>
              <div className="space-y-2">
                <Label>First Name (optional)</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name (optional)</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Phone (optional)</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Primary Market</Label>
                <Select value={primaryMarket} onValueChange={setPrimaryMarket}>
                  <SelectTrigger><SelectValue placeholder="Select primary market" /></SelectTrigger>
                  <SelectContent>
                    {PRIMARY_MARKETS.map((market) => (
                      <SelectItem key={market} value={market}>{market}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Secondary Market</Label>
                <Select value={secondaryMarket || 'None'} onValueChange={setSecondaryMarket}>
                  <SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent>
                    {SECONDARY_MARKETS.map((market) => (
                      <SelectItem key={market} value={market}>{market}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Sections</Label>
              <div className="flex flex-wrap gap-2">
                {AOI_MODULES.map((moduleId) => (
                  <Button
                    key={moduleId}
                    type="button"
                    variant={aoiModules.includes(moduleId) ? 'default' : 'outline'}
                    onClick={() => toggleArrayValue(moduleId, aoiModules, setAoiModules)}
                  >
                    {moduleId}
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Licensed States</Label>
              <div className="max-h-40 overflow-y-auto border rounded-md p-2 grid grid-cols-6 gap-2">
                {STATES.map((stateCode) => (
                  <Button
                    key={stateCode}
                    type="button"
                    size="sm"
                    variant={states.includes(stateCode) ? 'default' : 'outline'}
                    onClick={() => toggleArrayValue(stateCode, states, setStates)}
                  >
                    {stateCode}
                  </Button>
                ))}
              </div>
            </div>

            {error && (
              <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>
            )}

            <div className="space-y-3 pt-2">
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Submit Manual Signup'
                )}
              </Button>
              <Link href="/join">
                <Button variant="outline" className="w-full" type="button">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Get your account
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
