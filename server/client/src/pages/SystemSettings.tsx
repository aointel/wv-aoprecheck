import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';

export default function SystemSettings() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">System Settings</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>General Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="company-name">Company Name</Label>
              <Input id="company-name" defaultValue="AO Globe Life" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="support-email">Support Email</Label>
              <Input id="support-email" type="email" defaultValue="support@aoglobelife.com" />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone-number">Main Phone Number</Label>
              <Input id="phone-number" defaultValue="+1 (605) 250-0834" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Call Center Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-answer">Auto-Answer Calls</Label>
              <Switch id="auto-answer" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="call-recording">Call Recording</Label>
              <Switch id="call-recording" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="queue-music">Hold Music</Label>
              <Switch id="queue-music" defaultChecked />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>VDP Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="vdp-server">VDP Server URL</Label>
              <Input id="vdp-server" defaultValue="wss://vdp.example.com" />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="vdp-enabled">VDP Integration</Label>
              <Switch id="vdp-enabled" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="auto-dial">Auto Dialing</Label>
              <Switch id="auto-dial" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Notification Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <Label htmlFor="email-notifications">Email Notifications</Label>
              <Switch id="email-notifications" defaultChecked />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="sms-notifications">SMS Notifications</Label>
              <Switch id="sms-notifications" />
            </div>
            
            <div className="flex items-center justify-between">
              <Label htmlFor="desktop-notifications">Desktop Notifications</Label>
              <Switch id="desktop-notifications" defaultChecked />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>System Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex space-x-4">
            <Button>Save Settings</Button>
            <Button variant="outline">Export Config</Button>
            <Button variant="outline">Import Config</Button>
            <Button variant="destructive">Reset to Defaults</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}