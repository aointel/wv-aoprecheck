import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  MessageSquare, 
  Brain, 
  BookOpen,
  TrendingUp,
  Calendar,
  HelpCircle,
  X,
  Copy,
  Check
} from 'lucide-react';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  actions?: Array<{
    type: 'email' | 'route' | 'data' | 'report' | 'execute_action';
    payload?: any;
    action?: string;
    parameters?: any;
  }>;
  data?: any;
}

interface AlexAIChatProps {
  className?: string;
}

export default function AlexAIChat({ className = '' }: AlexAIChatProps) {
  const { authState } = useAuth();
  const { toast } = useToast();
  
  const [selectedAction, setSelectedAction] = useState<string | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(false);
  const [resultMessage, setResultMessage] = useState<string>('');
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Focus input when component mounts
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const actions = [
    { id: 'add_states', label: '📍 Add Licensed States', icon: '📍' },
    { id: 'reset_password', label: '🔑 Reset Password', icon: '🔑' },
    { id: 'fix_vdp', label: '🔧 Fix VDP Error', icon: '🔧' },
    { id: 'change_market', label: '🌎 Change Market', icon: '🌎' }
  ];
  
  const handleActionSelect = (actionId: string) => {
    setSelectedAction(actionId);
    setFormData({});
    setResultMessage('');
  };
  
  const handleExecuteAction = async () => {
    setIsLoading(true);
    setResultMessage('');
    
    try {
      let action = '';
      let parameters: any = {};
      
      switch (selectedAction) {
        case 'add_states':
          action = 'add_licensed_states';
          parameters = {
            agentEmail: formData.agentEmail || authState?.user?.email,
            states: formData.states?.split(',').map((s: string) => s.trim().toUpperCase()) || []
          };
          break;
        case 'reset_password':
          action = 'reset_agent_password';
          parameters = { agentEmail: formData.agentEmail };
          break;
        case 'fix_vdp':
          action = 'fix_vdp_profile';
          parameters = {
            agentEmail: formData.agentEmail,
            states: formData.states?.split(',').map((s: string) => s.trim().toUpperCase()) || [],
            market: formData.market
          };
          break;
      }
      
      const response = await fetch('/api/alex-ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: authState?.user?.email,
          action: action,
          parameters: parameters
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setResultMessage(data.result?.message || '✅ Action completed!');
        toast({
          title: "Success",
          description: "Action completed successfully",
        });
      } else {
        throw new Error('Action failed');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      setResultMessage('❌ Error executing action. Please try again.');
      toast({
        title: "Error",
        description: "Failed to execute action",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async (message: string) => {
    if (!message.trim() || !authState?.user?.email) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: message,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setShowSuggestions(false);

    try {
      // Get the last assistant message's data/context to maintain conversation state
      const lastAssistantMessage = messages.filter(m => m.role === 'assistant').pop();
      const previousContext = lastAssistantMessage?.data || {};
      
      console.log('📤 Sending to Alex - Previous context:', previousContext);
      
      // Build conversation history for GPT context (last 6 messages = 3 exchanges)
      const conversationHistory = messages.slice(-6).map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      const response = await fetch('/api/alex-ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: authState.user.email,
          message: message,
          context: {
            timestamp: new Date().toISOString(),
            conversationHistory: conversationHistory, // Pass conversation history
            ...previousContext // Pass previous context (awaitingStates, targetAgent, etc.)
          }
        })
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: data.response,
          timestamp: new Date(),
          actions: data.actions,
          data: data.data
        };
        setMessages(prev => [...prev, assistantMessage]);
        
        // Auto-execute actions if present
        if (data.actions && data.actions.length > 0) {
          for (const action of data.actions) {
            if (action.type === 'execute_action') {
              await executeAction(action.action, action.parameters);
            }
          }
        }
      } else {
        throw new Error('Failed to get response from Alex AI');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: "I'm sorry, I'm having trouble connecting right now. Please try again in a moment.",
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
      toast({
        title: "Connection Error",
        description: "Failed to connect to Alex AI. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
      // Refocus input after message sent
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputMessage);
  };

  const handleQuickSuggestion = (suggestion: string) => {
    sendMessage(suggestion);
  };

  const copyMessage = async (messageId: string, content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedMessageId(messageId);
      setTimeout(() => setCopiedMessageId(null), 2000);
      toast({
        title: "Copied!",
        description: "Message copied to clipboard",
        duration: 2000,
      });
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const executeAction = async (action: string, parameters: any) => {
    if (!authState?.user?.email) return;

    try {
      setIsLoading(true);
      
      const response = await fetch('/api/alex-ai/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userEmail: authState.user.email,
          action: action,
          parameters: parameters
        })
      });

      if (response.ok) {
        const result = await response.json();
        
        // Add result message to chat
        const resultMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `✅ **Action Completed: ${action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}**\n\n${JSON.stringify(result.result, null, 2)}`,
          timestamp: new Date(),
          data: result.result
        };
        
        setMessages(prev => [...prev, resultMessage]);
        
        toast({
          title: "Action Executed!",
          description: `Successfully executed: ${action.replace(/_/g, ' ')}`,
        });
      } else {
        throw new Error('Failed to execute action');
      }
    } catch (error) {
      console.error('Error executing action:', error);
      toast({
        title: "Error",
        description: "Failed to execute action",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getMessageIcon = (role: 'user' | 'assistant') => {
    if (role === 'user') {
      return <User className="h-6 w-6 text-blue-600" />;
    }
    return <Bot className="h-6 w-6 text-green-600" />;
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const renderMessageContent = (content: string) => {
    // Split content by newlines and render with proper formatting
    return content.split('\n').map((line, index) => {
      if (line.trim() === '') return <br key={index} />;
      
      // Check for bullet points
      if (line.trim().startsWith('•')) {
        return (
          <div key={index} className="flex items-start gap-2 mb-1">
            <span className="text-green-500 mt-1">•</span>
            <span>{line.substring(1).trim()}</span>
          </div>
        );
      }
      
      // Check for headers (lines with **)
      if (line.includes('**')) {
        const parts = line.split('**');
        return (
          <div key={index} className="mb-2">
            {parts.map((part, partIndex) => 
              partIndex % 2 === 1 ? (
                <strong key={partIndex} className="text-blue-600">{part}</strong>
              ) : (
                <span key={partIndex}>{part}</span>
              )
            )}
          </div>
        );
      }
      
      return <div key={index} className="mb-2">{line}</div>;
    });
  };

  const clearChat = () => {
    setMessages([
      {
        id: '1',
        role: 'assistant',
        content: "Hi! I'm Alex, your ConnectNow AI assistant. I'm here to help with:\n\n• 🏥 **Underwriting questions** (medical conditions, table ratings, declines)\n• 📊 **Lead management** (organization, priorities, hotleads)\n• 📅 **Schedule & appointments**\n• 📈 **Reports & analytics**\n• 🛠️ **Platform support**\n\nWhat can I help you with today?",
        timestamp: new Date()
      }
    ]);
    setShowSuggestions(true);
  };

  return (
    <Card className={`w-full max-w-4xl mx-auto ${className}`}>
      <CardHeader className="bg-gradient-to-r from-blue-600 to-purple-600 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/20 rounded-lg">
              <Brain className="h-6 w-6" />
            </div>
            <div>
              <CardTitle className="text-xl">Alex AI Assistant</CardTitle>
              <p className="text-blue-100 text-sm">ConnectNow & AO Globe Life Expert</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
              GPT-5 Powered
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="text-white hover:bg-white/20"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {/* Chat Messages */}
        <div className="h-96 overflow-y-auto p-4 space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex gap-3 ${
                message.role === 'user' ? 'justify-end' : 'justify-start'
              }`}
            >
              {message.role === 'assistant' && getMessageIcon('assistant')}
              
              <div
                className={`max-w-[80%] rounded-lg p-3 ${
                  message.role === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-800'
                }`}
              >
                <div className="whitespace-pre-wrap">
                  {renderMessageContent(message.content)}
                </div>
                
                {/* Action Buttons */}
                {message.actions && message.actions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {message.actions.map((action, actionIndex) => (
                      <div key={actionIndex}>
                        {action.type === 'execute_action' && (
                          <Button
                            size="sm"
                            onClick={() => executeAction(action.action, action.parameters)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            🚀 Execute: {action.action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {message.data && (
                  <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-500">
                    <div className="text-sm text-blue-700 dark:text-blue-300">
                      <strong>Data:</strong> {JSON.stringify(message.data, null, 2)}
                    </div>
                  </div>
                )}
                
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs opacity-70">
                    {formatTimestamp(message.timestamp)}
                  </span>
                  
                  {message.role === 'assistant' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyMessage(message.id, message.content)}
                      className="h-6 w-6 p-0 hover:bg-gray-200 dark:hover:bg-gray-700"
                    >
                      {copiedMessageId === message.id ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
              
              {message.role === 'user' && getMessageIcon('user')}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex gap-3 justify-start">
              {getMessageIcon('assistant')}
              <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Alex is thinking...
                  </span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>

        {/* Quick Suggestions */}
        {showSuggestions && (
          <div className="p-4 border-t bg-gray-50 dark:bg-gray-900">
            <div className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              💡 Quick questions to get started:
            </div>
            <div className="flex flex-wrap gap-2">
              {quickSuggestions.map((suggestion, index) => (
                <Button
                  key={index}
                  variant="outline"
                  size="sm"
                  onClick={() => handleQuickSuggestion(suggestion)}
                  className="text-xs h-8"
                >
                  {suggestion}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="p-4 border-t">
          <div className="flex gap-2">
            <Textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask Alex about underwriting, leads, or anything ConnectNow related..."
              className="flex-1 min-h-[60px] resize-none"
              disabled={isLoading}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              disabled={isLoading || !inputMessage.trim()}
              className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}