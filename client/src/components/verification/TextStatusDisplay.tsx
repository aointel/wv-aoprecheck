import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  MessageCircle, 
  CheckCircle, 
  XCircle, 
  Clock, 
  RefreshCw, 
  Edit2,
  Phone,
  User
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TextStatus {
  sent: boolean;
  sid?: string;
  status: 'pending' | 'sent' | 'delivered' | 'read' | 'failed';
  sentAt?: string;
  deliveredAt?: string;
  readAt?: string;
}

interface TextStatusDisplayProps {
  sessionId: string;
  clientPhone: string;
  producerPhone?: string;
  clientTextStatus?: TextStatus;
  producerTextStatus?: TextStatus;
  onRefresh?: () => void;
}

export function TextStatusDisplay({
  sessionId,
  clientPhone,
  producerPhone,
  clientTextStatus,
  producerTextStatus,
  onRefresh
}: TextStatusDisplayProps) {
  const [isEditingClientPhone, setIsEditingClientPhone] = useState(false);
  const [isEditingproducerPhone, setIsEditingproducerPhone] = useState(false);
  const [newClientPhone, setNewClientPhone] = useState(clientPhone);
  const [newproducerPhone, setNewproducerPhone] = useState(producerPhone || '');
  const [isResending, setIsResending] = useState<'client' | 'producer' | null>(null);
  const { toast } = useToast();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'read':
        return <CheckCircle className="w-4 h-4 text-blue-500" />;
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'read':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  const handleResendText = async (type: 'client' | 'producer') => {
    setIsResending(type);
    try {
      const phone = type === 'client' ? newClientPhone : newproducerPhone;
      const response = await fetch(`/api/resend-text/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type,
          phone,
          sessionId 
        })
      });

      if (response.ok) {
        toast({
          title: "Text Resent",
          description: `${type === 'client' ? 'Client' : 'producer'} text sent successfully`,
        });
        onRefresh?.();
      } else {
        throw new Error('Failed to resend text');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to resend ${type} text`,
        variant: "destructive",
      });
    } finally {
      setIsResending(null);
    }
  };

  const handleUpdatePhone = async (type: 'client' | 'producer') => {
    try {
      const phone = type === 'client' ? newClientPhone : newproducerPhone;
      const response = await fetch(`/api/update-phone/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          type,
          phone,
          sessionId 
        })
      });

      if (response.ok) {
        toast({
          title: "Phone Updated",
          description: `${type === 'client' ? 'Client' : 'producer'} phone number updated`,
        });
        if (type === 'client') {
          setIsEditingClientPhone(false);
        } else {
          setIsEditingproducerPhone(false);
        }
        onRefresh?.();
      } else {
        throw new Error('Failed to update phone');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: `Failed to update ${type} phone number`,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            Step 2: Text Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Client Text Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <h4 className="font-medium">Client Text</h4>
            </div>
            
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-500" />
                {isEditingClientPhone ? (
                  <div className="flex items-center gap-2">
                    <Input
                      value={newClientPhone}
                      onChange={(e) => setNewClientPhone(e.target.value)}
                      className="w-32"
                      placeholder="Phone number"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdatePhone('client')}
                      disabled={newClientPhone === clientPhone}
                    >
                      Save
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsEditingClientPhone(false);
                        setNewClientPhone(clientPhone);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm">{clientPhone}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsEditingClientPhone(true)}
                    >
                      <Edit2 className="w-3 h-3" />
                    </Button>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                {getStatusIcon(clientTextStatus?.status || 'pending')}
                <Badge className={getStatusColor(clientTextStatus?.status || 'pending')}>
                  {clientTextStatus?.status || 'pending'}
                </Badge>
              </div>

              <Button
                size="sm"
                variant="outline"
                onClick={() => handleResendText('client')}
                disabled={isResending === 'client'}
              >
                {isResending === 'client' ? (
                  <RefreshCw className="w-3 h-3 animate-spin" />
                ) : (
                  <RefreshCw className="w-3 h-3" />
                )}
                Resend
              </Button>
            </div>

            {clientTextStatus?.sentAt && (
              <div className="text-xs text-gray-500">
                Sent: {new Date(clientTextStatus.sentAt).toLocaleString()}
              </div>
            )}
          </div>

          {/* producer Text Status */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4" />
              <h4 className="font-medium">producer Text</h4>
            </div>
            
            {producerPhone ? (
              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-gray-500" />
                  {isEditingproducerPhone ? (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newproducerPhone}
                        onChange={(e) => setNewproducerPhone(e.target.value)}
                        className="w-32"
                        placeholder="producer phone"
                      />
                      <Button
                        size="sm"
                        onClick={() => handleUpdatePhone('producer')}
                        disabled={newproducerPhone === producerPhone}
                      >
                        Save
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setIsEditingproducerPhone(false);
                          setNewproducerPhone(producerPhone || '');
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm">{producerPhone}</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setIsEditingproducerPhone(true)}
                      >
                        <Edit2 className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {getStatusIcon(producerTextStatus?.status || 'pending')}
                  <Badge className={getStatusColor(producerTextStatus?.status || 'pending')}>
                    {producerTextStatus?.status || 'pending'}
                  </Badge>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleResendText('producer')}
                  disabled={isResending === 'producer'}
                >
                  {isResending === 'producer' ? (
                    <RefreshCw className="w-3 h-3 animate-spin" />
                  ) : (
                    <RefreshCw className="w-3 h-3" />
                  )}
                  Resend
                </Button>
              </div>
            ) : (
              <div className="p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                <div className="flex items-center gap-2 text-yellow-800">
                  <XCircle className="w-4 h-4" />
                  <span className="text-sm">No producer phone number available</span>
                </div>
                <div className="mt-2">
                  <div className="flex items-center gap-2">
                    <Input
                      value={newproducerPhone}
                      onChange={(e) => setNewproducerPhone(e.target.value)}
                      className="w-32"
                      placeholder="Add producer phone"
                    />
                    <Button
                      size="sm"
                      onClick={() => handleUpdatePhone('producer')}
                      disabled={!newproducerPhone}
                    >
                      Add & Send
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {producerTextStatus?.sentAt && (
              <div className="text-xs text-gray-500">
                Sent: {new Date(producerTextStatus.sentAt).toLocaleString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
