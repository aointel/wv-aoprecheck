import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export default function producerInfoTest() {
  const { toast } = useToast();

  // producer information state with localStorage persistence
  const [producerFirstName, setproducerFirstName] = useState(() => localStorage.getItem('agent_first_name') || '');
  const [producerLastName, setproducerLastName] = useState(() => localStorage.getItem('agent_last_name') || '');
  const [producerPhone, setproducerPhone] = useState(() => localStorage.getItem('agent_phone') || '');
  const [producerZoomRoomId, setproducerZoomRoomId] = useState(() => localStorage.getItem('agent_zoom_room_id') || '');
  const [producerZoomPassword, setproducerZoomPassword] = useState(() => localStorage.getItem('agent_zoom_password') || '1');

  // Save functions for each field
  const saveproducerFirstName = () => {
    localStorage.setItem('agent_first_name', producerFirstName);
    toast({ title: "Saved", description: "producer first name saved successfully!" });
  };

  const saveproducerLastName = () => {
    localStorage.setItem('agent_last_name', producerLastName);
    toast({ title: "Saved", description: "producer last name saved successfully!" });
  };

  const saveproducerPhone = () => {
    localStorage.setItem('agent_phone', producerPhone);
    toast({ title: "Saved", description: "producer phone number saved successfully!" });
  };

  const saveproducerZoomRoomId = () => {
    localStorage.setItem('agent_zoom_room_id', producerZoomRoomId);
    toast({ title: "Saved", description: "Zoom room ID saved successfully!" });
  };

  const saveproducerZoomPassword = () => {
    const password = producerZoomPassword || '1';
    localStorage.setItem('agent_zoom_password', password);
    toast({ title: "Saved", description: "Zoom password saved successfully!" });
  };

  const saveAllproducerInfo = () => {
    localStorage.setItem('agent_first_name', producerFirstName);
    localStorage.setItem('agent_last_name', producerLastName);
    localStorage.setItem('agent_phone', producerPhone);
    localStorage.setItem('agent_zoom_room_id', producerZoomRoomId);
    localStorage.setItem('agent_zoom_password', producerZoomPassword || '1');
    toast({ title: "All Saved", description: "All producer information saved successfully!" });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">AO</span>
                </div>
                <span className="font-semibold text-gray-900">AO Precheck</span>
              </div>
              <div className="hidden md:block h-6 w-px bg-gray-300"></div>
              <span className="hidden md:block text-sm text-gray-600">producer Information Test</span>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-600">
              Step 2 - Producer Info
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* producer Information Section */}
        <Card className="mb-8 shadow-xl border-0 bg-white/80 backdrop-blur-sm">
          <CardContent className="p-8">
            <h3 className="text-2xl font-bold text-slate-700 mb-6">producer Information</h3>
            <p className="text-slate-600 mb-6">Please enter your contact information. This will be saved for future sessions.</p>
            
            {/* Producer Name Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label htmlFor="producerFirstName" className="text-base font-semibold text-slate-700 mb-2 block">
                  producer First Name *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerFirstName"
                    value={producerFirstName}
                    onChange={(e) => setproducerFirstName(e.target.value)}
                    placeholder="Alex"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerFirstName}
                    size="sm"
                    variant="outline"
                    className="px-3"
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="producerLastName" className="text-base font-semibold text-slate-700 mb-2 block">
                  producer Last Name *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerLastName"
                    value={producerLastName}
                    onChange={(e) => setproducerLastName(e.target.value)}
                    placeholder="Swift"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerLastName}
                    size="sm"
                    variant="outline"
                    className="px-3"
                  >
                    Save
                  </Button>
                </div>
              </div>
            </div>

            {/* producer Phone Number */}
            <div className="mb-4">
              <Label htmlFor="producerPhone" className="text-base font-semibold text-slate-700 mb-2 block">
                producer Phone Number *
              </Label>
              <div className="flex gap-2 max-w-md">
                <Input
                  id="producerPhone"
                  value={producerPhone}
                  onChange={(e) => setproducerPhone(e.target.value)}
                  placeholder="5032018470"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={saveproducerPhone}
                  size="sm"
                  variant="outline"
                  className="px-3"
                >
                  Save
                </Button>
              </div>
            </div>

            {/* Zoom Meeting Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="producerZoomRoomId" className="text-base font-semibold text-slate-700 mb-2 block">
                  Zoom Room ID *
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerZoomRoomId"
                    value={producerZoomRoomId}
                    onChange={(e) => setproducerZoomRoomId(e.target.value)}
                    placeholder="6179755704"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerZoomRoomId}
                    size="sm"
                    variant="outline"
                    className="px-3"
                  >
                    Save
                  </Button>
                </div>
              </div>

              <div>
                <Label htmlFor="producerZoomPassword" className="text-base font-semibold text-slate-700 mb-2 block">
                  Zoom Password
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="producerZoomPassword"
                    value={producerZoomPassword}
                    onChange={(e) => setproducerZoomPassword(e.target.value)}
                    placeholder="1 (default)"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={saveproducerZoomPassword}
                    size="sm"
                    variant="outline"
                    className="px-3"
                  >
                    Save
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-1">Leave blank to default to "1"</p>
              </div>
            </div>
            
            {/* Save All Button */}
            <div className="mt-6 flex justify-center">
              <Button
                type="button"
                onClick={saveAllproducerInfo}
                variant="default"
                className="bg-blue-600 hover:bg-blue-700 text-white px-6"
              >
                Save All producer Information
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Demo Information */}
        <Card className="bg-blue-50 border border-blue-200">
          <CardContent className="p-6">
            <h4 className="font-semibold text-blue-800 mb-2">producer Information Demo</h4>
            <p className="text-blue-700 text-sm mb-3">
              This demonstrates the individual save buttons functionality for producer contact information.
            </p>
            <div className="grid grid-cols-2 gap-4 text-sm text-blue-700">
              <div>
                <strong>✓ Individual Save Buttons:</strong> Each field has its own save button
              </div>
              <div>
                <strong>✓ Persistent Storage:</strong> Data saved in localStorage
              </div>
              <div>
                <strong>✓ Toast Notifications:</strong> Confirmation when data is saved
              </div>
              <div>
                <strong>✓ Auto-Load:</strong> Previously saved data loads automatically
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}