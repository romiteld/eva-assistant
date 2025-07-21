import { useState, useEffect } from 'react';
import { EmailTemplate, emailTemplateService } from '@/lib/services/email-templates';
import { useToast } from './use-toast';

export function useEmailTemplates(category?: string) {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    loadTemplates();
    // loadTemplates is defined locally and only needs to update when category changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category]);

  const loadTemplates = async () => {
    setIsLoading(true);
    try {
      const filters = category ? { category: category as any } : undefined;
      const data = await emailTemplateService.getTemplates(filters);
      setTemplates(data);
    } catch (error) {
      console.error('Error loading templates:', error);
      toast({
        title: 'Error',
        description: 'Failed to load email templates',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const sendFromTemplate = async (
    templateId: string,
    recipient: { email: string; name?: string },
    variables: Record<string, string>
  ) => {
    try {
      await emailTemplateService.sendEmailFromTemplate({
        templateId,
        recipient,
        variables,
      });
      
      toast({
        title: 'Success',
        description: 'Email sent successfully',
      });
      
      return true;
    } catch (error) {
      console.error('Error sending email:', error);
      toast({
        title: 'Error',
        description: 'Failed to send email',
        variant: 'destructive',
      });
      return false;
    }
  };

  return {
    templates,
    isLoading,
    refresh: loadTemplates,
    sendFromTemplate,
  };
}