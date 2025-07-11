'use client';

import React, { useState } from 'react';
import { FileUploader } from '@/components/files/FileUploader';
import { FileUploadResult } from '@/lib/services/file-upload';
import { FileText, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ResumeUploadProps {
  onResumeUploaded?: (resumeData: any) => void;
  className?: string;
}

export function ResumeUpload({ onResumeUploaded, className }: ResumeUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'processing' | 'success' | 'error'>('idle');
  const [processingMessage, setProcessingMessage] = useState('');
  const [parsedData, setParsedData] = useState<any>(null);

  const handleUploadComplete = async (results: FileUploadResult[]) => {
    if (results.length === 0) return;

    const resume = results[0];
    setUploadStatus('processing');
    setProcessingMessage('Analyzing resume...');

    try {
      // TODO: Call resume parser API
      // For now, simulate processing
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Simulated parsed data
      const mockParsedData = {
        fileId: resume.id,
        fileName: resume.fileName,
        candidate: {
          name: 'John Doe',
          email: 'john.doe@example.com',
          phone: '+1 (555) 123-4567',
          location: 'New York, NY',
        },
        experience: [
          {
            title: 'Senior Financial Advisor',
            company: 'Wealth Management Inc.',
            duration: '2019 - Present',
            description: 'Managed portfolio of high-net-worth clients...',
          },
        ],
        education: [
          {
            degree: 'MBA in Finance',
            institution: 'Harvard Business School',
            year: '2017',
          },
        ],
        skills: ['Portfolio Management', 'Financial Planning', 'Risk Assessment'],
        certifications: ['CFA', 'CFP'],
        matchScore: 85,
      };

      setParsedData(mockParsedData);
      setUploadStatus('success');
      setProcessingMessage('Resume successfully parsed!');
      
      if (onResumeUploaded) {
        onResumeUploaded(mockParsedData);
      }
    } catch (error) {
      setUploadStatus('error');
      setProcessingMessage('Failed to parse resume');
      console.error('Resume parsing error:', error);
    }
  };

  const handleUploadError = (errors: Array<{ file: string; error: string }>) => {
    setUploadStatus('error');
    setProcessingMessage(errors[0]?.error || 'Upload failed');
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setProcessingMessage('');
    setParsedData(null);
  };

  return (
    <div className={cn('space-y-6', className)}>
      {/* Upload area */}
      {uploadStatus === 'idle' && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4">Upload Resume</h3>
          <FileUploader
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
            options={{
              bucket: 'resumes',
              maxSize: 10 * 1024 * 1024, // 10MB
              allowedTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
              ],
            }}
            multiple={false}
            accept=".pdf,.doc,.docx"
          />
          <p className="mt-2 text-sm text-gray-400">
            Supported formats: PDF, DOC, DOCX (Max 10MB)
          </p>
        </div>
      )}

      {/* Processing status */}
      {(uploadStatus === 'processing' || uploadStatus === 'uploading') && (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-gray-300">{processingMessage}</p>
          </div>
        </div>
      )}

      {/* Success state with parsed data */}
      {uploadStatus === 'success' && parsedData && (
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <div className="flex items-center space-x-3">
              <CheckCircle className="h-6 w-6 text-green-500" />
              <div>
                <p className="font-medium text-green-400">{processingMessage}</p>
                <p className="text-sm text-gray-400">{parsedData.fileName}</p>
              </div>
            </div>
            <button
              onClick={resetUpload}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              Upload another
            </button>
          </div>

          {/* Parsed resume preview */}
          <div className="bg-gray-800/50 rounded-lg p-6 space-y-4">
            <h4 className="text-lg font-semibold text-white flex items-center justify-between">
              Candidate Information
              <span className="text-sm font-normal text-blue-400">
                Match Score: {parsedData.matchScore}%
              </span>
            </h4>
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-500">Name</p>
                <p className="text-gray-200">{parsedData.candidate.name}</p>
              </div>
              <div>
                <p className="text-gray-500">Email</p>
                <p className="text-gray-200">{parsedData.candidate.email}</p>
              </div>
              <div>
                <p className="text-gray-500">Phone</p>
                <p className="text-gray-200">{parsedData.candidate.phone}</p>
              </div>
              <div>
                <p className="text-gray-500">Location</p>
                <p className="text-gray-200">{parsedData.candidate.location}</p>
              </div>
            </div>

            <div>
              <p className="text-gray-500 mb-2">Skills</p>
              <div className="flex flex-wrap gap-2">
                {parsedData.skills.map((skill: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-blue-500/20 text-blue-400 text-xs rounded"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-gray-500 mb-2">Certifications</p>
              <div className="flex flex-wrap gap-2">
                {parsedData.certifications.map((cert: string, index: number) => (
                  <span
                    key={index}
                    className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded"
                  >
                    {cert}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error state */}
      {uploadStatus === 'error' && (
        <div className="flex items-center justify-between p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="flex items-center space-x-3">
            <AlertCircle className="h-6 w-6 text-red-500" />
            <p className="text-red-400">{processingMessage}</p>
          </div>
          <button
            onClick={resetUpload}
            className="text-sm text-gray-400 hover:text-gray-300"
          >
            Try again
          </button>
        </div>
      )}
    </div>
  );
}