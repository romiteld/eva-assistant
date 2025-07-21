# Microsoft Graph Calendar Integration Setup

This document provides step-by-step instructions for setting up Microsoft Graph calendar integration with Outlook in the EVA Assistant application.

## Prerequisites

- Azure Active Directory (Azure AD) tenant
- Microsoft 365 or Outlook.com account
- Admin access to Azure AD (for app registration)

## 1. Azure AD App Registration

### Step 1: Create App Registration

1. Navigate to the [Azure Portal](https://portal.azure.com)
2. Go to **Azure Active Directory** → **App registrations** → **New registration**
3. Fill in the registration details:
   - **Name**: `EVA Assistant Calendar Integration`
   - **Supported account types**: `Accounts in any organizational directory (Any Azure AD directory - Multitenant) and personal Microsoft accounts`
   - **Redirect URI**: 
     - **Type**: `Single-page application (SPA)`
     - **URI**: `http://localhost:3000` (for development)
     - **URI**: `https://your-domain.com` (for production)

### Step 2: Configure API Permissions

1. In your app registration, go to **API permissions**
2. Click **Add a permission** → **Microsoft Graph** → **Delegated permissions**
3. Add the following permissions:
   - `Calendars.ReadWrite` - Have full access to user calendars
   - `User.Read` - Sign in and read user profile
4. Click **Add permissions**
5. **Grant admin consent** for the permissions (if you have admin rights)

### Step 3: Note Application Details

From your app registration, note down:
- **Application (client) ID** - This will be your `NEXT_PUBLIC_MICROSOFT_CLIENT_ID`
- **Directory (tenant) ID** - This will be your `NEXT_PUBLIC_MICROSOFT_TENANT_ID`

## 2. Environment Configuration

### Step 1: Add Environment Variables

Add the following environment variables to your `.env.local` file:

```bash
# Microsoft Graph Configuration
NEXT_PUBLIC_MICROSOFT_CLIENT_ID=your_application_client_id_here
NEXT_PUBLIC_MICROSOFT_TENANT_ID=your_tenant_id_here

# Optional: If using a specific tenant instead of 'common'
# NEXT_PUBLIC_MICROSOFT_AUTHORITY=https://login.microsoftonline.com/your_tenant_id_here
```

### Step 2: Update Redirect URIs

Make sure your Azure AD app registration includes all domains where your app will be hosted:

**Development:**
- `http://localhost:3000`
- `http://localhost:3001`

**Production:**
- `https://your-production-domain.com`

## 3. Required Permissions

The application requires the following Microsoft Graph permissions:

### Calendars.ReadWrite
- **Resource App ID**: `00000003-0000-0000-c000-000000000000`
- **Permission ID**: `1ec239c2-d7c9-4623-a91a-a9775856bb36`
- **Admin consent required**: No
- **Description**: Allows the app to create, read, update, and delete events in user calendars

### User.Read
- **Resource App ID**: `00000003-0000-0000-c000-000000000000`
- **Permission ID**: `e1fe6dd8-ba31-4d61-89e7-88639da4683d`
- **Admin consent required**: No
- **Description**: Allows users to sign in and read their basic profile

## 4. Features Implemented

### Calendar Integration
- ✅ **OAuth 2.0 Authentication** - Secure sign-in with Microsoft accounts
- ✅ **Calendar Access** - Read and write access to user calendars
- ✅ **Task Synchronization** - Automatic sync of task due dates with calendar events
- ✅ **Event Management** - Create, update, and delete calendar events
- ✅ **Multi-Calendar Support** - Support for multiple calendars in user's account
- ✅ **Real-time Updates** - Instant updates when calendar events change

### Task Management
- ✅ **Task-to-Event Conversion** - Convert tasks with due dates to calendar events
- ✅ **Priority Mapping** - Map task priorities to calendar event importance
- ✅ **Status Tracking** - Track task completion status in calendar events
- ✅ **Automatic Categorization** - Categorize task-related events for easy filtering

## 5. Usage Instructions

### For End Users

1. **Connect Calendar**: 
   - Navigate to the Tasks page
   - Click the "Calendar View" tab
   - Click "Connect Outlook" button
   - Sign in with your Microsoft account

2. **Grant Permissions**:
   - Review the requested permissions
   - Click "Accept" to grant calendar access
   - You'll be redirected back to the application

3. **Sync Tasks**:
   - Click the "Sync Tasks" button to synchronize existing tasks with your calendar
   - New tasks with due dates will automatically create calendar events
   - Completed tasks will be marked accordingly in the calendar

4. **Manage Events**:
   - Click on any calendar day to create new events
   - Click on existing events to edit or delete them
   - Events sync in real-time with your Outlook calendar

### For Administrators

1. **Monitor Usage**:
   - Check Azure AD sign-in logs for authentication issues
   - Monitor API usage in the Microsoft Graph developer portal
   - Review consent logs for permission grants

2. **Troubleshooting**:
   - Verify redirect URIs match exactly
   - Check that permissions are properly granted
   - Ensure the application is enabled for public client flows

## 6. Security Considerations

### Data Protection
- All authentication tokens are stored securely in browser localStorage
- No sensitive data is transmitted or stored on the server
- Users can revoke access at any time through their Microsoft account settings

### Privacy
- Only calendar data is accessed, not emails or other personal information
- Data is used solely for task management and calendar integration
- No data is shared with third parties

### Compliance
- Implements OAuth 2.0 best practices
- Follows Microsoft identity platform security guidelines
- Supports multi-tenant scenarios for enterprise deployments

## 7. Error Handling

The application includes comprehensive error handling for:

- **Authentication Errors**: Invalid credentials, expired tokens
- **Permission Errors**: Insufficient permissions, access denied
- **Network Errors**: API timeouts, connection failures
- **Data Errors**: Invalid calendar data, sync conflicts

## 8. Testing

### Development Testing
```bash
# Start the development server
npm run dev

# Navigate to http://localhost:3000
# Go to Tasks → Calendar View
# Test the "Connect Outlook" functionality
```

### Production Testing
- Test with different Microsoft account types (personal, work, school)
- Verify calendar synchronization across different time zones
- Test event creation, editing, and deletion
- Validate permission revocation and re-authentication

## 9. Support and Troubleshooting

### Common Issues

**Q: "Invalid redirect URI" error**
A: Ensure the redirect URI in Azure AD matches exactly with your application URL

**Q: "Insufficient privileges" error**
A: Verify that the required permissions are granted and admin consent is provided

**Q: Calendar events not syncing**
A: Check that the user has granted Calendars.ReadWrite permission

**Q: Authentication popup blocked**
A: Ensure popup blockers are disabled for the application domain

### Getting Help

- Review the [Microsoft Graph documentation](https://docs.microsoft.com/en-us/graph/)
- Check the [Azure AD troubleshooting guide](https://docs.microsoft.com/en-us/azure/active-directory/develop/troubleshoot-app-registration)
- Contact your system administrator for permission-related issues

## 10. Development Notes

### Architecture
- Uses MSAL (Microsoft Authentication Library) for authentication
- Implements Microsoft Graph Client for API calls
- Follows React hooks pattern for state management
- Uses TypeScript for type safety

### Key Components
- `MicrosoftGraphService` - Main service for Graph API interactions
- `InteractiveCalendar` - React component for calendar UI
- `TaskCalendar` - Integration layer between tasks and calendar

### Future Enhancements
- Support for recurring events
- Calendar sharing and delegation
- Integration with Microsoft Teams
- Advanced calendar views (week, month, agenda)
- Email notifications for task deadlines