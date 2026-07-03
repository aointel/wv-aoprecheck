import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertCircle, Download } from "lucide-react";

interface UpdateRequiredProps {
  currentVersion?: string;
  minimumVersion?: string;
  downloadUrl?: string;
}

export default function UpdateRequired({ 
  currentVersion = "Unknown", 
  minimumVersion = "1.0.3",
  downloadUrl = "https://github.com/aointel/AOIrail/releases/latest"
}: UpdateRequiredProps) {
  
  const handleDownload = () => {
    window.open(downloadUrl, '_blank');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <Card className="max-w-2xl w-full shadow-2xl">
        <CardHeader className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 bg-orange-100 dark:bg-orange-900 rounded-full flex items-center justify-center">
            <AlertCircle className="w-10 h-10 text-orange-600 dark:text-orange-400" />
          </div>
          <CardTitle className="text-3xl font-bold">Update Required</CardTitle>
          <CardDescription className="text-lg">
            A new version of AO Intelligence is available and must be installed to continue
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-6 space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Your Version:</span>
              <span className="text-lg font-bold text-red-600 dark:text-red-400">{currentVersion}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">Required Version:</span>
              <span className="text-lg font-bold text-green-600 dark:text-green-400">{minimumVersion}</span>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="font-semibold text-lg">What's New in v{minimumVersion}:</h3>
            <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>HP Pro page scraping and content extraction</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Auto-capture presentation data (client info, premiums, milestones)</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>AI-powered presentation analysis</span>
              </li>
              <li className="flex items-start">
                <span className="text-green-500 mr-2">✓</span>
                <span>Performance improvements and bug fixes</span>
              </li>
            </ul>
          </div>

          <div className="pt-4">
            <Button 
              onClick={handleDownload}
              className="w-full py-6 text-lg font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700"
              size="lg"
            >
              <Download className="w-5 h-5 mr-2" />
              Download Update Now
            </Button>
          </div>

          <p className="text-xs text-center text-gray-500 dark:text-gray-400">
            The application will close after you click the download button. Please install the update and reopen AO Intelligence.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

