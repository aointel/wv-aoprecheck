import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Bug, MessageSquareText, Lightbulb, Send } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';

const feedbackSchema = z.object({
  reportType: z.enum(['bug', 'feature_request', 'feedback']),
  title: z.string().min(5, 'Title must be at least 5 characters'),
  description: z.string().min(10, 'Description must be at least 10 characters'),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  stepsToReproduce: z.string().optional(),
  expectedBehavior: z.string().optional(),
  actualBehavior: z.string().optional(),
});

type FeedbackFormData = z.infer<typeof feedbackSchema>;

interface BugReportModalProps {
  userEmail: string;
  userName?: string;
}

export function BugReportModal({ userEmail, userName }: BugReportModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<FeedbackFormData>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      reportType: 'bug',
      severity: 'medium',
      title: '',
      description: '',
      stepsToReproduce: '',
      expectedBehavior: '',
      actualBehavior: '',
    },
  });

  const submitFeedback = useMutation({
    mutationFn: async (data: FeedbackFormData) => {
      // Get browser info and current page URL
      const browserInfo = navigator.userproducer;
      const pageUrl = window.location.href;

      const payload = {
        ...data,
        reporterEmail: userEmail,
        reporterName: userName || 'Unknown',
        browserInfo,
        pageUrl,
      };

      const response = await fetch('/api/feedback/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Feedback Submitted',
        description: 'Thank you for your feedback! We\'ll review it and get back to you.',
      });
      form.reset();
      setIsOpen(false);
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
    },
    onError: (error) => {
      toast({
        title: 'Submission Failed',
        description: 'There was an error submitting your feedback. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const reportType = form.watch('reportType');

  const getIcon = () => {
    switch (reportType) {
      case 'bug':
        return <Bug className="h-4 w-4" />;
      case 'feature_request':
        return <Lightbulb className="h-4 w-4" />;
      case 'feedback':
        return <MessageSquareText className="h-4 w-4" />;
    }
  };

  const getTitle = () => {
    switch (reportType) {
      case 'bug':
        return 'Report a Bug';
      case 'feature_request':
        return 'Request a Feature';
      case 'feedback':
        return 'Share Feedback';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="bg-orange-100 hover:bg-orange-200 text-orange-700 border-orange-300 flex items-center space-x-1"
          title="Submit Bug Report or Feedback"
        >
          <Bug className="h-4 w-4" />
          <span className="hidden sm:inline">Report Issue</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            {getIcon()}
            <span>{getTitle()}</span>
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((data) => submitFeedback.mutate(data))} className="space-y-4">
            <FormField
              control={form.control}
              name="reportType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Type of Report</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select report type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="bug">🐛 Bug Report</SelectItem>
                      <SelectItem value="feature_request">💡 Feature Request</SelectItem>
                      <SelectItem value="feedback">💬 General Feedback</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="severity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Severity/Priority</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select severity" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="low">🟢 Low - Minor issue</SelectItem>
                      <SelectItem value="medium">🟡 Medium - Standard issue</SelectItem>
                      <SelectItem value="high">🟠 High - Important issue</SelectItem>
                      <SelectItem value="critical">🔴 Critical - System breaking</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder={reportType === 'bug' ? 'Brief description of the bug' : reportType === 'feature_request' ? 'Feature you\'d like to see' : 'Brief summary of your feedback'}
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder={reportType === 'bug' ? 'Detailed description of what went wrong...' : reportType === 'feature_request' ? 'Describe the feature and how it would help...' : 'Share your thoughts and suggestions...'}
                      className="min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {reportType === 'bug' && (
              <>
                <FormField
                  control={form.control}
                  name="stepsToReproduce"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Steps to Reproduce (Optional)</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="1. Go to...&#10;2. Click on...&#10;3. Expected to see... but saw..."
                          className="min-h-[80px]"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="expectedBehavior"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Expected Behavior (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What should have happened?"
                            className="min-h-[60px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="actualBehavior"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Actual Behavior (Optional)</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="What actually happened?"
                            className="min-h-[60px]"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </>
            )}

            <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg text-sm text-gray-600 dark:text-gray-400">
              <p><strong>Automatically included:</strong></p>
              <p>• Current page: {window.location.pathname}</p>
              <p>• Browser: {navigator.userproducer.split(' ')[0]}</p>
              <p>• Your email: {userEmail}</p>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
                disabled={submitFeedback.isPending}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitFeedback.isPending}
                className="flex items-center space-x-2"
              >
                {submitFeedback.isPending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Submit {reportType === 'bug' ? 'Bug Report' : reportType === 'feature_request' ? 'Feature Request' : 'Feedback'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}