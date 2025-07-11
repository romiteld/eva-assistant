'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { 
  Cloud, 
  FolderOpen, 
  HardDrive,
  Search,
  Upload,
  Download,
  Share2,
  Settings,
  ChevronRight
} from 'lucide-react'
import SharePointBrowser from '@/components/sharepoint/SharePointBrowser'
import OneDriveExplorer from '@/components/sharepoint/OneDriveExplorer'
import { SharePointFile } from '@/lib/services/sharepoint'

export default function SharePointPage() {
  const [activeTab, setActiveTab] = useState<'sharepoint' | 'onedrive'>('sharepoint')
  const [selectedFile, setSelectedFile] = useState<SharePointFile | null>(null)

  const handleFileSelect = (file: SharePointFile) => {
    setSelectedFile(file)
    // You can add additional logic here, like opening a preview
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white mb-2">SharePoint & OneDrive</h1>
            <p className="text-gray-400">Access and manage your Microsoft 365 files</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button className="px-4 py-2 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Settings
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Total Storage</p>
                <p className="text-2xl font-bold text-white">1 TB</p>
              </div>
              <HardDrive className="w-8 h-8 text-purple-400" />
            </div>
            <div className="mt-3">
              <div className="w-full bg-white/10 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                  style={{ width: '35%' }}
                />
              </div>
              <p className="text-gray-400 text-xs mt-1">350 GB used</p>
            </div>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Recent Files</p>
                <p className="text-2xl font-bold text-white">24</p>
              </div>
              <FolderOpen className="w-8 h-8 text-blue-400" />
            </div>
            <p className="text-gray-500 text-xs mt-3">Modified in last 7 days</p>
          </div>

          <div className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-400 text-sm">Shared Items</p>
                <p className="text-2xl font-bold text-white">12</p>
              </div>
              <Share2 className="w-8 h-8 text-green-400" />
            </div>
            <p className="text-gray-500 text-xs mt-3">Files shared with others</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-6">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('sharepoint')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'sharepoint'
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <Cloud className="w-4 h-4" />
            SharePoint Sites
          </button>
          
          <button
            onClick={() => setActiveTab('onedrive')}
            className={`py-3 border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'onedrive'
                ? 'border-purple-500 text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
          >
            <HardDrive className="w-4 h-4" />
            OneDrive
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'sharepoint' ? (
          <SharePointBrowser mode="sharepoint" onFileSelect={handleFileSelect} />
        ) : (
          <OneDriveExplorer onFileSelect={handleFileSelect} />
        )}
      </div>

      {/* Quick Actions */}
      <div className="absolute bottom-6 right-6 flex flex-col gap-3">
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-14 h-14 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center shadow-lg hover:shadow-purple-500/25 transition-shadow"
        >
          <Upload className="w-6 h-6 text-white" />
        </motion.button>
      </div>
    </div>
  )
}