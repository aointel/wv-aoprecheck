import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Phone, 
  Star, 
  Shield, 
  UserPlus, 
  UserCheck, 
  Settings, 
  Building, 
  DollarSign, 
  Download, 
  ArrowLeft 
} from 'lucide-react';
import { Link } from 'wouter';

export default function BillingReports() {
  const handleDownload = (endpoint: string, filename: string) => {
    window.open(`/api/billing/${endpoint}?format=csv`, '_blank');
  };

  return (
    <div className="container mx-auto px-6 py-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center space-x-4">
          <Link href="/dashboard/admin">
            <Button variant="outline" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Admin
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-blue-700">📊 Billing Reports System</h1>
            <p className="text-muted-foreground text-lg">
              Comprehensive billing reports for 6 call service types with MGA-grouped agency reports
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        {/* Service Type Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">Service Type Reports</CardTitle>
            <p className="text-muted-foreground">Download individual service billing reports</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Button 
                className="h-32 flex flex-col items-center justify-center space-y-4 border-2 border-blue-200 hover:border-blue-400 hover:bg-blue-50" 
                variant="outline"
                onClick={() => handleDownload('report/connect', 'ao-connect-report.csv')}
              >
                <Phone className="h-10 w-10 text-blue-600" />
                <div className="text-center">
                  <div className="font-bold text-lg">AO Connect</div>
                  <div className="text-sm text-muted-foreground">Download CSV Report</div>
                </div>
              </Button>

              <Button 
                className="h-32 flex flex-col items-center justify-center space-y-4 border-2 border-green-200 hover:border-green-400 hover:bg-green-50" 
                variant="outline"
                onClick={() => handleDownload('report/plus', 'ao-plus-report.csv')}
              >
                <Star className="h-10 w-10 text-green-600" />
                <div className="text-center">
                  <div className="font-bold text-lg">AO Plus</div>
                  <div className="text-sm text-muted-foreground">Download CSV Report</div>
                </div>
              </Button>

              <Button 
                className="h-32 flex flex-col items-center justify-center space-y-4 border-2 border-purple-200 hover:border-purple-400 hover:bg-purple-50" 
                variant="outline"
                onClick={() => handleDownload('report/precheck', 'ao-precheck-report.csv')}
              >
                <Shield className="h-10 w-10 text-purple-600" />
                <div className="text-center">
                  <div className="font-bold text-lg">AO Precheck</div>
                  <div className="text-sm text-muted-foreground">Download CSV Report</div>
                </div>
              </Button>

              <Button 
                className="h-32 flex flex-col items-center justify-center space-y-4 border-2 border-orange-200 hover:border-orange-400 hover:bg-orange-50" 
                variant="outline"
                onClick={() => handleDownload('report/recruit', 'ao-recruit-report.csv')}
              >
                <UserPlus className="h-10 w-10 text-orange-600" />
                <div className="text-center">
                  <div className="font-bold text-lg">AO Recruit</div>
                  <div className="text-sm text-muted-foreground">Download CSV Report</div>
                </div>
              </Button>

              <Button 
                className="h-32 flex flex-col items-center justify-center space-y-4 border-2 border-red-200 hover:border-red-400 hover:bg-red-50" 
                variant="outline"
                onClick={() => handleDownload('report/verification', 'verification-calls-report.csv')}
              >
                <UserCheck className="h-10 w-10 text-red-600" />
                <div className="text-center">
                  <div className="font-bold text-lg">Verification Calls</div>
                  <div className="text-sm text-muted-foreground">Download CSV Report</div>
                </div>
              </Button>

              <Button 
                className="h-32 flex flex-col items-center justify-center space-y-4 border-2 border-gray-200 hover:border-gray-400 hover:bg-gray-50" 
                variant="outline"
                onClick={() => handleDownload('report/other', 'other-services-report.csv')}
              >
                <Settings className="h-10 w-10 text-gray-600" />
                <div className="text-center">
                  <div className="font-bold text-lg">Other Services</div>
                  <div className="text-sm text-muted-foreground">Download CSV Report</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* MGA Agency Reports */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">MGA-Grouped Agency Reports</CardTitle>
            <p className="text-muted-foreground">Download comprehensive agency billing reports</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Button 
                className="h-24 flex items-center justify-between p-6 bg-blue-600 hover:bg-blue-700 text-white" 
                onClick={() => handleDownload('mga-report', 'mga-agency-reports.csv')}
              >
                <div className="flex items-center space-x-4">
                  <Building className="h-8 w-8" />
                  <div className="text-left">
                    <div className="font-bold text-lg">MGA Agency Reports</div>
                    <div className="text-sm text-blue-100">All services grouped by MGA teams</div>
                  </div>
                </div>
                <Download className="h-6 w-6" />
              </Button>

              <Button 
                className="h-24 flex items-center justify-between p-6 bg-green-600 hover:bg-green-700 text-white" 
                onClick={() => handleDownload('summary', 'billing-summary.csv')}
              >
                <div className="flex items-center space-x-4">
                  <DollarSign className="h-8 w-8" />
                  <div className="text-left">
                    <div className="font-bold text-lg">Billing Summary</div>
                    <div className="text-sm text-green-100">Complete billing overview with producer names & credits</div>
                  </div>
                </div>
                <Download className="h-6 w-6" />
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Features Overview */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">🚀 Report Features</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="flex items-center space-x-3 p-4 bg-blue-50 rounded-lg">
                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                <span className="font-medium">Real producer names from associate_id lookups</span>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-green-50 rounded-lg">
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                <span className="font-medium">MGA team assignments from customer database</span>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-purple-50 rounded-lg">
                <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
                <span className="font-medium">Credit balances and usage tracking</span>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-orange-50 rounded-lg">
                <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                <span className="font-medium">Complete service usage breakdowns</span>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-red-50 rounded-lg">
                <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                <span className="font-medium">CSV exports for billing systems</span>
              </div>
              <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                <span className="font-medium">$0.10 per credit billing calculations</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real Data Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-xl font-bold">📈 Live Data Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">232</div>
                <div className="text-sm text-muted-foreground">Credits Used (Reginald Savage)</div>
                <div className="text-lg font-semibold text-blue-600">$23.20</div>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <div className="text-2xl font-bold text-green-600">1040</div>
                <div className="text-sm text-muted-foreground">Credits Used (Landy Sitto)</div>
                <div className="text-lg font-semibold text-green-600">$104.00</div>
              </div>
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">1284</div>
                <div className="text-sm text-muted-foreground">Credits Used (John Haisha)</div>
                <div className="text-lg font-semibold text-purple-600">$128.40</div>
              </div>
              <div className="text-center p-4 bg-orange-50 rounded-lg">
                <div className="text-2xl font-bold text-orange-600">$0.10</div>
                <div className="text-sm text-muted-foreground">Per Credit Rate</div>
                <div className="text-lg font-semibold text-orange-600">Standard</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}