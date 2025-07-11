-- Email Templates System Migration

-- Create email template categories enum
CREATE TYPE template_category AS ENUM (
    'recruiting',
    'follow_up',
    'scheduling',
    'welcome',
    'rejection',
    'offer',
    'referral',
    'networking',
    'custom'
);

-- Create email templates table
CREATE TABLE IF NOT EXISTS public.email_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    category template_category NOT NULL DEFAULT 'custom',
    variables JSONB DEFAULT '[]', -- Array of variable definitions [{name: 'candidateName', label: 'Candidate Name', defaultValue: ''}]
    tags TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create email template usage history table
CREATE TABLE IF NOT EXISTS public.email_template_usage (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID REFERENCES public.email_templates(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    recipient_email TEXT NOT NULL,
    recipient_name TEXT,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    variables_used JSONB DEFAULT '{}', -- Actual variable values used
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    status TEXT DEFAULT 'sent', -- sent, failed, bounced, opened, clicked
    metadata JSONB DEFAULT '{}' -- Can store message_id, tracking info, etc.
);

-- Create indexes for performance
CREATE INDEX idx_email_templates_user_id ON public.email_templates(user_id);
CREATE INDEX idx_email_templates_category ON public.email_templates(category);
CREATE INDEX idx_email_templates_tags ON public.email_templates USING GIN(tags);
CREATE INDEX idx_email_template_usage_template_id ON public.email_template_usage(template_id);
CREATE INDEX idx_email_template_usage_user_id ON public.email_template_usage(user_id);
CREATE INDEX idx_email_template_usage_sent_at ON public.email_template_usage(sent_at DESC);

-- Add RLS policies
ALTER TABLE public.email_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_template_usage ENABLE ROW LEVEL SECURITY;

-- Email templates policies
CREATE POLICY "Users can view their own email templates" ON public.email_templates
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email templates" ON public.email_templates
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own email templates" ON public.email_templates
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own email templates" ON public.email_templates
    FOR DELETE USING (auth.uid() = user_id);

-- Email template usage policies
CREATE POLICY "Users can view their own email usage history" ON public.email_template_usage
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own email usage records" ON public.email_template_usage
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create functions
CREATE OR REPLACE FUNCTION update_template_usage_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.email_templates
    SET usage_count = usage_count + 1,
        last_used_at = NEW.sent_at,
        updated_at = NOW()
    WHERE id = NEW.template_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update usage count
CREATE TRIGGER update_template_usage
    AFTER INSERT ON public.email_template_usage
    FOR EACH ROW
    EXECUTE FUNCTION update_template_usage_count();

-- Insert default templates
INSERT INTO public.email_templates (name, subject, body, category, variables) VALUES
(
    'Initial Candidate Outreach',
    'Exciting Opportunity at {{companyName}}',
    E'Hi {{candidateName}},\n\nI came across your profile and was impressed by your experience in {{industry}}. I''m working with {{companyName}} on an exciting {{positionTitle}} opportunity that I believe aligns well with your background.\n\nThe role offers:\n- {{salary}} compensation package\n- {{benefits}}\n- {{growthOpportunities}}\n\nWould you be open to a brief conversation to discuss this further?\n\nBest regards,\n{{recruiterName}}\n{{recruiterTitle}}\n{{recruiterCompany}}',
    'recruiting',
    '[
        {"name": "candidateName", "label": "Candidate Name", "defaultValue": ""},
        {"name": "companyName", "label": "Company Name", "defaultValue": ""},
        {"name": "industry", "label": "Industry", "defaultValue": "financial services"},
        {"name": "positionTitle", "label": "Position Title", "defaultValue": ""},
        {"name": "salary", "label": "Salary Range", "defaultValue": "Competitive"},
        {"name": "benefits", "label": "Benefits", "defaultValue": "Comprehensive benefits package"},
        {"name": "growthOpportunities", "label": "Growth Opportunities", "defaultValue": "Career advancement opportunities"},
        {"name": "recruiterName", "label": "Your Name", "defaultValue": ""},
        {"name": "recruiterTitle", "label": "Your Title", "defaultValue": ""},
        {"name": "recruiterCompany", "label": "Your Company", "defaultValue": "The Well Recruiting Solutions"}
    ]'::jsonb
),
(
    'Interview Follow-up',
    'Following Up on Your Interview with {{companyName}}',
    E'Hi {{candidateName}},\n\nThank you for taking the time to interview for the {{positionTitle}} position with {{companyName}} on {{interviewDate}}.\n\n{{interviewerName}} was impressed with your {{strengths}} and felt you would be a great cultural fit for the team.\n\nThe next steps in the process are:\n{{nextSteps}}\n\nPlease let me know if you have any questions or if there''s anything else you need from me.\n\nBest regards,\n{{recruiterName}}',
    'follow_up',
    '[
        {"name": "candidateName", "label": "Candidate Name", "defaultValue": ""},
        {"name": "companyName", "label": "Company Name", "defaultValue": ""},
        {"name": "positionTitle", "label": "Position Title", "defaultValue": ""},
        {"name": "interviewDate", "label": "Interview Date", "defaultValue": ""},
        {"name": "interviewerName", "label": "Interviewer Name", "defaultValue": "The hiring team"},
        {"name": "strengths", "label": "Candidate Strengths", "defaultValue": "experience and skills"},
        {"name": "nextSteps", "label": "Next Steps", "defaultValue": ""},
        {"name": "recruiterName", "label": "Your Name", "defaultValue": ""}
    ]'::jsonb
),
(
    'Interview Scheduling',
    'Interview Scheduling for {{positionTitle}} at {{companyName}}',
    E'Hi {{candidateName}},\n\nGreat news! {{companyName}} would like to move forward with your application for the {{positionTitle}} position.\n\nThey would like to schedule a {{interviewType}} interview with {{interviewerName}}.\n\nPlease let me know your availability for the following time slots:\n{{timeSlots}}\n\nThe interview will last approximately {{duration}} and will {{interviewFormat}}.\n\nLooking forward to your response.\n\nBest regards,\n{{recruiterName}}',
    'scheduling',
    '[
        {"name": "candidateName", "label": "Candidate Name", "defaultValue": ""},
        {"name": "companyName", "label": "Company Name", "defaultValue": ""},
        {"name": "positionTitle", "label": "Position Title", "defaultValue": ""},
        {"name": "interviewType", "label": "Interview Type", "defaultValue": "phone"},
        {"name": "interviewerName", "label": "Interviewer Name", "defaultValue": "the hiring manager"},
        {"name": "timeSlots", "label": "Available Time Slots", "defaultValue": ""},
        {"name": "duration", "label": "Interview Duration", "defaultValue": "30 minutes"},
        {"name": "interviewFormat", "label": "Interview Format", "defaultValue": "be conducted via phone"},
        {"name": "recruiterName", "label": "Your Name", "defaultValue": ""}
    ]'::jsonb
);

-- Create function to render template with variables
CREATE OR REPLACE FUNCTION render_email_template(
    template_body TEXT,
    variables JSONB
)
RETURNS TEXT AS $$
DECLARE
    rendered_body TEXT := template_body;
    var_key TEXT;
    var_value TEXT;
BEGIN
    FOR var_key, var_value IN
        SELECT key, value::text
        FROM jsonb_each_text(variables)
    LOOP
        rendered_body := REPLACE(rendered_body, '{{' || var_key || '}}', COALESCE(var_value, ''));
    END LOOP;
    
    RETURN rendered_body;
END;
$$ LANGUAGE plpgsql;