import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, Lock, Eye, EyeOff } from 'lucide-react';
import { Link, useLocation } from 'wouter';

export function ResetPasswordPage() {
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [tokens, setTokens] = useState<{ accessToken: string; refreshToken: string } | null>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Extract tokens from URL hash when page loads
    const hash = window.location.hash;
    if (hash) {
      const params = new URLSearchParams(hash.substring(1));
      const accessToken = params.get('access_token');
      const refreshToken = params.get('refresh_token');
      const type = params.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        setTokens({ accessToken, refreshToken });
        console.log('✅ Reset tokens extracted from URL');
      } else {
        console.error('❌ Invalid reset link - missing or invalid tokens');
        toast({
          title: 'Invalid Reset Link',
          description: 'This reset link is invalid or has expired. Please request a new one.',
          variant: 'destructive'
        });
      }
    } else {
      console.error('❌ No tokens found in URL');
      toast({
        title: 'Invalid Reset Link', 
        description: 'This reset link is invalid or has expired. Please request a new one.',
        variant: 'destructive'
      });
    }
  }, [toast]);

  const validatePassword = (password: string) => {
    const minLength = password.length >= 8;
    const hasNumber = /\d/.test(password);
    const hasLetter = /[a-zA-Z]/.test(password);
    
    return {
      isValid: minLength && hasNumber && hasLetter,
      errors: [
        !minLength && 'At least 8 characters',
        !hasNumber && 'At least one number',
        !hasLetter && 'At least one letter'
      ].filter(Boolean)
    };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!tokens) {
      toast({
        title: 'Error',
        description: 'Invalid reset link. Please request a new password reset.',
        variant: 'destructive'
      });
      return;
    }

    if (!newPassword || !confirmPassword) {
      toast({
        title: 'Error',
        description: 'Please fill in both password fields',
        variant: 'destructive'
      });
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast({
        title: 'Invalid Password',
        description: `Password must have: ${passwordValidation.errors.join(', ')}`,
        variant: 'destructive'
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Passwords do not match',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      console.log('🔄 Resetting password with tokens...');
      
      const response = await fetch('/api/auth/reset-password-with-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          newPassword
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      console.log('✅ Password reset successful');
      
      setIsSuccess(true);
      toast({
        title: 'Success',
        description: 'Password updated successfully! You can now sign in with your new password.'
      });

      // Redirect to login after a delay
      setTimeout(() => {
        setLocation('/login');
      }, 3000);

    } catch (error) {
      console.error('Reset password error:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to reset password. Please try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const passwordValidation = validatePassword(newPassword);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
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
              Reset Your Password
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!isSuccess ? (
              <>
                <p className="text-center text-slate-600 dark:text-slate-400 mb-6">
                  Enter your new password below.
                </p>
                
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="newPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="newPassword"
                        type={showPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Enter new password"
                        disabled={isLoading}
                        className="w-full pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        disabled={isLoading}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                    {newPassword && (
                      <div className="text-xs mt-1">
                        <div className={`${passwordValidation.isValid ? 'text-green-600' : 'text-red-500'}`}>
                          Password strength: {passwordValidation.isValid ? 'Good' : 'Weak'}
                        </div>
                        {!passwordValidation.isValid && passwordValidation.errors.length > 0 && (
                          <div className="text-red-500">
                            Missing: {passwordValidation.errors.join(', ')}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Confirm New Password
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="Confirm new password"
                        disabled={isLoading}
                        className="w-full pr-10"
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        disabled={isLoading}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 text-gray-400" />
                        ) : (
                          <Eye className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                    </div>
                    {confirmPassword && newPassword !== confirmPassword && (
                      <div className="text-xs text-red-500 mt-1">
                        Passwords do not match
                      </div>
                    )}
                  </div>

                  <Button
                    type="submit"
                    className="w-full py-2 text-base font-medium"
                    disabled={isLoading || !tokens}
                    data-testid="button-reset-password"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Updating Password...
                      </>
                    ) : (
                      <>
                        <Lock className="mr-2 h-4 w-4" />
                        Reset Password
                      </>
                    )}
                  </Button>
                </form>
              </>
            ) : (
              <div className="text-center space-y-4">
                <div className="flex items-center justify-center mb-4">
                  <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                    <Lock className="h-8 w-8 text-green-600 dark:text-green-400" />
                  </div>
                </div>
                
                <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">
                  Password Updated Successfully
                </h3>
                
                <p className="text-slate-600 dark:text-slate-400">
                  Your password has been updated. You will be redirected to the sign-in page shortly.
                </p>
                
                <Link href="/login">
                  <Button className="w-full">
                    Sign In Now
                  </Button>
                </Link>
              </div>
            )}

            <div className="mt-6 text-center space-y-4">
              <div className="flex items-center justify-center">
                <Link href="/login">
                  <button className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Sign In
                  </button>
                </Link>
              </div>
              
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Need help? Contact your system administrator
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}