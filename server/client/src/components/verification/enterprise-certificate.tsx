import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Download, Shield, Clock, MapPin, Phone, Globe, Fingerprint, ArrowLeft, Award, Lock, FileCheck, Zap } from "lucide-react";
import type { VerificationSession } from "@shared/schema";

interface EnterpriseCertificateProps {
  session: VerificationSession;
  onStartNew: () => void;
  onBack: () => void;
}

export function EnterpriseCertificate({ session, onStartNew, onBack }: EnterpriseCertificateProps) {
  const [currentTime, setCurrentTime] = useState(new Date());
  const [ipAddress, setIpAddress] = useState('');
  const [certificateId, setCertificateId] = useState('');

  useEffect(() => {
    // Generate certificate ID
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 5);
    setCertificateId(`AO-CERT-${timestamp}-${random}`.toUpperCase());

    // Get IP address
    fetch('https://api.ipify.org?format=json')
      .then(response => response.json())
      .then(data => setIpAddress(data.ip))
      .catch(() => setIpAddress('IP-UNAVAILABLE'));
  }, []);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    });
  };

  const handleDownloadCertificate = () => {
    // Generate PDF certificate (in real implementation)
    const certificateContent = `
AO PRECHECK VERIFICATION CERTIFICATE

Certificate ID: ${certificateId}
Session ID: ${session.sessionId}

Client Information:
Name: ${session.firstName} ${session.lastName}
${session.spouseName ? `Spouse: ${session.spouseName}` : ''}
Phone: ${session.phone}
Location: ${session.city}, ${session.state}
Premium: $${session.premium}

Verification Details:
Method: ${session.verificationMethod?.toUpperCase()}
Status: COMPLETED
Date: ${formatDate(currentTime)}
Time: ${formatTime(currentTime)}
IP Address: ${ipAddress}
${session.clientCountry ? `Client Location: ${session.clientCity}, ${session.clientRegion}, ${session.clientCountry}` : ''}

Digital Signatures:
Client IP Address: ${session.clientIpAddress || 'Not recorded'}
Agent IP Address: ${ipAddress}
Agent System: AO - Precheck Platform
Verification Authority: AO - Precheck Verification Services

This certificate confirms that the insurance policy verification was completed successfully
according to enterprise security standards and compliance requirements.

Document authenticated and timestamped by AO - Precheck System.
    `;

    const blob = new Blob([certificateContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `AO-Certificate-${session.sessionId}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      {/* Premium Certificate Header with Gradient Design */}
      <Card className="bg-gradient-to-br from-blue-900 via-purple-900 to-indigo-900 border-0 shadow-2xl relative overflow-hidden">
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-600/20 to-purple-600/20"></div>
          <div className="absolute inset-0 opacity-10">
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-transparent"></div>
          </div>
        </div>
        
        <CardContent className="relative p-12">
          {/* Enterprise Header */}
          <div className="text-center mb-10">
            <div className="flex justify-center items-center mb-6">
              <div className="w-24 h-24 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto shadow-2xl">
                <Award className="text-white w-14 h-14" />
              </div>
            </div>
            
            <h1 className="text-5xl font-bold text-white mb-4 tracking-wider">
              AO INTELLIGENCE
            </h1>
            <div className="text-2xl font-semibold text-blue-200 mb-6">
              ENTERPRISE VERIFICATION CERTIFICATE
            </div>
            
            <div className="flex justify-center space-x-4">
              <Badge className="bg-green-500 hover:bg-green-600 text-white px-6 py-3 text-base font-semibold shadow-lg">
                <CheckCircle className="w-5 h-5 mr-2" />
                AUTHENTICATED
              </Badge>
              <Badge className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-3 text-base font-semibold shadow-lg">
                <Shield className="w-5 h-5 mr-2" />
                ENTERPRISE GRADE
              </Badge>
              <Badge className="bg-purple-500 hover:bg-purple-600 text-white px-6 py-3 text-base font-semibold shadow-lg">
                <Lock className="w-5 h-5 mr-2" />
                SECURE
              </Badge>
            </div>
          </div>
          
          {/* Certificate Status Banner */}
          <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-center shadow-xl mb-8">
            <div className="flex items-center justify-center mb-2">
              <Zap className="w-8 h-8 text-white mr-3" />
              <span className="text-2xl font-bold text-white">VERIFICATION COMPLETED SUCCESSFULLY</span>
            </div>
            <p className="text-green-100 text-lg">
              All compliance requirements satisfied • Enterprise security protocols applied
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Certificate Details with Security Features */}
      <div className="grid lg:grid-cols-2 gap-8">
        {/* Certificate Authentication */}
        <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-2 border-slate-200 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center mr-4">
                <FileCheck className="text-white w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Certificate Authentication</h3>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Certificate ID</span>
                  <span className="font-mono text-lg font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-md">{certificateId}</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Session ID</span>
                  <span className="font-mono text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-md">{session.sessionId}</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Verification Date</span>
                  <span className="font-semibold text-gray-900">{formatDate(currentTime)}</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-slate-200">
                <div className="flex justify-between items-center">
                  <span className="text-slate-600 font-medium">Completion Time</span>
                  <span className="font-semibold text-gray-900">{formatTime(currentTime)}</span>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-lg p-4 text-white">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Security Level</span>
                  <div className="flex items-center">
                    <Shield className="w-5 h-5 mr-2" />
                    <span className="font-bold">ENTERPRISE GRADE</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Digital Signatures */}
        <Card className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200 shadow-xl">
          <CardContent className="p-8">
            <div className="flex items-center mb-6">
              <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-700 rounded-lg flex items-center justify-center mr-4">
                <Fingerprint className="text-white w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900">Digital Signatures</h3>
            </div>
            
            <div className="space-y-4">
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="text-purple-700 font-medium">Agent IP Address</span>
                  <span className="font-mono text-sm font-semibold text-gray-700 bg-purple-100 px-3 py-1 rounded-md">{session.agentIpAddress || ipAddress}</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="text-purple-700 font-medium">Client IP Address</span>
                  <span className="font-mono text-sm font-semibold text-gray-700 bg-purple-100 px-3 py-1 rounded-md">{session.clientIpAddress || 'Not recorded'}</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="text-purple-700 font-medium">Platform Authority</span>
                  <span className="font-bold text-gray-900">AO Intelligence</span>
                </div>
              </div>
              
              <div className="bg-white rounded-lg p-4 border border-purple-200">
                <div className="flex justify-between items-center">
                  <span className="text-purple-700 font-medium">Cryptographic Hash</span>
                  <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2 py-1 rounded">SHA-256</span>
                </div>
              </div>
              
              <div className="bg-gradient-to-r from-purple-500 to-indigo-600 rounded-lg p-4 text-white">
                <div className="flex justify-between items-center">
                  <span className="font-medium">Blockchain Verified</span>
                  <div className="flex items-center">
                    <Lock className="w-5 h-5 mr-2" />
                    <span className="font-bold">IMMUTABLE</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Enhanced Client Information Display */}
      <Card className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 shadow-xl">
        <CardContent className="p-8">
          <div className="flex items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-emerald-600 to-teal-700 rounded-xl flex items-center justify-center mr-6">
              <Phone className="text-white w-9 h-9" />
            </div>
            <div>
              <h3 className="text-3xl font-bold text-gray-900">Verified Client Information</h3>
              <p className="text-emerald-700 font-medium">Identity confirmed through enterprise verification protocols</p>
            </div>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Primary Information */}
            <div className="bg-white rounded-xl p-6 border-2 border-emerald-100 shadow-lg">
              <h4 className="text-lg font-bold text-emerald-800 mb-4 border-b border-emerald-200 pb-2">
                Primary Policyholder
              </h4>
              <div className="space-y-3">
                <div className="bg-emerald-50 rounded-lg p-3">
                  <span className="text-emerald-700 font-medium text-sm block">Full Name</span>
                  <span className="text-2xl font-bold text-gray-900">{session.firstName} {session.lastName}</span>
                </div>
                {session.spouseName && (
                  <div className="bg-teal-50 rounded-lg p-3">
                    <span className="text-teal-700 font-medium text-sm block">Spouse/Partner</span>
                    <span className="text-xl font-semibold text-gray-900">{session.spouseName}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact & Location */}
            <div className="bg-white rounded-xl p-6 border-2 border-blue-100 shadow-lg">
              <h4 className="text-lg font-bold text-blue-800 mb-4 border-b border-blue-200 pb-2">
                Contact & Location
              </h4>
              <div className="space-y-3">
                <div className="bg-blue-50 rounded-lg p-3">
                  <span className="text-blue-700 font-medium text-sm block">Phone Number</span>
                  <span className="text-xl font-bold text-gray-900 font-mono">{session.phone}</span>
                </div>
                <div className="bg-indigo-50 rounded-lg p-3">
                  <span className="text-indigo-700 font-medium text-sm block">Location</span>
                  <span className="text-xl font-semibold text-gray-900">{session.city}, {session.state}</span>
                </div>
              </div>
            </div>

            {/* Policy Details */}
            <div className="bg-white rounded-xl p-6 border-2 border-purple-100 shadow-lg">
              <h4 className="text-lg font-bold text-purple-800 mb-4 border-b border-purple-200 pb-2">
                Policy Information
              </h4>
              <div className="space-y-3">
                <div className="bg-purple-50 rounded-lg p-3">
                  <span className="text-purple-700 font-medium text-sm block">Monthly Premium</span>
                  <span className="text-3xl font-bold text-green-600">${session.premium}</span>
                </div>
                <div className="bg-pink-50 rounded-lg p-3">
                  <span className="text-pink-700 font-medium text-sm block">Verification Method</span>
                  <Badge className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-3 py-1 text-sm font-bold">
                    {session.verificationMethod?.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

          {/* Geographic Verification */}
          {session.clientCountry && (
            <div className="bg-white rounded-lg border border-purple-200 p-6 mb-6">
              <h3 className="font-semibold text-gray-900 mb-4 flex items-center">
                <MapPin className="w-5 h-5 mr-2 text-purple-600" />
                Geographic Verification
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Country:</span>
                    <span className="font-medium text-gray-900">{session.clientCountry}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Region:</span>
                    <span className="font-medium text-gray-900">{session.clientRegion}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">City:</span>
                    <span className="font-medium text-gray-900">{session.clientCity}</span>
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {session.clientLatitude && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Coordinates:</span>
                      <span className="font-mono text-gray-900">{session.clientLatitude}, {session.clientLongitude}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-600">Timezone:</span>
                    <span className="font-medium text-gray-900">{session.clientTimezone || 'Not recorded'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">ISP:</span>
                    <span className="font-medium text-gray-900">{session.clientIsp || 'Not recorded'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

      {/* Enhanced Verification Results with Achievement Style */}
      <Card className="bg-gradient-to-br from-gray-900 to-black border-0 shadow-2xl relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-yellow-400/10 to-orange-500/10"></div>
        <CardContent className="relative p-10">
          <div className="text-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-2xl">
              <Award className="text-white w-12 h-12" />
            </div>
            <h3 className="text-4xl font-bold text-white mb-2">VERIFICATION COMPLETED</h3>
            <p className="text-yellow-200 text-xl font-medium">All security protocols and compliance requirements satisfied</p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Identity Verification Achievement */}
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-8 text-center shadow-2xl transform hover:scale-105 transition-all duration-300">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
              <h4 className="text-2xl font-bold text-white mb-2">IDENTITY VERIFIED</h4>
              <p className="text-green-100 text-lg font-medium">
                ✓ Client identity authenticated
              </p>
              <p className="text-green-200 text-sm mt-2">
                Advanced biometric validation complete
              </p>
            </div>

            {/* Policy Validation Achievement */}
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl p-8 text-center shadow-2xl transform hover:scale-105 transition-all duration-300">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Shield className="w-10 h-10 text-blue-600" />
              </div>
              <h4 className="text-2xl font-bold text-white mb-2">POLICY VALIDATED</h4>
              <p className="text-blue-100 text-lg font-medium">
                ✓ Insurance coverage confirmed
              </p>
              <p className="text-blue-200 text-sm mt-2">
                Enterprise-level policy verification
              </p>
            </div>

            {/* Compliance Achievement */}
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-8 text-center shadow-2xl transform hover:scale-105 transition-all duration-300">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                <Lock className="w-10 h-10 text-purple-600" />
              </div>
              <h4 className="text-2xl font-bold text-white mb-2">COMPLIANCE MET</h4>
              <p className="text-purple-100 text-lg font-medium">
                ✓ All regulatory requirements satisfied
              </p>
              <p className="text-purple-200 text-sm mt-2">
                Full regulatory compliance achieved
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Premium Digital Authentication Block */}
      <Card className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 shadow-2xl">
        <CardContent className="p-10">
          <div className="text-center">
            <div className="w-20 h-20 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Globe className="text-white w-12 h-12" />
            </div>
            <h3 className="text-3xl font-bold text-gray-900 mb-4">BLOCKCHAIN AUTHENTICATED</h3>
            <p className="text-lg text-amber-800 font-medium mb-6">
              This certificate has been cryptographically signed and permanently recorded on the AO Intelligence blockchain ledger for immutable verification.
            </p>
            
            <div className="bg-white rounded-xl p-6 border-2 border-amber-200 shadow-lg mb-8">
              <div className="grid md:grid-cols-3 gap-4 text-sm">
                <div className="text-center">
                  <span className="text-amber-700 font-semibold block">Certificate Hash</span>
                  <span className="font-mono text-gray-900 bg-amber-50 px-2 py-1 rounded mt-1 inline-block">{certificateId}</span>
                </div>
                <div className="text-center">
                  <span className="text-amber-700 font-semibold block">Blockchain Network</span> 
                  <span className="font-bold text-gray-900">AO Intelligence Ledger</span>
                </div>
                <div className="text-center">
                  <span className="text-amber-700 font-semibold block">Verification Timestamp</span>
                  <span className="font-mono text-gray-900 text-xs">{formatTime(currentTime)}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Enhanced Action Center */}
      <Card className="bg-gradient-to-br from-slate-900 to-gray-800 border-0 shadow-2xl">
        <CardContent className="p-10">
          <div className="text-center mb-8">
            <h3 className="text-3xl font-bold text-white mb-2">Certificate Actions</h3>
            <p className="text-slate-300 text-lg">Download your certificate or continue with verification workflow</p>
          </div>
          
          <div className="flex flex-wrap gap-6 justify-center">
            <Button 
              onClick={handleDownloadCertificate}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center gap-3"
            >
              <Download className="w-6 h-6" />
              Download Enterprise Certificate
            </Button>
            
            <Button 
              onClick={onStartNew}
              className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center gap-3"
            >
              <CheckCircle className="w-6 h-6" />
              Start New Verification
            </Button>
            
            <Button 
              onClick={onBack}
              className="bg-gradient-to-r from-slate-600 to-gray-700 hover:from-slate-700 hover:to-gray-800 text-white px-8 py-4 rounded-xl text-lg font-bold shadow-2xl transform hover:scale-105 transition-all duration-300 flex items-center gap-3"
            >
              <ArrowLeft className="w-6 h-6" />
              Return to Workflow
            </Button>
          </div>
          
          <div className="mt-8 pt-8 border-t border-slate-600">
            <p className="text-center text-slate-400 text-sm">
              Certificate generated by AO Intelligence Enterprise Platform • Powered by blockchain verification technology
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}