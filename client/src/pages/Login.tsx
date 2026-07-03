import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';
import AlexAILoginSupport from '@/components/alex-ai/AlexAILoginSupport';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showAlexChat, setShowAlexChat] = useState(false);
  const alexInputRef = useRef<HTMLInputElement>(null);
  const { login } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  // Load saved credentials on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('saved_email');
    const savedPassword = localStorage.getItem('saved_password');
    const wasRemembered = localStorage.getItem('remember_me') === 'true';
    
    if (savedEmail && savedPassword && wasRemembered) {
      setEmail(savedEmail);
      setPassword(savedPassword);
      setRememberMe(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Normalize email to lowercase and trim whitespace
    const normalizedEmail = email.toLowerCase().trim();
    
    console.log('🔐 Frontend form submission - Original Email:', email, 'Normalized Email:', normalizedEmail, 'Password length:', password.length);
    
    if (!normalizedEmail || !password) {
      toast({
        title: 'Error',
        description: 'Please enter both email and password',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Calling login with:', normalizedEmail, 'password length:', password.length);
      await login(normalizedEmail, password);
      
      // Save or clear credentials based on remember me checkbox
      if (rememberMe) {
        localStorage.setItem('saved_email', normalizedEmail);
        localStorage.setItem('saved_password', password);
        localStorage.setItem('remember_me', 'true');
      } else {
        localStorage.removeItem('saved_email');
        localStorage.removeItem('saved_password');
        localStorage.removeItem('remember_me');
      }
      
      toast({
        title: 'Success',
        description: 'Logged in successfully'
      });
      // Redirect to Connect page after successful login
      setLocation('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Invalid credentials';
      
      // Check if email verification is required
      if (errorMessage.includes('Email not verified') || errorMessage.includes('requiresVerification')) {
        toast({
          title: 'Email Verification Required',
          description: 'Please verify your email address before logging in. Check your inbox for the verification code.',
          duration: 8000,
          variant: 'destructive'
        });
        // Redirect to verification page
        setTimeout(() => {
          setLocation(`/verify-email?email=${encodeURIComponent(normalizedEmail)}`);
        }, 2000);
      } else {
        toast({
          title: 'Login Failed',
          description: errorMessage,
          variant: 'destructive'
        });
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8 pt-8">
          <div className="flex justify-center mb-6">
            <div className="text-center">
              <div className="text-4xl font-bold mb-2">
                <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent" style={{ 
                  WebkitBackgroundClip: 'text', 
                  WebkitTextFillColor: 'transparent', 
                  backgroundClip: 'text',
                  display: 'inline-block',
                  lineHeight: '1.2'
                }}>
                  AO Intelligence
                </span>
              </div>
              <div className="text-slate-600 dark:text-slate-400 text-lg">
                <span className="italic">powered by</span> <span className="font-bold text-blue-600 dark:text-blue-400">ConnectNow</span>
              </div>
            </div>
          </div>
        </div>

        <Card className="shadow-xl border-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-center text-slate-800 dark:text-slate-200">
              Producer Access Portal
            </CardTitle>
          </CardHeader>
          <CardContent>
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
                  placeholder="producer@example.com"
                  disabled={isLoading}
                  className="w-full"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Passcode
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      console.log('🔑 Password input change - length:', e.target.value.length, 'value:', e.target.value.substring(0, 10) + '...');
                      setPassword(e.target.value);
                    }}
                    placeholder="Enter your password"
                    disabled={isLoading}
                    className="w-full pr-10"
                    autoComplete="current-password"
                    maxLength={50}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked as boolean)}
                  data-testid="checkbox-remember-me"
                />
                <Label 
                  htmlFor="remember-me" 
                  className="text-sm font-medium text-slate-700 dark:text-slate-300 cursor-pointer"
                >
                  Save my password (Remember me)
                </Label>
              </div>

              <Button
                type="submit"
                className="w-full py-2 text-base font-medium"
                disabled={isLoading}
                data-testid="button-signin"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing In...
                  </>
                ) : (
                  'Sign In'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center space-y-4">
              <div className="flex items-center justify-center gap-6 flex-wrap text-sm">
                <Link href="/forgot-password" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                  Forgot Password?
                </Link>
                <Link href="/help" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                  Get Help
                </Link>
                <Link href="/join" className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                  Get your account
                </Link>
              </div>

              <div className="text-center mt-4 space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  First time? We’ll give you your passcode (Associate ID) and you can set up 2FA.{' '}
                  <Link href="/join" className="text-blue-600 hover:underline font-medium">
                    Get your account
                  </Link>
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Forgot your passcode?{' '}
                  <Link href="/forgot-passcode" className="text-blue-600 hover:underline font-medium">
                    Look it up
                  </Link>
                </p>
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-700">
                  <p className="text-lg font-bold text-center mb-2">
                    <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent" style={{ 
                      WebkitBackgroundClip: 'text', 
                      WebkitTextFillColor: 'transparent', 
                      backgroundClip: 'text',
                      display: 'inline-block'
                    }}>
                      HOW CAN I HELP?
                    </span>
                  </p>
                  <Button
                    type="button"
                    onClick={() => setShowAlexChat(!showAlexChat)}
                    className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white font-semibold py-3"
                  >
                    {showAlexChat ? 'Hide' : 'Click Here for'} Support!
                  </Button>
                </div>
                
              {showAlexChat && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]" onClick={() => setShowAlexChat(false)}>
                  <div className="w-[500px]" onClick={(e) => e.stopPropagation()}>
                    <AlexAILoginSupport />
                  </div>
                </div>
              )}
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Need technical help? Contact your system administrator
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}