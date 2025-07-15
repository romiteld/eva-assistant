-- Create IVR flows table
CREATE TABLE IF NOT EXISTS ivr_flows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    steps JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT false,
    phone_number_sid TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_ivr_flows_is_active ON ivr_flows(is_active);
CREATE INDEX IF NOT EXISTS idx_ivr_flows_phone_number_sid ON ivr_flows(phone_number_sid);

-- Enable RLS
ALTER TABLE ivr_flows ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all IVR flows
CREATE POLICY "Allow authenticated users to read IVR flows"
ON ivr_flows FOR SELECT
USING (auth.role() = 'authenticated');

-- Allow authenticated users to create IVR flows
CREATE POLICY "Allow authenticated users to create IVR flows"
ON ivr_flows FOR INSERT
WITH CHECK (auth.role() = 'authenticated');

-- Allow authenticated users to update IVR flows
CREATE POLICY "Allow authenticated users to update IVR flows"
ON ivr_flows FOR UPDATE
USING (auth.role() = 'authenticated');

-- Allow authenticated users to delete IVR flows
CREATE POLICY "Allow authenticated users to delete IVR flows"
ON ivr_flows FOR DELETE
USING (auth.role() = 'authenticated');

-- Insert some sample IVR flows
INSERT INTO ivr_flows (name, steps, is_active) VALUES
(
    'Basic Recruiting IVR',
    '[
        {
            "id": "welcome",
            "type": "welcome",
            "message": "Welcome to The Well Recruiting Solutions.",
            "options": {},
            "nextSteps": {
                "default": "main_menu"
            }
        },
        {
            "id": "main_menu",
            "type": "menu",
            "message": "Press 1 to check your application status. Press 2 to schedule an interview. Press 3 to leave a message. Press 0 to speak with a recruiter.",
            "options": {
                "numDigits": 1,
                "timeout": 10,
                "action": "/api/twilio/ivr-handler"
            },
            "nextSteps": {
                "1": "application_status",
                "2": "schedule_interview",
                "3": "leave_message",
                "0": "transfer_recruiter"
            }
        },
        {
            "id": "application_status",
            "type": "gather",
            "message": "Please enter your 6-digit application ID followed by the pound key.",
            "options": {
                "numDigits": 6,
                "finishOnKey": "#",
                "timeout": 15,
                "action": "/api/twilio/check-application"
            },
            "nextSteps": {}
        },
        {
            "id": "schedule_interview",
            "type": "record",
            "message": "To schedule an interview, please leave your name and preferred time after the beep.",
            "options": {
                "maxLength": 60,
                "timeout": 5,
                "action": "/api/twilio/schedule-interview"
            },
            "nextSteps": {}
        },
        {
            "id": "leave_message",
            "type": "record",
            "message": "Please leave your message after the beep.",
            "options": {
                "maxLength": 120,
                "timeout": 5,
                "action": "/api/twilio/process-message"
            },
            "nextSteps": {}
        },
        {
            "id": "transfer_recruiter",
            "type": "transfer",
            "message": "Connecting you to a recruiter.",
            "options": {
                "transferNumber": "+1234567890"
            },
            "nextSteps": {}
        }
    ]'::jsonb,
    false
),
(
    'Interview Confirmation IVR',
    '[
        {
            "id": "welcome",
            "type": "welcome",
            "message": "Thank you for calling about your interview confirmation.",
            "options": {},
            "nextSteps": {
                "default": "confirm_menu"
            }
        },
        {
            "id": "confirm_menu",
            "type": "menu",
            "message": "Press 1 to confirm your interview. Press 2 to reschedule. Press 3 to cancel.",
            "options": {
                "numDigits": 1,
                "timeout": 10,
                "action": "/api/twilio/interview-handler"
            },
            "nextSteps": {
                "1": "confirm_interview",
                "2": "reschedule_interview",
                "3": "cancel_interview"
            }
        },
        {
            "id": "confirm_interview",
            "type": "gather",
            "message": "Please enter your interview confirmation code followed by the pound key.",
            "options": {
                "numDigits": 8,
                "finishOnKey": "#",
                "timeout": 15,
                "action": "/api/twilio/confirm-interview"
            },
            "nextSteps": {}
        },
        {
            "id": "reschedule_interview",
            "type": "record",
            "message": "Please leave your preferred new date and time after the beep.",
            "options": {
                "maxLength": 60,
                "timeout": 5,
                "action": "/api/twilio/reschedule-interview"
            },
            "nextSteps": {}
        },
        {
            "id": "cancel_interview",
            "type": "record",
            "message": "We are sorry to hear you need to cancel. Please leave a brief reason after the beep.",
            "options": {
                "maxLength": 60,
                "timeout": 5,
                "action": "/api/twilio/cancel-interview"
            },
            "nextSteps": {}
        }
    ]'::jsonb,
    false
);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_ivr_flows_updated_at
    BEFORE UPDATE ON ivr_flows
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();