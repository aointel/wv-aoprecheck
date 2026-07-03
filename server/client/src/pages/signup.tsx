import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { Card, CardContent, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowLeft, User, Mail, MapPin, Target, Phone, Users, Shield } from 'lucide-react';
import { Link } from 'wouter';

export function SignupPage() {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    primaryMarket: '',
    secondaryMarket: '',
    aoiModules: [] as string[]
  });
  const [isLoading, setIsLoading] = useState(false);
  const { signup } = useAuth();
  const { toast } = useToast();

  const primaryMarkets = [
    'Veteran',
    'Globe Market', 
    'Will Kit',
    'NA'
  ];

  const secondaryMarkets = [
    'Will Kit',
    'None'
  ];

  const aoiModules = [
    { id: 'connect', name: 'Connect', icon: Phone, description: 'Outbound calling and lead management' },
    { id: 'recruit', name: 'Recruit', icon: Users, description: 'Agent recruitment and onboarding' },
    { id: 'precheck', name: 'PreCheck', description: 'Sale verification and compliance', icon: Shield }
  ];

  const handleModuleToggle = (moduleId: string) => {
    setFormData(prev => ({
      ...prev,
      aoiModules: prev.aoiModules.includes(moduleId)
        ? prev.aoiModules.filter(id => id !== moduleId)
        : [...prev.aoiModules, moduleId]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.firstName || !formData.lastName || !formData.email || !formData.password || !formData.primaryMarket || formData.aoiModules.length === 0) {
      toast({
        title: 'Error',
        description: 'Please fill in all required fields and select at least one AO Intelligence module',
        variant: 'destructive'
      });
      return;
    }

    if (!formData.email.includes('@aoglobelife.com')) {
      toast({
        title: 'Error',
        description: 'Please use your @aoglobelife.com email address',
        variant: 'destructive'
      });
      return;
    }

    if (formData.password.length < 8) {
      toast({
        title: 'Error',
        description: 'Password must be at least 8 characters long',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      // Enhanced signup with market data and module selection
      await signup(
        formData.email, 
        formData.password, 
        formData.firstName, 
        formData.lastName,
        formData.primaryMarket,
        formData.secondaryMarket === 'None' ? '' : formData.secondaryMarket,
        false // aoiRecruitOptIn - keeping as false since we removed the section
      );
      
      toast({
        title: 'Success',
        description: 'Account created successfully! Please sign in.',
        duration: 3000
      });
      
      // Redirect to login after short delay
      setTimeout(() => {
        window.location.href = '/login';
      }, 1500);
      
    } catch (error) {
      console.error('Signup error:', error);
      toast({
        title: 'Signup Failed',
        description: error instanceof Error ? error.message : 'Failed to create account',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
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

        <Card className="shadow-xl border-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-sm overflow-hidden">
          {/* Gradient Header */}
          <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 p-6 text-white">
            <CardTitle className="text-center text-2xl font-bold">
              Sign Up
            </CardTitle>
            <p className="text-center text-blue-100 mt-2">
              Enter your @aoglobelife.com email and choose a password to get started
            </p>
          </div>

          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Personal Information Section */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center mb-4">
                  <User className="w-5 h-5 text-purple-600 mr-2" />
                  <h3 className="font-semibold text-purple-800 dark:text-purple-200">Personal Information</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      First Name
                    </Label>
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="First Name"
                      disabled={isLoading}
                      required
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Last Name
                    </Label>
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Last Name"
                      disabled={isLoading}
                      required
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Account Information Section */}
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-700">
                <div className="flex items-center mb-4">
                  <Mail className="w-5 h-5 text-green-600 mr-2" />
                  <h3 className="font-semibold text-green-800 dark:text-green-200">Account Information</h3>
                </div>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Email
                    </Label>
                    <p className="text-xs text-green-600 dark:text-green-400 mb-1">
                      (Please use your @aoglobelife.com email address)
                    </p>
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="name@example.com"
                      disabled={isLoading}
                      required
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                      placeholder="Password"
                      disabled={isLoading}
                      required
                      className="bg-white dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>

              {/* Market Selection Section */}
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-700">
                <div className="flex items-center mb-4">
                  <MapPin className="w-5 h-5 text-blue-600 mr-2" />
                  <h3 className="font-semibold text-blue-800 dark:text-blue-200">Market Assignment</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="primaryMarket" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Primary Market
                    </Label>
                    <Select value={formData.primaryMarket} onValueChange={(value) => setFormData(prev => ({ ...prev, primaryMarket: value }))}>
                      <SelectTrigger className="bg-white dark:bg-slate-800">
                        <SelectValue placeholder="Select Primary Market" />
                      </SelectTrigger>
                      <SelectContent>
                        {primaryMarkets.map((market) => (
                          <SelectItem key={market} value={market}>
                            {market}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="secondaryMarket" className="text-sm font-medium text-slate-700 dark:text-slate-300">
                      Secondary Market
                    </Label>
                    <Select value={formData.secondaryMarket} onValueChange={(value) => setFormData(prev => ({ ...prev, secondaryMarket: value }))}>
                      <SelectTrigger className="bg-white dark:bg-slate-800">
                        <SelectValue placeholder="Select Secondary Market" />
                      </SelectTrigger>
                      <SelectContent>
                        {secondaryMarkets.map((market) => (
                          <SelectItem key={market} value={market}>
                            {market}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* AO Intelligence Module Selection */}
              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-700">
                <div className="flex items-center mb-4">
                  <Target className="w-5 h-5 text-purple-600 mr-2" />
                  <h3 className="font-semibold text-purple-800 dark:text-purple-200">AO Intelligence Module Access</h3>
                </div>
                <p className="text-sm text-purple-700 dark:text-purple-300 mb-4">
                  Select which AO Intelligence modules you need access to (at least one required):
                </p>
                <div className="grid grid-cols-1 gap-3">
                  {aoiModules.map((module) => {
                    const IconComponent = module.icon;
                    const isSelected = formData.aoiModules.includes(module.id);
                    return (
                      <div
                        key={module.id}
                        onClick={() => handleModuleToggle(module.id)}
                        className={`p-4 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-100 dark:bg-purple-900/40'
                            : 'border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500'
                        }`}
                      >
                        <div className="flex items-center space-x-3">
                          <div className={`p-2 rounded-md ${
                            isSelected 
                              ? 'bg-purple-500 text-white' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                          }`}>
                            <IconComponent className="w-5 h-5" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <h4 className={`font-medium ${
                                isSelected 
                                  ? 'text-purple-800 dark:text-purple-200' 
                                  : 'text-gray-700 dark:text-gray-300'
                              }`}>
                                {module.name}
                              </h4>
                              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                                isSelected
                                  ? 'border-purple-500 bg-purple-500'
                                  : 'border-gray-300 dark:border-gray-600'
                              }`}>
                                {isSelected && (
                                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </div>
                            </div>
                            <p className={`text-sm mt-1 ${
                              isSelected 
                                ? 'text-purple-600 dark:text-purple-300' 
                                : 'text-gray-500 dark:text-gray-400'
                            }`}>
                              {module.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>



              <Button
                type="submit"
                className="w-full py-3 text-base font-medium bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating Account...
                  </>
                ) : (
                  'Sign Up'
                )}
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Already have an account?{' '}
                <Link href="/login">
                  <button 
                    type="button"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
                  >
                    Sign in
                  </button>
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center">
          <Link href="/">
            <Button variant="ghost" className="text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}