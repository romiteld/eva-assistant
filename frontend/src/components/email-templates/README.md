# Email Templates System

The Email Templates system provides a comprehensive solution for creating, managing, and sending templated emails through the Microsoft Outlook integration.

## Features

- **Template Management**: Create, edit, duplicate, and delete email templates
- **Categories**: Organize templates by category (recruiting, follow-up, scheduling, etc.)
- **Variable System**: Define placeholders that can be filled in when sending emails
- **Preview & Testing**: Preview emails with sample data before sending
- **Usage Tracking**: Track how often templates are used and their success rates
- **Integration Ready**: Easy to integrate into any part of the application

## Components

### EmailTemplateEditor
Full-featured template editor with rich text support and variable management.

```tsx
import { EmailTemplateEditor } from '@/components/email-templates';

<EmailTemplateEditor
  template={existingTemplate} // Optional, for editing
  onSave={(template) => console.log('Saved:', template)}
  onCancel={() => console.log('Cancelled')}
/>
```

### EmailTemplateList
Display and manage all templates with filtering and search.

```tsx
import { EmailTemplateList } from '@/components/email-templates';

<EmailTemplateList
  onEdit={(template) => console.log('Edit:', template)}
  onCreate={() => console.log('Create new')}
  refresh={refreshTrigger} // Optional refresh trigger
/>
```

### EmailTemplateSelector
Dropdown selector for quick email sending from any component.

```tsx
import { EmailTemplateSelector } from '@/components/email-templates';

<EmailTemplateSelector
  category="recruiting" // Optional: filter by category
  defaultRecipient={{ email: 'candidate@example.com', name: 'John Doe' }}
  defaultVariables={{ positionTitle: 'Senior Developer' }}
  onSent={() => console.log('Email sent!')}
/>
```

## Using the Service

### Basic Usage

```typescript
import { emailTemplateService } from '@/lib/services/email-templates';

// Create a template
const template = await emailTemplateService.createTemplate({
  name: 'Welcome Email',
  subject: 'Welcome to {{companyName}}!',
  body: 'Hi {{candidateName}}, welcome aboard!',
  category: 'welcome',
  variables: [
    { name: 'candidateName', label: 'Candidate Name', defaultValue: '' },
    { name: 'companyName', label: 'Company Name', defaultValue: 'Our Company' }
  ]
});

// Send email from template
await emailTemplateService.sendEmailFromTemplate({
  templateId: template.id,
  recipient: { email: 'user@example.com', name: 'John Doe' },
  variables: {
    candidateName: 'John',
    companyName: 'The Well Recruiting'
  }
});
```

### Using the Hook

```typescript
import { useEmailTemplates } from '@/hooks/use-email-templates';

function MyComponent() {
  const { templates, isLoading, sendFromTemplate } = useEmailTemplates('recruiting');

  const handleSend = async () => {
    const success = await sendFromTemplate(
      templateId,
      { email: 'recipient@example.com' },
      { variable1: 'value1' }
    );
  };
}
```

## Template Variables

Variables use double curly braces: `{{variableName}}`

Example template:
```
Subject: Interview scheduled for {{positionTitle}} at {{companyName}}

Body:
Hi {{candidateName}},

Your interview for the {{positionTitle}} position has been scheduled for {{interviewDate}} at {{interviewTime}}.

Best regards,
{{recruiterName}}
```

## Database Schema

The system uses two main tables:

1. **email_templates**: Stores template definitions
2. **email_template_usage**: Tracks usage history and analytics

## Integration Examples

### In the Interview Center
```tsx
// Add email template selector to send interview invitations
<EmailTemplateSelector
  category="scheduling"
  defaultRecipient={{ 
    email: candidate.email, 
    name: candidate.name 
  }}
  defaultVariables={{
    candidateName: candidate.name,
    positionTitle: interview.position,
    interviewDate: interview.date,
    interviewTime: interview.time
  }}
  buttonText="Send Interview Invitation"
/>
```

### In Lead Generation
```tsx
// Use templates for outreach campaigns
const { sendFromTemplate } = useEmailTemplates('recruiting');

await sendFromTemplate(
  recruitingTemplateId,
  { email: lead.email, name: lead.name },
  {
    candidateName: lead.name,
    companyName: lead.company,
    positionTitle: 'Financial Advisor'
  }
);
```

## Best Practices

1. **Use meaningful variable names**: Make them self-explanatory
2. **Provide default values**: Helps users understand what goes where
3. **Categorize properly**: Makes templates easier to find
4. **Test before sending**: Always preview with real data
5. **Track performance**: Monitor open rates and responses

## Future Enhancements

- A/B testing for subject lines
- Email scheduling
- Bulk sending with CSV import
- Template versioning
- Advanced analytics dashboard