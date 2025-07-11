'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, Mail, Building2, MapPin, Briefcase } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface LinkedInProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  profilePicture: string | null;
  profileUrl: string;
  headline?: string;
  location?: string;
  industry?: string;
  summary?: string;
  positions?: Array<{
    title: string;
    company: string;
    startDate: string;
    endDate?: string;
    current: boolean;
  }>;
}

export function LinkedInProfileViewer() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<LinkedInProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await fetch('/api/linkedin/profile', {
        headers: {
          'Authorization': `Bearer ${await user?.getIdToken()}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch LinkedIn profile');
      }

      const data = await response.json();
      setProfile(data.profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-20 h-20 bg-zinc-800 rounded-full" />
              <div className="space-y-2">
                <div className="h-6 w-48 bg-zinc-800 rounded" />
                <div className="h-4 w-32 bg-zinc-800 rounded" />
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-zinc-800 rounded" />
              <div className="h-4 w-3/4 bg-zinc-800 rounded" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-red-400">{error}</p>
            <Button onClick={fetchProfile} variant="outline">
              Try Again
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white">LinkedIn Profile</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Profile Header */}
        <div className="flex items-start space-x-4">
          <Avatar className="w-20 h-20 border-2 border-blue-500/20">
            <AvatarImage src={profile.profilePicture || undefined} />
            <AvatarFallback className="bg-blue-500/10 text-blue-400 text-xl">
              {profile.firstName[0]}{profile.lastName[0]}
            </AvatarFallback>
          </Avatar>
          
          <div className="flex-1 space-y-2">
            <h3 className="text-xl font-semibold text-white">
              {profile.firstName} {profile.lastName}
            </h3>
            {profile.headline && (
              <p className="text-zinc-400">{profile.headline}</p>
            )}
            <div className="flex items-center gap-4 text-sm text-zinc-500">
              {profile.email && (
                <div className="flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {profile.email}
                </div>
              )}
              {profile.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {profile.location}
                </div>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => window.open(profile.profileUrl, '_blank')}
            >
              <ExternalLink className="w-3 h-3 mr-1" />
              View on LinkedIn
            </Button>
          </div>
        </div>

        {/* Industry */}
        {profile.industry && (
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-zinc-400" />
            <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
              {profile.industry}
            </Badge>
          </div>
        )}

        {/* Summary */}
        {profile.summary && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-400">About</h4>
            <p className="text-sm text-zinc-300 whitespace-pre-line">
              {profile.summary}
            </p>
          </div>
        )}

        {/* Experience */}
        {profile.positions && profile.positions.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
              <Briefcase className="w-4 h-4" />
              Experience
            </h4>
            <div className="space-y-3">
              {profile.positions.map((position, index) => (
                <div key={index} className="border-l-2 border-zinc-700 pl-4 space-y-1">
                  <h5 className="font-medium text-white">{position.title}</h5>
                  <p className="text-sm text-zinc-400">{position.company}</p>
                  <p className="text-xs text-zinc-500">
                    {position.startDate} - {position.current ? 'Present' : position.endDate}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}