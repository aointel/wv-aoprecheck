import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import {
  BookOpen, CheckCircle2, XCircle, Clock, Send,
  ExternalLink, RefreshCw, AlertCircle, Trophy, GraduationCap
} from 'lucide-react';
import type { RecruitCandidate } from '@shared/schema';

const COURSE_TYPES = [
  'Life & Health',
  'Life & Health + Code & Ethics',
  'Life',
  'Health',
  'Property & Casualty',
  'Property & Casualty + Code & Ethics',
  'Personal Lines',
  'Variable Products',
  'Medicare Supplement/Long-Term Care',
];

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC'
];

const EXAMFX_STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  not_enrolled: { label: 'Not Enrolled', color: 'bg-gray-100 text-gray-600', icon: <Clock className="w-3 h-3" /> },
  enrolled: { label: 'Enrolled', color: 'bg-blue-100 text-blue-700', icon: <BookOpen className="w-3 h-3" /> },
  studying: { label: 'Studying', color: 'bg-indigo-100 text-indigo-700', icon: <BookOpen className="w-3 h-3" /> },
  exam_scheduled: { label: 'Exam Scheduled', color: 'bg-amber-100 text-amber-700', icon: <Clock className="w-3 h-3" /> },
  passed: { label: 'Passed ✓', color: 'bg-green-100 text-green-700', icon: <CheckCircle2 className="w-3 h-3" /> },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-700', icon: <XCircle className="w-3 h-3" /> },
};

interface ExamFXPanelProps {
  candidate: RecruitCandidate;
  userEmail?: string;
}

