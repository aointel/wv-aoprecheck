import React from 'react';
import { Link } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MdVerifiedUser, MdQrCode, MdPhone, MdSecurity } from 'react-icons/md';

export default function AOPrecheck() {
  // Add console log for navigation verification
  console.log('✅ AO Precheck page loaded');
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">
            <span className="bg-gradient-to-r from-blue-600 via-purple-600 to-blue-700 bg-clip-text text-transparent" style={{ 
              WebkitBackgroundClip: 'text', 
              WebkitTextFillColor: 'transparent', 
              backgroundClip: 'text',
              display: 'inline-block',
              lineHeight: '1.2'
            }}>
              🛡️ AO Precheck
            </span>
          </h1>
          <p className="text-muted-foreground">
            Collect secure client details and policy information. Four-step enterprise verification workflow.
          </p>
        </div>
        <Badge variant="outline" className="text-sm">
          Enterprise Verified
        </Badge>
      </div>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <MdVerifiedUser className="w-5 h-5" />
            <span>Start New Verification</span>
          </CardTitle>

        </CardHeader>
        <CardContent>
          <Button asChild size="lg" className="w-full md:w-auto">
            <Link to="/verification-start">Start Verification Process</Link>
          </Button>
        </CardContent>
      </Card>



      {/* Process Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Verification Process</CardTitle>
          <CardDescription>
            Four-step enterprise verification workflow
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center space-y-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto font-bold">
                1
              </div>
              <h3 className="font-semibold">Client Information</h3>
              <p className="text-sm text-muted-foreground">
                Collect secure client details and policy information
              </p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto font-bold">
                2
              </div>
              <h3 className="font-semibold">Mobile Verification</h3>
              <p className="text-sm text-muted-foreground">
                Agent uses QR code on mobile device during call
              </p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto font-bold">
                3
              </div>
              <h3 className="font-semibold">Verification Call</h3>
              <p className="text-sm text-muted-foreground">
                Real-time verification with conference integration
              </p>
            </div>
            
            <div className="text-center space-y-2">
              <div className="w-8 h-8 bg-primary text-primary-foreground rounded-full flex items-center justify-center mx-auto font-bold">
                4
              </div>
              <h3 className="font-semibold">Certificate</h3>
              <p className="text-sm text-muted-foreground">
                Generate compliance certificate with audit trail
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Recent Verifications</CardTitle>
            <CardDescription>
              Your latest verification sessions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">John Smith</p>
                  <p className="text-sm text-muted-foreground">Policy #12345</p>
                </div>
                <Badge variant="default">Completed</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Sarah Johnson</p>
                  <p className="text-sm text-muted-foreground">Policy #12346</p>
                </div>
                <Badge variant="secondary">In Progress</Badge>
              </div>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-medium">Mike Davis</p>
                  <p className="text-sm text-muted-foreground">Policy #12347</p>
                </div>
                <Badge variant="outline">Pending</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>System Status</CardTitle>
            <CardDescription>
              Platform health and connectivity
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm">Verification System</span>
                <Badge variant="default">Online</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Twilio Conference</span>
                <Badge variant="default">Connected</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Certificate Generation</span>
                <Badge variant="default">Available</Badge>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm">Email Delivery</span>
                <Badge variant="default">Active</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}