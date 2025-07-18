'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { 
  Share2, 
  Link, 
  Image, 
  Send, 
  Eye, 
  Globe,
  Users,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ContentShareForm {
  text: string;
  url?: string;
  title?: string;
  description?: string;
  visibility: 'PUBLIC' | 'CONNECTIONS';
  includeUrl: boolean;
}

export function LinkedInContentSharing() {
  const { user } = useAuth();
  const [form, setForm] = useState<ContentShareForm>({
    text: '',
    url: '',
    title: '',
    description: '',
    visibility: 'PUBLIC',
    includeUrl: false
  });
  const [isSharing, setIsSharing] = useState(false);
  const [previewMode, setPreviewMode] = useState(false);

  const handleShare = async () => {
    if (!form.text.trim()) {
      toast.error('Please enter some content to share');
      return;
    }

    try {
      setIsSharing(true);

      const shareContent = {
        text: form.text,
        ...(form.includeUrl && form.url && {
          url: form.url,
          title: form.title,
          description: form.description
        })
      };

      const response = await fetch('/api/linkedin/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: shareContent }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to share content');
      }

      const data = await response.json();
      
      toast.success('Content shared successfully on LinkedIn!');
      
      // Reset form
      setForm({
        text: '',
        url: '',
        title: '',
        description: '',
        visibility: 'PUBLIC',
        includeUrl: false
      });
      
    } catch (error) {
      console.error('Error sharing content:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to share content');
    } finally {
      setIsSharing(false);
    }
  };

  const getCharacterCount = () => {
    return form.text.length;
  };

  const getCharacterCountColor = () => {
    const count = getCharacterCount();
    if (count > 2900) return 'text-red-400';
    if (count > 2500) return 'text-orange-400';
    return 'text-zinc-400';
  };

  return (
    <Card className="bg-black/40 backdrop-blur-xl border-zinc-800">
      <CardHeader>
        <CardTitle className="text-white flex items-center gap-2">
          <Share2 className="w-5 h-5" />
          Share Content on LinkedIn
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Main Content */}
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="content-text">Content</Label>
            <Textarea
              id="content-text"
              placeholder="What would you like to share with your network?"
              value={form.text}
              onChange={(e) => setForm({ ...form, text: e.target.value })}
              rows={6}
              className="bg-zinc-900/50 border-zinc-700 resize-none"
            />
            <div className="flex justify-between items-center">
              <p className="text-xs text-zinc-500">
                Share insights, updates, or industry thoughts
              </p>
              <p className={`text-xs ${getCharacterCountColor()}`}>
                {getCharacterCount()}/3000
              </p>
            </div>
          </div>

          {/* URL Attachment */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2">
              <Switch
                id="include-url"
                checked={form.includeUrl}
                onCheckedChange={(checked) => setForm({ ...form, includeUrl: checked })}
              />
              <Label htmlFor="include-url" className="text-sm">
                Include article or webpage link
              </Label>
            </div>

            {form.includeUrl && (
              <div className="space-y-3 p-4 bg-zinc-900/50 rounded-lg border border-zinc-700">
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input
                    id="url"
                    type="url"
                    placeholder="https://example.com"
                    value={form.url}
                    onChange={(e) => setForm({ ...form, url: e.target.value })}
                    className="bg-zinc-800/50 border-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title">Title (optional)</Label>
                  <Input
                    id="title"
                    placeholder="Article title"
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="bg-zinc-800/50 border-zinc-600"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description (optional)</Label>
                  <Textarea
                    id="description"
                    placeholder="Brief description of the content"
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    rows={3}
                    className="bg-zinc-800/50 border-zinc-600"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Visibility Settings */}
          <div className="space-y-3">
            <Label>Visibility</Label>
            <div className="flex gap-4">
              <div
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.visibility === 'PUBLIC'
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                }`}
                onClick={() => setForm({ ...form, visibility: 'PUBLIC' })}
              >
                <Globe className="w-4 h-4" />
                <div>
                  <div className="text-sm font-medium text-white">Public</div>
                  <div className="text-xs text-zinc-400">Anyone on LinkedIn</div>
                </div>
              </div>
              <div
                className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.visibility === 'CONNECTIONS'
                    ? 'bg-blue-500/10 border-blue-500/50'
                    : 'bg-zinc-900/50 border-zinc-700 hover:border-zinc-600'
                }`}
                onClick={() => setForm({ ...form, visibility: 'CONNECTIONS' })}
              >
                <Users className="w-4 h-4" />
                <div>
                  <div className="text-sm font-medium text-white">Connections</div>
                  <div className="text-xs text-zinc-400">Your network only</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Preview Mode */}
        {previewMode && (
          <div className="space-y-3">
            <Label>Preview</Label>
            <div className="p-4 bg-zinc-900/50 rounded-lg border border-zinc-700">
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-medium">
                      {user?.profile?.full_name?.[0] || 'U'}
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-medium text-white">
                      {user?.profile?.full_name || 'Your Name'}
                    </div>
                    <div className="text-xs text-zinc-400">
                      {user?.profile?.company || 'Your Company'}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                  {form.text}
                </div>
                {form.includeUrl && form.url && (
                  <div className="p-3 bg-zinc-800/50 rounded border border-zinc-600">
                    <div className="text-sm font-medium text-white">
                      {form.title || 'Article Link'}
                    </div>
                    <div className="text-xs text-zinc-400 truncate">
                      {form.url}
                    </div>
                    {form.description && (
                      <div className="text-xs text-zinc-300 mt-1">
                        {form.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            onClick={() => setPreviewMode(!previewMode)}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            {previewMode ? 'Hide Preview' : 'Show Preview'}
          </Button>
          
          <Button
            onClick={handleShare}
            disabled={isSharing || !form.text.trim()}
            className="flex-1 bg-blue-600 hover:bg-blue-700"
          >
            <Send className="w-4 h-4 mr-2" />
            {isSharing ? 'Sharing...' : 'Share on LinkedIn'}
          </Button>
        </div>

        {/* Tips */}
        <div className="p-4 bg-zinc-900/30 rounded-lg border border-zinc-700">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-white">Sharing Tips</p>
              <ul className="text-xs text-zinc-400 space-y-1">
                <li>• Posts with questions get 50% more engagement</li>
                <li>• Share industry insights and professional updates</li>
                <li>• Use relevant hashtags to reach a broader audience</li>
                <li>• Post consistently to build your professional brand</li>
              </ul>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}