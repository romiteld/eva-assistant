# File Upload System Documentation

This comprehensive file upload system provides secure, scalable file management using Supabase Storage.

## Overview

The file upload system includes:
- Secure file upload service with validation and progress tracking
- Reusable React components for uploading, listing, and previewing files
- Database schema for file metadata tracking
- Supabase Storage integration with bucket policies
- Support for multiple file types and sizes
- File sharing, tagging, and versioning capabilities

## Components

### 1. FileUploadService (`/lib/services/file-upload.ts`)
Core service for file operations:
- Upload single or multiple files
- Delete files
- List user files with filtering/sorting
- Generate secure download URLs
- Manage file tags
- Share files with other users
- Update file metadata

### 2. FileUploader Component (`/components/files/FileUploader.tsx`)
Drag-and-drop file upload component:
- Drag-and-drop support
- Multiple file upload
- Progress tracking
- File validation
- Error handling

### 3. FileList Component (`/components/files/FileList.tsx`)
Display uploaded files:
- Grid and list view modes
- Search and filter functionality
- Sort by name, date, size
- Download, share, delete actions
- Pagination support

### 4. FilePreview Component (`/components/files/FilePreview.tsx`)
Preview file details:
- Image preview support
- File metadata display
- Tag management
- Download and share actions

### 5. ResumeUpload Component (`/components/files/ResumeUpload.tsx`)
Specialized component for resume uploads:
- Resume-specific validation
- Integration with resume parser
- Parsed data preview

## Database Schema

The system uses the following tables:
- `documents` - Main file metadata table
- `file_shares` - File sharing between users
- `file_versions` - Version control for files
- `file_tags` - File categorization

## Storage Buckets

Four storage buckets are configured:
1. `documents` - General file storage (25MB limit)
2. `avatars` - Profile pictures (5MB limit, public read)
3. `resumes` - Resume files (10MB limit)
4. `temp-uploads` - Temporary files (50MB limit)

## Usage Examples

### Basic File Upload
```tsx
import { FileUploader } from '@/components/files/FileUploader';

function MyComponent() {
  return (
    <FileUploader
      onUploadComplete={(results) => console.log('Uploaded:', results)}
      onUploadError={(errors) => console.error('Errors:', errors)}
      options={{
        bucket: 'documents',
        maxSize: 10 * 1024 * 1024, // 10MB
        allowedTypes: ['application/pdf', 'image/jpeg']
      }}
    />
  );
}
```

### File List with Actions
```tsx
import { FileList } from '@/components/files/FileList';

function MyFiles() {
  return (
    <FileList
      bucket="documents"
      onFileSelect={(file) => console.log('Selected:', file)}
      onFileDelete={(fileId) => console.log('Deleted:', fileId)}
      showActions={true}
      viewMode="grid"
    />
  );
}
```

### Programmatic Upload
```tsx
import { FileUploadService } from '@/lib/services/file-upload';

const uploadService = new FileUploadService();

async function uploadFile(file: File) {
  try {
    const result = await uploadService.uploadFile(file, {
      bucket: 'documents',
      path: 'invoices',
      metadata: { category: 'financial' }
    });
    console.log('File uploaded:', result);
  } catch (error) {
    console.error('Upload failed:', error);
  }
}
```

## Integration with Existing Features

### Resume Parser Integration
The system integrates seamlessly with the resume parser:
```tsx
import { ResumeUpload } from '@/components/files/ResumeUpload';

<ResumeUpload
  onResumeUploaded={(parsedData) => {
    // Handle parsed resume data
    console.log('Parsed resume:', parsedData);
  }}
/>
```

### Document Management
Files can be tagged and organized for easy retrieval:
```tsx
// Add tags to a file
await uploadService.addTags(fileId, ['important', 'contract']);

// List files with specific tags
const { files } = await uploadService.listFiles({
  tags: ['contract'],
  sortBy: 'created_at',
  sortOrder: 'desc'
});
```

## Security Features

1. **Authentication Required**: All file operations require user authentication
2. **Row Level Security**: Users can only access their own files
3. **File Validation**: Type and size validation before upload
4. **Secure URLs**: Time-limited signed URLs for downloads
5. **Path Sanitization**: Prevents directory traversal attacks
6. **CSRF Protection**: API routes protected against CSRF attacks

## Configuration

### Environment Variables
No additional environment variables needed - uses existing Supabase configuration.

### File Type Configuration
Modify `FILE_TYPE_CONFIGS` in `file-upload.ts` to customize allowed file types:
```typescript
export const FILE_TYPE_CONFIGS = {
  images: {
    types: ['image/jpeg', 'image/png'],
    extensions: ['.jpg', '.jpeg', '.png'],
    maxSize: 10 * 1024 * 1024, // 10MB
  },
  // Add more categories...
};
```

## Setup Instructions

1. **Run Database Migration**:
   ```bash
   cd frontend
   npm run db:init
   ```

2. **Create Storage Buckets**:
   Run the Edge Function to set up storage:
   ```bash
   supabase functions deploy setup-storage
   supabase functions invoke setup-storage
   ```

3. **Apply Storage Policies**:
   The Edge Function will output SQL policies to apply in Supabase Dashboard.

4. **Add to Navigation**:
   The file manager is already added to the sidebar at `/dashboard/files`.

## Best Practices

1. **File Organization**: Use the `path` option to organize files into folders
2. **Metadata**: Store additional context in metadata for better searchability
3. **Tags**: Use tags for cross-folder categorization
4. **Cleanup**: Implement periodic cleanup for temp-uploads bucket
5. **Monitoring**: Track upload failures and storage usage

## Troubleshooting

### Common Issues

1. **Upload Fails with 413 Error**
   - File exceeds Supabase's request size limit
   - Solution: Reduce file size or use chunked upload

2. **Permission Denied**
   - Storage policies not properly configured
   - Solution: Check RLS policies in Supabase Dashboard

3. **File Not Found After Upload**
   - Database transaction failed after storage upload
   - Solution: Check Supabase logs for database errors

### Debug Mode
Enable debug logging in the service:
```typescript
const uploadService = new FileUploadService();
// Add console logs in service methods for debugging
```