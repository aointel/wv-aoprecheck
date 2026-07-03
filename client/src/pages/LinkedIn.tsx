import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Search, ExternalLink, MapPin, Building, Calendar, GraduationCap, Briefcase, Award } from 'lucide-react';

interface RecruitProfile {
  email: string;
  linkedin_url: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  job_title: string | null;
  company_name: string | null;
  company_website: string | null;
  company_industry: string | null;
  company_size: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  phone_numbers: string[];
  work_email: string | null;
  education: Array<{
    school: string;
    degree: string;
    start_date: string;
    end_date: string;
    summary: string;
  }>;
  experience: Array<{
    company: string;
    title: string;
    start_date: string;
    end_date: string;
    summary: string;
  }>;
  skills: string[];
  summary: string | null;
  headline: string | null;
  industry: string | null;
  social_profiles: Array<{
    network: string;
    url: string;
  }>;
  enriched_at: string;
}

export default function LinkedIn() {
  const [singleEmail, setSingleEmail] = useState('');
  const [bulkEmails, setBulkEmails] = useState('');
  const [enrichedProfiles, setEnrichedProfiles] = useState<RecruitProfile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [savedProfiles, setSavedProfiles] = useState<RecruitProfile[]>([]);
  const { toast } = useToast();

  const enrichSingleEmail = async () => {
    if (!singleEmail.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter an email address',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/linkedin-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: singleEmail.trim() })
      });

      const data = await response.json();
      
      if (data.success && data.profile) {
        setEnrichedProfiles([data.profile]);
        toast({
          title: 'Success',
          description: `Found LinkedIn profile for ${data.profile.full_name || singleEmail}`,
        });
      } else {
        toast({
          title: 'No Results',
          description: data.message || 'No LinkedIn profile found for this email',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to enrich email',
        variant: 'destructive'
      });
    }
    setIsLoading(false);
  };

  const enrichBulkEmails = async () => {
    const emails = bulkEmails.split('\n').map(e => e.trim()).filter(e => e);
    if (emails.length === 0) {
      toast({
        title: 'Error',
        description: 'Please enter email addresses (one per line)',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/linkedin-enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emails })
      });

      const data = await response.json();
      
      if (data.success && data.profiles) {
        setEnrichedProfiles(data.profiles);
        toast({
          title: 'Success',
          description: `Found ${data.found} LinkedIn profiles out of ${data.total} emails`,
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to enrich emails',
          variant: 'destructive'
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to enrich emails',
        variant: 'destructive'
      });
    }
    setIsLoading(false);
  };

  const loadSavedProfiles = async () => {
    try {
      const response = await fetch('/api/recruit-profiles');
      const data = await response.json();
      
      if (data.success) {
        setSavedProfiles(data.profiles || []);
        toast({
          title: 'Success',
          description: `Loaded ${data.count} saved recruit profiles`,
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to load saved profiles',
        variant: 'destructive'
      });
    }
  };

  const ProfileCard: React.FC<{ profile: RecruitProfile }> = ({ profile }) => (
    <Card className="mb-6">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">
            {profile.full_name || `${profile.first_name} ${profile.last_name}` || 'Unknown Name'}
          </CardTitle>
          {profile.linkedin_url && (
            <Button variant="outline" size="sm" asChild>
              <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                LinkedIn
              </a>
            </Button>
          )}
        </div>
        {profile.headline && (
          <p className="text-gray-600">{profile.headline}</p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h4 className="font-semibold mb-2">Contact Information</h4>
            <p className="text-sm"><strong>Email:</strong> {profile.email}</p>
            {profile.work_email && profile.work_email !== profile.email && (
              <p className="text-sm"><strong>Work Email:</strong> {profile.work_email}</p>
            )}
            {profile.phone_numbers.length > 0 && (
              <p className="text-sm"><strong>Phone:</strong> {profile.phone_numbers.join(', ')}</p>
            )}
          </div>
          <div>
            <h4 className="font-semibold mb-2">Location & Company</h4>
            {profile.location && (
              <p className="text-sm flex items-center"><MapPin className="w-4 h-4 mr-1" /> {profile.location}</p>
            )}
            {profile.company_name && (
              <p className="text-sm flex items-center"><Building className="w-4 h-4 mr-1" /> {profile.company_name}</p>
            )}
            {profile.job_title && (
              <p className="text-sm"><strong>Title:</strong> {profile.job_title}</p>
            )}
            {profile.company_industry && (
              <p className="text-sm"><strong>Industry:</strong> {profile.company_industry}</p>
            )}
          </div>
        </div>

        {/* Summary */}
        {profile.summary && (
          <div>
            <h4 className="font-semibold mb-2">Summary</h4>
            <p className="text-sm text-gray-700">{profile.summary}</p>
          </div>
        )}

        {/* Skills */}
        {profile.skills.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <Award className="w-4 h-4 mr-1" /> Skills
            </h4>
            <div className="flex flex-wrap gap-1">
              {profile.skills.slice(0, 10).map((skill, index) => (
                <Badge key={index} variant="secondary" className="text-xs">
                  {skill}
                </Badge>
              ))}
              {profile.skills.length > 10 && (
                <Badge variant="outline" className="text-xs">
                  +{profile.skills.length - 10} more
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Experience */}
        {profile.experience.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <Briefcase className="w-4 h-4 mr-1" /> Experience
            </h4>
            {profile.experience.slice(0, 3).map((exp, index) => (
              <div key={index} className="border-l-2 border-gray-200 pl-3 mb-2">
                <p className="font-medium">{exp.title} at {exp.company}</p>
                <p className="text-xs text-gray-500 flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {exp.start_date} - {exp.end_date || 'Present'}
                </p>
                {exp.summary && (
                  <p className="text-sm text-gray-600 mt-1">{exp.summary.slice(0, 150)}...</p>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        {profile.education.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2 flex items-center">
              <GraduationCap className="w-4 h-4 mr-1" /> Education
            </h4>
            {profile.education.slice(0, 2).map((edu, index) => (
              <div key={index} className="border-l-2 border-gray-200 pl-3 mb-2">
                <p className="font-medium">{edu.degree} at {edu.school}</p>
                <p className="text-xs text-gray-500">
                  {edu.start_date} - {edu.end_date}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Social Profiles */}
        {profile.social_profiles.length > 0 && (
          <div>
            <h4 className="font-semibold mb-2">Social Profiles</h4>
            <div className="flex flex-wrap gap-2">
              {profile.social_profiles.map((social, index) => (
                <Badge key={index} variant="outline" className="text-xs">
                  <a href={social.url} target="_blank" rel="noopener noreferrer">
                    {social.network}
                  </a>
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Separator />
        <p className="text-xs text-gray-500">
          Enriched on {new Date(profile.enriched_at).toLocaleString()}
        </p>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">LinkedIn Recruit Enrichment</h1>
        <p className="text-gray-600">
          Find comprehensive LinkedIn profiles and career information for recruit emails using PeopleDataLabs API
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Single Email Enrichment */}
        <Card>
          <CardHeader>
            <CardTitle>Single Email Enrichment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Input
                placeholder="Enter recruit email address"
                value={singleEmail}
                onChange={(e) => setSingleEmail(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && enrichSingleEmail()}
              />
              <Button 
                onClick={enrichSingleEmail} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Enrich Profile
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Email Enrichment */}
        <Card>
          <CardHeader>
            <CardTitle>Bulk Email Enrichment</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Textarea
                placeholder="Enter multiple email addresses (one per line)"
                value={bulkEmails}
                onChange={(e) => setBulkEmails(e.target.value)}
                rows={5}
              />
              <Button 
                onClick={enrichBulkEmails} 
                disabled={isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Search className="w-4 h-4 mr-2" />
                )}
                Enrich All Profiles
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Load Saved Profiles */}
      <div className="mb-6">
        <Button onClick={loadSavedProfiles} variant="outline">
          Load Saved Profiles ({savedProfiles.length})
        </Button>
      </div>

      {/* Results */}
      {enrichedProfiles.length > 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">
            Enriched Profiles ({enrichedProfiles.length})
          </h2>
          {enrichedProfiles.map((profile, index) => (
            <ProfileCard key={index} profile={profile} />
          ))}
        </div>
      )}

      {/* Saved Profiles */}
      {savedProfiles.length > 0 && enrichedProfiles.length === 0 && (
        <div>
          <h2 className="text-2xl font-semibold mb-4">
            Saved Recruit Profiles ({savedProfiles.length})
          </h2>
          {savedProfiles.map((profile, index) => (
            <ProfileCard key={index} profile={profile} />
          ))}
        </div>
      )}

      {isLoading && (
        <div className="flex justify-center items-center py-8">
          <Loader2 className="w-8 h-8 animate-spin mr-2" />
          <span>Enriching profiles with PeopleDataLabs API...</span>
        </div>
      )}
    </div>
  );
}