export function ExamFXPanel({ candidate, userEmail }: ExamFXPanelProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [isSendingSMS, setIsSendingSMS] = useState(false);

  // Form state
  const [form, setForm] = useState({
    examfxVoucherCode: '',
    examfxState: '',
    examfxCourseType: 'Life & Health',
    examfxStatus: 'not_enrolled',
    examfxProgressPercent: 0,
    examfxPracticeScores: '',
    examfxExamDate: '',
    examfxExamResult: '',
    examfxNotes: '',
  });

  // Fetch current ExamFX data for this candidate
  const { data: examfxData, isLoading } = useQuery({
    queryKey: ['/api/recruit/candidates', candidate.id, 'examfx'],
    queryFn: async () => {
      const res = await fetch(`/api/recruit/candidates/${candidate.id}/examfx`);
      if (!res.ok) throw new Error('Failed to fetch ExamFX data');
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data?.examfx) {
        const e = data.examfx;
        setForm({
          examfxVoucherCode: e.examfx_voucher_code || '',
          examfxState: e.examfx_state || '',
          examfxCourseType: e.examfx_course_type || 'Life & Health',
          examfxStatus: e.examfx_status || 'not_enrolled',
          examfxProgressPercent: e.examfx_progress_percent || 0,
          examfxPracticeScores: e.examfx_practice_scores || '',
          examfxExamDate: e.examfx_exam_date ? new Date(e.examfx_exam_date).toISOString().slice(0, 10) : '',
          examfxExamResult: e.examfx_exam_result || '',
          examfxNotes: e.examfx_notes || '',
        });
      }
    },
  } as any);

  const examfx = examfxData?.examfx;
  const currentStatus = examfx?.examfx_status || 'not_enrolled';
  const statusConfig = EXAMFX_STATUS_CONFIG[currentStatus] || EXAMFX_STATUS_CONFIG.not_enrolled;

  // Parse practice scores for display
  const practiceScores: number[] = (() => {
    try {
      const raw = examfx?.examfx_practice_scores;
      if (!raw) return [];
      return JSON.parse(raw);
    } catch { return []; }
  })();

  const avgScore = practiceScores.length > 0
    ? Math.round(practiceScores.reduce((a: number, b: number) => a + b, 0) / practiceScores.length)
    : null;

  const readinessColor = avgScore == null ? 'text-gray-400' : avgScore >= 85 ? 'text-green-600' : avgScore >= 70 ? 'text-amber-600' : 'text-red-600';

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: typeof form) => {
      const body: Record<string, any> = {
        examfxVoucherCode: payload.examfxVoucherCode || null,
        examfxState: payload.examfxState || null,
        examfxCourseType: payload.examfxCourseType || null,
        examfxStatus: payload.examfxStatus,
        examfxProgressPercent: payload.examfxProgressPercent,
        examfxNotes: payload.examfxNotes || null,
        examfxExamResult: payload.examfxExamResult || null,
      };
      // Parse and re-stringify practice scores
      if (payload.examfxPracticeScores) {
        try {
          const scores = payload.examfxPracticeScores
            .split(',')
            .map((s: string) => parseInt(s.trim()))
            .filter((n: number) => !isNaN(n));
          body.examfxPracticeScores = JSON.stringify(scores);
        } catch { body.examfxPracticeScores = null; }
      }
      if (payload.examfxExamDate) body.examfxExamDate = new Date(payload.examfxExamDate).toISOString();
      if (payload.examfxExamResult) body.examfxExamResultAt = new Date().toISOString();

      const res = await fetch(`/api/recruit/candidates/${candidate.id}/examfx`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'ExamFX data saved' });
      setIsEditing(false);
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates', candidate.id, 'examfx'] });
      queryClient.invalidateQueries({ queryKey: ['/api/recruit/candidates'] });
    },
    onError: (err: any) => toast({ title: 'Save failed', description: err.message, variant: 'destructive' }),
  });

  // Send enrollment SMS
  const handleSendSMS = async () => {
    if (!candidate.phone) {
      toast({ title: 'No phone number', description: 'Candidate does not have a phone number.', variant: 'destructive' });
      return;
    }
    setIsSendingSMS(true);
    try {
      const res = await fetch(`/api/recruit/candidates/${candidate.id}/examfx/send-enrollment-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          voucherCode: form.examfxVoucherCode,
          state: form.examfxState,
          courseType: form.examfxCourseType,
          candidatePhone: candidate.phone,
          candidateName: candidate.firstName,
          agentEmail: userEmail,
        }),
      });
      if (!res.ok) throw new Error('SMS failed');
      toast({ title: 'Enrollment SMS sent!', description: `Sent to ${candidate.firstName} ${candidate.lastName}` });
    } catch (err: any) {
      toast({ title: 'SMS failed', description: err.message, variant: 'destructive' });
    } finally {
      setIsSendingSMS(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="border-indigo-100">
        <CardContent className="p-4 flex items-center gap-2 text-sm text-muted-foreground">
          <RefreshCw className="w-4 h-4 animate-spin" />
          Loading ExamFX data...
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/50 to-white">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2 text-indigo-800">
            <GraduationCap className="w-5 h-5 text-indigo-600" />
            ExamFX Licensing
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge className={`${statusConfig.color} flex items-center gap-1 text-xs`}>
              {statusConfig.icon}
              {statusConfig.label}
            </Badge>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? 'Cancel' : 'Edit'}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Read-only summary view */}
        {!isEditing && (
          <div className="space-y-3">
            {/* Status-based hero display */}
            {currentStatus === 'not_enrolled' && (
              <div className="text-center py-4 text-sm text-muted-foreground">
                <GraduationCap className="w-8 h-8 mx-auto mb-2 text-gray-300" />
                <p>Not yet enrolled in ExamFX</p>
                <Button
                  size="sm"
                  className="mt-3 bg-indigo-600 hover:bg-indigo-700 text-white"
                  onClick={() => setIsEditing(true)}
                >
                  Start Enrollment
                </Button>
              </div>
            )}

            {currentStatus === 'passed' && (
              <div className="flex flex-col items-center py-4 text-center">
                <Trophy className="w-10 h-10 text-yellow-500 mb-2" />
                <p className="font-semibold text-green-700 text-lg">Exam Passed! 🎉</p>
                {examfx?.examfx_exam_result_at && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {new Date(examfx.examfx_exam_result_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            )}

            {currentStatus === 'failed' && (
              <div className="flex flex-col items-center py-4 text-center">
                <XCircle className="w-10 h-10 text-red-400 mb-2" />
                <p className="font-semibold text-red-700">Exam Not Passed</p>
                <p className="text-xs text-muted-foreground mt-1">Update status when they reschedule</p>
              </div>
            )}

            {/* Details grid for active states */}
            {['enrolled', 'studying', 'exam_scheduled'].includes(currentStatus) && (
              <div className="grid grid-cols-2 gap-3 text-sm">
                {examfx?.examfx_course_type && (
                  <div>
                    <p className="text-xs text-muted-foreground">Course</p>
                    <p className="font-medium">{examfx.examfx_course_type}</p>
                  </div>
                )}
                {examfx?.examfx_state && (
                  <div>
                    <p className="text-xs text-muted-foreground">State</p>
                    <p className="font-medium">{examfx.examfx_state}</p>
                  </div>
                )}
                {examfx?.examfx_enrolled_at && (
                  <div>
                    <p className="text-xs text-muted-foreground">Enrolled</p>
                    <p className="font-medium">{new Date(examfx.examfx_enrolled_at).toLocaleDateString()}</p>
                  </div>
                )}
                {examfx?.examfx_exam_date && (
                  <div>
                    <p className="text-xs text-muted-foreground">Exam Date</p>
                    <p className="font-medium">{new Date(examfx.examfx_exam_date).toLocaleDateString()}</p>
                  </div>
                )}
                {examfx?.examfx_voucher_code && (
                  <div className="col-span-2">
                    <p className="text-xs text-muted-foreground">Voucher Code</p>
                    <p className="font-mono font-semibold text-indigo-700">{examfx.examfx_voucher_code}</p>
                  </div>
                )}
              </div>
            )}

            {/* Course progress bar */}
            {['studying', 'exam_scheduled', 'enrolled'].includes(currentStatus) && examfx?.examfx_progress_percent != null && (
              <div>
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>Course Progress</span>
                  <span className="font-semibold">{examfx.examfx_progress_percent}%</span>
                </div>
                <Progress value={examfx.examfx_progress_percent} className="h-2" />
              </div>
            )}

            {/* Practice exam scores */}
            {practiceScores.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground mb-2">Practice Exam Scores</p>
                <div className="flex items-end gap-2 flex-wrap">
                  {practiceScores.map((score: number, i: number) => (
                    <div key={i} className="text-center">
                      <div className={`text-xs font-bold px-2 py-1 rounded ${score >= 85 ? 'bg-green-100 text-green-700' : score >= 70 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'}`}>
                        {score}%
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5">#{i + 1}</div>
                    </div>
                  ))}
                  {avgScore !== null && (
                    <div className="ml-auto text-right">
                      <p className="text-xs text-muted-foreground">Avg</p>
                      <p className={`text-sm font-bold ${readinessColor}`}>{avgScore}%</p>
                    </div>
                  )}
                </div>
                {avgScore !== null && (
                  <p className={`text-xs mt-1 font-medium ${readinessColor}`}>
                    {avgScore >= 85 ? '✅ Ready to test' : avgScore >= 70 ? '⚠️ More study recommended' : '❌ Not ready — needs coaching'}
                  </p>
                )}
              </div>
            )}

            {/* Notes */}
            {examfx?.examfx_notes && (
              <div className="text-xs bg-white border border-indigo-100 rounded p-2">
                <p className="text-muted-foreground mb-1">Notes</p>
                <p>{examfx.examfx_notes}</p>
              </div>
            )}

            {/* Action buttons for active states */}
            {['enrolled', 'studying', 'exam_scheduled'].includes(currentStatus) && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 flex-1"
                  onClick={handleSendSMS}
                  disabled={isSendingSMS || !candidate.phone}
                >
                  <Send className="w-3 h-3 mr-1" />
                  {isSendingSMS ? 'Sending...' : 'Resend SMS'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs h-8 flex-1"
                  onClick={() => window.open('https://www.examfx.com', '_blank')}
                >
                  <ExternalLink className="w-3 h-3 mr-1" />
                  ExamFX
                </Button>
              </div>
            )}

            {/* Last sync note */}
            {examfx?.examfx_last_sync_at && (
              <p className="text-[10px] text-muted-foreground text-right">
                Updated {new Date(examfx.examfx_last_sync_at).toLocaleString()}
              </p>
            )}
          </div>
        )}

        {/* Edit form */}
        {isEditing && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">State</Label>
                <Select value={form.examfxState} onValueChange={(v) => setForm({ ...form, examfxState: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {US_STATES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Status</Label>
                <Select value={form.examfxStatus} onValueChange={(v) => setForm({ ...form, examfxStatus: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_enrolled">Not Enrolled</SelectItem>
                    <SelectItem value="enrolled">Enrolled</SelectItem>
                    <SelectItem value="studying">Studying</SelectItem>
                    <SelectItem value="exam_scheduled">Exam Scheduled</SelectItem>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label className="text-xs">Course Type</Label>
              <Select value={form.examfxCourseType} onValueChange={(v) => setForm({ ...form, examfxCourseType: v })}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COURSE_TYPES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Voucher Code</Label>
              <Input
                className="h-8 text-xs font-mono"
                placeholder="e.g. EFX-XXXX-XXXX-XXXX"
                value={form.examfxVoucherCode}
                onChange={(e) => setForm({ ...form, examfxVoucherCode: e.target.value })}
              />
            </div>

            <div>
              <Label className="text-xs">Course Progress (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                className="h-8 text-xs"
                value={form.examfxProgressPercent}
                onChange={(e) => setForm({ ...form, examfxProgressPercent: parseInt(e.target.value) || 0 })}
              />
            </div>

            <div>
              <Label className="text-xs">Practice Exam Scores (comma-separated)</Label>
              <Input
                className="h-8 text-xs"
                placeholder="e.g. 72, 81, 88"
                value={form.examfxPracticeScores}
                onChange={(e) => setForm({ ...form, examfxPracticeScores: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">Enter each score separated by commas</p>
            </div>

            {(form.examfxStatus === 'exam_scheduled' || form.examfxStatus === 'passed' || form.examfxStatus === 'failed') && (
              <div>
                <Label className="text-xs">Exam Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs"
                  value={form.examfxExamDate}
                  onChange={(e) => setForm({ ...form, examfxExamDate: e.target.value })}
                />
              </div>
            )}

            {(form.examfxStatus === 'passed' || form.examfxStatus === 'failed') && (
              <div>
                <Label className="text-xs">Exam Result</Label>
                <Select value={form.examfxExamResult} onValueChange={(v) => setForm({ ...form, examfxExamResult: v })}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Select result" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="passed">Passed</SelectItem>
                    <SelectItem value="failed">Failed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                className="text-xs resize-none"
                rows={3}
                placeholder="Add licensing notes..."
                value={form.examfxNotes}
                onChange={(e) => setForm({ ...form, examfxNotes: e.target.value })}
              />
            </div>

            {/* Send enrollment SMS when voucher code is present */}
            {form.examfxVoucherCode && candidate.phone && (
              <div className="flex items-start gap-2 p-3 bg-indigo-50 rounded-lg border border-indigo-200">
                <AlertCircle className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-indigo-800">Send enrollment SMS?</p>
                  <p className="text-[10px] text-indigo-600 mt-0.5">
                    Sends voucher code + ExamFX link to {candidate.firstName} at {candidate.phone}
                  </p>
                  <Button
                    size="sm"
                    className="mt-2 h-7 text-xs bg-indigo-600 hover:bg-indigo-700 text-white"
                    onClick={handleSendSMS}
                    disabled={isSendingSMS}
                  >
                    <Send className="w-3 h-3 mr-1" />
                    {isSendingSMS ? 'Sending...' : 'Send Enrollment SMS'}
                  </Button>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-8"
                onClick={() => saveMutation.mutate(form)}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
              <Button
                variant="outline"
                className="text-xs h-8"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
