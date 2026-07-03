import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Bot } from 'lucide-react';
import { MdEmail, MdPhone, MdEdit, MdSms, MdCalendarToday, MdDelete } from 'react-icons/md';

interface CandidateQueueProps {
  state: any;
  callConnected?: boolean;
  onSelectCandidate?: (candidate: any, index: number) => void;
  stages?: Array<{ id: number; name: string; displayName?: string }>;
  onStageChange?: (candidateId: number, newStageId: number) => void;
  onEditCandidate?: (candidate: any) => void;
  onDeleteCandidate?: (candidateId: number) => void;
  onSMS?: (candidate: any) => void;
  onAppointment?: (candidate: any) => void;
}

// Helper function to parse AI summary (same as AORecruit page)
function parseAISummary(aiSummary: any): { label: string; content: string; color: string }[] {
  if (!aiSummary) return [];
  
  const summaryText = typeof aiSummary === 'string' ? aiSummary : String(aiSummary || '');
  if (!summaryText || !summaryText.trim()) return [];
  
  let parsedSections: { label: string; content: string; color: string }[] = [];
  
  try {
    const trimmedSummary = summaryText.trim();
    
    if (trimmedSummary.startsWith('[') || trimmedSummary.startsWith('{')) {
      const jsonData = JSON.parse(trimmedSummary);
      
      if (Array.isArray(jsonData) && jsonData.length > 0) {
        jsonData.forEach((item: any) => {
          if (item && typeof item === 'object' && !Array.isArray(item)) {
            if ('key' in item && 'value' in item) {
              const label = String(item.key || '').trim();
              const content = String(item.value || '').trim();
              
              if (label && content) {
                let color = 'purple';
                const labelLower = label.toLowerCase();
                if (labelLower.includes('recap') || labelLower.includes('summary of key topics')) color = 'blue';
                else if (labelLower.includes('next steps') || labelLower.includes('steps')) color = 'green';
                else if (labelLower.includes('background') || labelLower.includes('goals')) color = 'yellow';
                else if (labelLower.includes('screening') || labelLower.includes('status')) color = 'indigo';
                else if (labelLower.includes('sentiment') || labelLower.includes('rate')) color = 'pink';
                else if (labelLower.includes('topics')) color = 'blue';
                
                parsedSections.push({ label, content, color });
              }
            } else {
              Object.entries(item).forEach(([key, value]) => {
                if (key !== 'key' && key !== 'value' && value !== null && value !== undefined) {
                  const valStr = String(value).trim();
                  if (valStr) {
                    let color = 'purple';
                    const keyLower = key.toLowerCase();
                    if (keyLower.includes('recap') || keyLower.includes('summary')) color = 'blue';
                    else if (keyLower.includes('next') || keyLower.includes('steps')) color = 'green';
                    else if (keyLower.includes('background') || keyLower.includes('goals')) color = 'yellow';
                    
                    parsedSections.push({ label: key, content: valStr, color });
                  }
                }
              });
            }
          }
        });
      } else if (typeof jsonData === 'object') {
        Object.entries(jsonData).forEach(([key, value]) => {
          if (value !== null && value !== undefined) {
            const valStr = String(value).trim();
            if (valStr) {
              let color = 'purple';
              const keyLower = key.toLowerCase();
              if (keyLower.includes('recap') || keyLower.includes('summary')) color = 'blue';
              else if (keyLower.includes('next') || keyLower.includes('steps')) color = 'green';
              else if (keyLower.includes('background') || keyLower.includes('goals')) color = 'yellow';
              
              parsedSections.push({ label: key, content: valStr, color });
            }
          }
        });
      }
    }
  } catch (e) {
    // If parsing fails, treat as plain text
    parsedSections.push({ label: 'Summary', content: summaryText, color: 'purple' });
  }
  
  return parsedSections;
}

