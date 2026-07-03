import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Phone, Mail, User, Bot, ChevronRight } from 'lucide-react';
import { DialerState } from './types';

interface CandidateDisplayProps {
  state: DialerState;
  stages?: Array<{ id: number; name: string; displayName?: string }>;
  onStageChange?: (candidateId: number, newStageId: number) => void;
}

export default function CandidateDisplay({
  state,
  stages = [],
  onStageChange,
}: CandidateDisplayProps) {
  const { availableLeads, currentLeadIndex } = state;
  const currentCandidate = availableLeads[currentLeadIndex];

  if (!currentCandidate) {
    return (
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="py-12 text-center">
          <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-500 text-sm">No candidate selected</p>
        </CardContent>
      </Card>
    );
  }

  // Extract candidate data - handle both direct candidate fields and mapped lead fields
  const candidateName = currentCandidate.name || 
    `${currentCandidate.first_name || ''} ${currentCandidate.last_name || ''}`.trim() || 
    'Unknown Candidate';
  const email = currentCandidate.email || '';
  const phone = currentCandidate.phone || '';
  const aiSummary = currentCandidate.aiSummary || currentCandidate.ai_summary || '';
  const currentStageId = currentCandidate.currentStageId || currentCandidate.current_stage_id;
  const candidateId = currentCandidate.id;

  // Find current stage name
  const currentStage = stages.find(s => s.id === currentStageId);
  const stageName = currentStage?.displayName || currentStage?.name || 'No Stage';

  // Parse AI Summary (handle JSON format if needed)
  const parseAISummary = (summary: string) => {
    if (!summary || !summary.trim()) return null;
    
    try {
      const trimmed = summary.trim();
      if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
        const jsonData = JSON.parse(trimmed);
        if (Array.isArray(jsonData)) {
          return jsonData
            .map((item: any) => {
              if (typeof item === 'string') return item;
              if (item?.value) return item.value;
              if (item?.key && item?.value) return `${item.key}: ${item.value}`;
              return JSON.stringify(item);
            })
            .filter(Boolean)
            .join('\n');
        } else if (typeof jsonData === 'object') {
          return Object.entries(jsonData)
            .filter(([_, v]) => v && typeof v === 'string')
            .map(([k, v]) => `${k}: ${v}`)
            .join('\n') || summary;
        }
      }
    } catch (e) {
      // If parsing fails, return original
    }
    return summary;
  };

  const parsedSummary = parseAISummary(aiSummary);

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
              {candidateName.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {candidateName}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Candidate ID: {candidateId || 'N/A'}
              </p>
            </div>
          </div>
          {currentStage && (
            <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-300 dark:border-purple-700">
              {stageName}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Contact Information */}
        <div className="border-b pb-4">
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Contact
          </h4>
          <div className="space-y-2">
            {email && (
              <div className="flex items-center gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300">{email}</span>
              </div>
            )}
            {phone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-700 dark:text-gray-300 font-mono">{phone}</span>
              </div>
            )}
            {!email && !phone && (
              <p className="text-sm text-gray-500 italic">No contact information available</p>
            )}
          </div>
        </div>

        {/* AI Summary */}
        {parsedSummary && (
          <div className="border-b pb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <Bot className="h-4 w-4" />
              AI Summary
            </h4>
            <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {parsedSummary}
              </p>
            </div>
          </div>
        )}

        {/* Stage Selection */}
        {stages.length > 0 && (
          <div className="border-b pb-4">
            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Stage
            </h4>
            <div className="flex flex-wrap gap-2">
              {stages.map((stage) => (
                <Button
                  key={stage.id}
                  variant={currentStageId === stage.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (onStageChange && candidateId) {
                      onStageChange(candidateId, stage.id);
                    }
                  }}
                  className={
                    currentStageId === stage.id
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : ''
                  }
                >
                  {stage.displayName || stage.name}
                  {currentStageId === stage.id && (
                    <ChevronRight className="h-3 w-3 ml-1" />
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div>
          <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
            Actions
          </h4>
          <div className="flex flex-wrap gap-2">
            {phone && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`tel:${phone}`, '_self');
                }}
              >
                <Phone className="h-4 w-4 mr-2" />
                Call
              </Button>
            )}
            {email && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(`mailto:${email}`, '_self');
                }}
              >
                <Mail className="h-4 w-4 mr-2" />
                Email
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

