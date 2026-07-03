import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { HelpCircle } from 'lucide-react';
import { HelpModal } from '@/components/training/HelpModal';

export default function AlexAILoginSupport() {
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [showHelpModal, setShowHelpModal] = useState(false);

  const actions = [
    { id: 'reset_password', label: 'Reset Password', icon: '🔑' },
    { id: 'login_issue', label: 'Login Issue', icon: '🚪' },
    { id: 'something_else', label: 'Something Else', icon: '💬' }
  ];

  const handleActionClick = (actionId: string) => {
    if (actionId === 'something_else') {
      setShowHelpModal(true);
      return;
    }
    setSelectedAction(actionId);
  };

  const renderActionContent = () => {
    switch (selectedAction) {
      case 'reset_password':
        return (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-blue-600">🔑 Password Reset</h3>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Follow these steps:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Click <strong>"Forgot Password?"</strong> link below the login form</li>
                <li>Enter your <strong>@aoglobelife.com</strong> email</li>
                <li>Check your email for the reset link</li>
                <li>Create a new password</li>
              </ol>
              <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
                <p className="text-xs font-semibold text-yellow-800">⚠️ Make sure you're using your company email (@aoglobelife.com)!</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs font-semibold text-blue-800">📧 Still having trouble?</p>
                <p className="text-xs text-blue-700">Email: cnsysop@aoglobelife.com</p>
              </div>
            </div>
            <Button 
              onClick={() => setSelectedAction(null)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Back to Options
            </Button>
          </div>
        );

      case 'login_issue':
        return (
          <div className="p-6 space-y-4">
            <h3 className="text-lg font-bold text-blue-600">🚪 Login Issues</h3>
            <div className="space-y-3 text-sm">
              <p className="font-semibold">Try these solutions first:</p>
              <ol className="list-decimal list-inside space-y-2">
                <li>Make sure you're using your <strong>@aoglobelife.com</strong> email</li>
                <li>Check if <strong>Caps Lock</strong> is on</li>
                <li>Clear browser cache (<kbd>Ctrl+Shift+Delete</kbd>)</li>
                <li>Try a different browser (Chrome or Edge)</li>
              </ol>
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-xs font-semibold text-green-800">🔑 Forgot password?</p>
                <p className="text-xs text-green-700">Click "Forgot Password?" below the login form</p>
              </div>
              <div className="p-3 bg-purple-50 border border-purple-200 rounded">
                <p className="text-xs font-semibold text-purple-800">📝 Don't have an account?</p>
                <p className="text-xs text-purple-700">Use &quot;Get your account&quot; on the login page if you do not have a login yet</p>
              </div>
              <div className="p-3 bg-blue-50 border border-blue-200 rounded">
                <p className="text-xs font-semibold text-blue-800">📧 Need more help?</p>
                <p className="text-xs text-blue-700">Email: cnsysop@aoglobelife.com</p>
              </div>
            </div>
            <Button 
              onClick={() => setSelectedAction(null)}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Back to Options
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="w-full h-[500px] bg-white border border-gray-200 rounded-lg shadow-xl flex flex-col">
      <CardHeader className="bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-lg p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5" />
            <CardTitle className="text-sm">Login & Access Help</CardTitle>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 flex-1 flex flex-col">
        {/* Action Buttons or Content */}
        {!selectedAction ? (
          <div className="p-4 space-y-3">
            <p className="text-sm text-gray-600 mb-4">Select the type of help you need:</p>
            {actions.map(action => (
              <Button
                key={action.id}
                onClick={() => handleActionClick(action.id)}
                className="w-full justify-start text-left h-auto py-4 bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white"
              >
                <span className="text-2xl mr-3">{action.icon}</span>
                <span className="text-base font-semibold">{action.label}</span>
              </Button>
            ))}
          </div>
        ) : (
          renderActionContent()
        )}
      </CardContent>
      
      {/* Help Modal for "Something Else" */}
      <HelpModal 
        isOpen={showHelpModal} 
        onClose={() => setShowHelpModal(false)}
      />
    </Card>
  );
}