export default function CandidateQueue({ state, callConnected, onSelectCandidate, stages = [], onStageChange, onEditCandidate, onDeleteCandidate, onSMS, onAppointment }: CandidateQueueProps) {
  const { availableLeads, currentLeadIndex } = state;

  // Filter candidates to only show those in AO Recruit stage (stage ID 1)
  const filteredCandidates = availableLeads.filter((candidate: any) => {
    // Treat missing/invalid stage as stage 1 so legacy rows still appear.
    const stageId = Number(candidate.current_stage_id ?? candidate.currentStageId ?? 0) || 1;
    // Only show candidates in AO Recruit stage (stage ID 1)
    return stageId === 1;
  });

  // Get current candidate
  const currentCandidate = filteredCandidates[currentLeadIndex] || filteredCandidates[0] || null;

  if (!currentCandidate) {
    return (
      <div className="text-center text-muted-foreground py-8">
        <p className="text-sm">No candidates in AO Recruit stage</p>
        <p className="text-xs mt-2">Only candidates in AO Recruit stage (stage 1) are shown here</p>
      </div>
    );
  }

  // Extract candidate data
  const firstName = currentCandidate.first_name || currentCandidate.firstName || '';
  const lastName = currentCandidate.last_name || currentCandidate.lastName || '';
  const candidateName = currentCandidate.name || `${firstName} ${lastName}`.trim() || 'Unknown Candidate';
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || '??';
  const email = currentCandidate.email || '';
  const phone = currentCandidate.phone || '';
  const position = currentCandidate.position || '';
  const aiSummary = currentCandidate.ai_summary || currentCandidate.aiSummary || '';
  const currentStageId = currentCandidate.current_stage_id || currentCandidate.currentStageId;
  const aiSections = parseAISummary(aiSummary);
  
  // Find current stage name
  const currentStage = stages.find(s => s.id === currentStageId);

  return (
    <Card className="border-2 border-green-500 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 shadow-lg">
      <CardContent className="p-4">
        {/* Candidate Info */}
        <div className="space-y-4">
          {/* Name and Position */}
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-green-600 ring-2 ring-green-400 ring-offset-2 flex items-center justify-center text-white font-semibold text-lg flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-bold text-lg text-green-800 dark:text-green-200 flex items-center gap-2">
                <span className="text-green-600 animate-pulse">▶️</span>
                {candidateName}
              </div>
              {position && (
                <div className="text-sm text-green-700 dark:text-green-300 mt-1">
                  {position}
                </div>
              )}
            </div>
          </div>

          {/* Contact Info */}
          <div className="space-y-2">
            {email && (
              <div className="flex items-center gap-2 text-sm">
                <MdEmail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm">
                <MdPhone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span className="text-slate-700 dark:text-slate-300">{phone}</span>
              </div>
            )}
          </div>

          {/* AI Summary */}
          {aiSections.length > 0 && (
            <div className="pt-2 border-t">
              <HoverCard>
                <HoverCardTrigger asChild>
                  <button className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 cursor-pointer hover:opacity-80 transition-opacity">
                    <Bot className="w-4 h-4" />
                    <span className="font-semibold">AI Summary</span>
                  </button>
                </HoverCardTrigger>
                <HoverCardContent className="w-96 p-4" side="right" align="start" sideOffset={10}>
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 border-b pb-2">
                      <Bot className="w-4 h-4 text-purple-600" />
                      <h3 className="font-bold text-base">AI Summary</h3>
                    </div>
                    {aiSections.map((section, idx) => {
                      const colorClasses: Record<string, string> = {
                        blue: 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800',
                        green: 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
                        yellow: 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
                        indigo: 'bg-indigo-50 border-indigo-200 dark:bg-indigo-900/20 dark:border-indigo-800',
                        pink: 'bg-pink-50 border-pink-200 dark:bg-pink-900/20 dark:border-pink-800',
                        purple: 'bg-purple-50 border-purple-200 dark:bg-purple-900/20 dark:border-purple-800',
                      };
                      return (
                        <div key={idx} className={`p-3 rounded-lg border ${colorClasses[section.color] || colorClasses.purple}`}>
                          <h5 className="font-semibold mb-1 text-xs">{section.label}</h5>
                          <p className="text-xs text-slate-900 dark:text-slate-100">{section.content}</p>
                        </div>
                      );
                    })}
                  </div>
                </HoverCardContent>
              </HoverCard>
            </div>
          )}

          {/* Stage Dropdown */}
          {stages.length > 0 && (
            <div className="pt-2 border-t">
              <label className="text-xs font-semibold text-slate-600 dark:text-slate-400 mb-1 block">Stage</label>
              <Select
                value={currentStageId?.toString()}
                onValueChange={(stageId) => {
                  if (onStageChange && currentCandidate.id) {
                    onStageChange(currentCandidate.id, parseInt(stageId));
                  }
                }}
              >
                <SelectTrigger className="h-9 text-sm w-full">
                  <SelectValue placeholder="Select stage" />
                </SelectTrigger>
                <SelectContent>
                  {stages.map((stage) => (
                    <SelectItem key={stage.id} value={stage.id.toString()}>
                      {stage.displayName || stage.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Actions */}
          <div className="pt-2 border-t">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onEditCandidate) {
                    onEditCandidate(currentCandidate);
                  }
                }}
                className="flex-1"
              >
                <MdEdit className="w-4 h-4 mr-1" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onSMS) {
                    onSMS(currentCandidate);
                  }
                }}
                className="flex-1 text-green-600 hover:text-green-700"
              >
                <MdSms className="w-4 h-4 mr-1" />
                SMS
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onAppointment) {
                    onAppointment(currentCandidate);
                  }
                }}
                className="flex-1 text-blue-600 hover:text-blue-700"
              >
                <MdCalendarToday className="w-4 h-4 mr-1" />
                Schedule
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (onDeleteCandidate && currentCandidate.id) {
                    onDeleteCandidate(currentCandidate.id);
                  }
                }}
                className="text-red-600 hover:text-red-700"
              >
                <MdDelete className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
