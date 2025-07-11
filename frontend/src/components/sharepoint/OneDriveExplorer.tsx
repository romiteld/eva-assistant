'use client'

import SharePointBrowser from './SharePointBrowser'
import { SharePointFile } from '@/lib/services/sharepoint'

interface OneDriveExplorerProps {
  onFileSelect?: (file: SharePointFile) => void
}

export default function OneDriveExplorer({ onFileSelect }: OneDriveExplorerProps) {
  return (
    <SharePointBrowser 
      mode="onedrive" 
      onFileSelect={onFileSelect}
    />
  )
}