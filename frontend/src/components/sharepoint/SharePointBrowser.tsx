'use client'

import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  Folder, 
  ChevronRight, 
  Download, 
  Upload, 
  Trash2, 
  Share2, 
  Search,
  Grid,
  List,
  RefreshCw,
  FolderPlus,
  Home,
  AlertCircle,
  FileText
} from 'lucide-react'
import { SharePointService, SharePointFile, SharePointFolder, SharePointSite, SharePointDrive } from '@/lib/services/sharepoint'
import { createClient } from '@/lib/supabase/browser'
import { useRouter } from 'next/navigation'
import SharePointUploader from './SharePointUploader'
import FilePermissions from './FilePermissions'
import { formatBytes, formatDate } from '@/lib/utils'

interface SharePointBrowserProps {
  mode: 'sharepoint' | 'onedrive'
  onFileSelect?: (file: SharePointFile) => void
}

export default function SharePointBrowser({ mode, onFileSelect }: SharePointBrowserProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<(SharePointFile | SharePointFolder)[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set())
  const [sites, setSites] = useState<SharePointSite[]>([])
  const [drives, setDrives] = useState<SharePointDrive[]>([])
  const [currentSite, setCurrentSite] = useState<SharePointSite | null>(null)
  const [currentDrive, setCurrentDrive] = useState<SharePointDrive | null>(null)
  const [currentPath, setCurrentPath] = useState<string[]>([])
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [searchQuery, setSearchQuery] = useState('')
  const [showUploader, setShowUploader] = useState(false)
  const [showPermissions, setShowPermissions] = useState(false)
  const [selectedItemForPermissions, setSelectedItemForPermissions] = useState<SharePointFile | SharePointFolder | null>(null)
  const [sharePointService, setSharePointService] = useState<SharePointService | null>(null)
  
  const router = useRouter()
  const supabase = createClient()

  // Initialize service
  useEffect(() => {
    async function initializeService() {
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser()
        if (authError || !user) {
          router.push('/login')
          return
        }

        // Get encryption key and refresh configs from environment
        const encryptionKey = process.env.NEXT_PUBLIC_ENCRYPTION_KEY || 'default-encryption-key'
        const refreshConfigs = {
          microsoft: {
            clientId: process.env.NEXT_PUBLIC_ENTRA_CLIENT_ID,
            clientSecret: process.env.ENTRA_CLIENT_SECRET,
            tenantId: process.env.NEXT_PUBLIC_ENTRA_TENANT_ID,
            redirectUri: `${window.location.origin}/api/auth/callback/microsoft`
          }
        }

        const service = new SharePointService(user.id, encryptionKey, refreshConfigs)
        setSharePointService(service)

        // Load initial data based on mode
        if (mode === 'onedrive') {
          await loadOneDriveRoot(service)
        } else {
          await loadSites(service)
        }
      } catch (error) {
        console.error('Failed to initialize:', error)
        setError('Failed to initialize SharePoint service')
      } finally {
        setLoading(false)
      }
    }

    initializeService()
  }, [mode, router, supabase.auth])

  const loadSites = async (service: SharePointService) => {
    try {
      setLoading(true)
      const sitesData = await service.getSites()
      setSites(sitesData)
      setCurrentPath([])
    } catch (error) {
      console.error('Failed to load sites:', error)
      setError('Failed to load SharePoint sites')
    } finally {
      setLoading(false)
    }
  }

  const loadOneDriveRoot = async (service: SharePointService) => {
    try {
      setLoading(true)
      const drive = await service.getMyDrive()
      setCurrentDrive(drive)
      const items = await service.getMyDriveRoot()
      setItems(items)
      setCurrentPath(['OneDrive'])
    } catch (error) {
      console.error('Failed to load OneDrive:', error)
      setError('Failed to load OneDrive')
    } finally {
      setLoading(false)
    }
  }

  const loadDrives = async (site: SharePointSite) => {
    if (!sharePointService) return
    
    try {
      setLoading(true)
      const drivesData = await sharePointService.getSiteDrives(site.id)
      setDrives(drivesData)
      setCurrentSite(site)
      setCurrentPath([site.displayName])
    } catch (error) {
      console.error('Failed to load drives:', error)
      setError('Failed to load site drives')
    } finally {
      setLoading(false)
    }
  }

  const loadItems = async (drive: SharePointDrive, folderId?: string) => {
    if (!sharePointService) return
    
    try {
      setLoading(true)
      const itemsData = await sharePointService.listItems(drive.id, folderId)
      setItems(itemsData)
      setCurrentDrive(drive)
      
      if (!folderId) {
        setCurrentPath(currentSite ? [currentSite.displayName, drive.name] : [drive.name])
      }
    } catch (error) {
      console.error('Failed to load items:', error)
      setError('Failed to load items')
    } finally {
      setLoading(false)
    }
  }

  const navigateToFolder = async (folder: SharePointFolder) => {
    if (!sharePointService || !currentDrive) return
    
    try {
      setLoading(true)
      const itemsData = await sharePointService.listItems(currentDrive.id, folder.id)
      setItems(itemsData)
      setCurrentFolderId(folder.id)
      setCurrentPath([...currentPath, folder.name])
    } catch (error) {
      console.error('Failed to navigate to folder:', error)
      setError('Failed to navigate to folder')
    } finally {
      setLoading(false)
    }
  }

  const navigateToBreadcrumb = async (index: number) => {
    if (!sharePointService) return
    
    if (index === 0 && mode === 'sharepoint' && sites.length > 0) {
      // Go back to sites list
      setCurrentSite(null)
      setCurrentDrive(null)
      setItems([])
      setDrives([])
      setCurrentPath([])
      setCurrentFolderId(null)
      return
    }

    if (index === 1 && currentSite && drives.length > 0) {
      // Go back to drives list
      setCurrentDrive(null)
      setItems([])
      setCurrentPath([currentSite.displayName])
      setCurrentFolderId(null)
      return
    }

    // Navigate to a specific folder in the path
    // This would require keeping track of folder IDs in the path
    // For now, just refresh the current location
    if (currentDrive) {
      await loadItems(currentDrive, currentFolderId || undefined)
    }
  }

  const handleDownload = async (file: SharePointFile) => {
    if (!sharePointService || !currentDrive) return
    
    try {
      const blob = await sharePointService.downloadFile(currentDrive.id, file.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = file.name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error('Failed to download file:', error)
      setError('Failed to download file')
    }
  }

  const handleDelete = async () => {
    if (!sharePointService || !currentDrive || selectedItems.size === 0) return
    
    const confirmed = confirm(`Are you sure you want to delete ${selectedItems.size} item(s)?`)
    if (!confirmed) return
    
    try {
      setLoading(true)
      
      for (const itemId of selectedItems) {
        await sharePointService.deleteItem(currentDrive.id, itemId)
      }
      
      setSelectedItems(new Set())
      await loadItems(currentDrive, currentFolderId || undefined)
    } catch (error) {
      console.error('Failed to delete items:', error)
      setError('Failed to delete items')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateFolder = async () => {
    if (!sharePointService || !currentDrive) return
    
    const folderName = prompt('Enter folder name:')
    if (!folderName) return
    
    try {
      setLoading(true)
      await sharePointService.createFolder(currentDrive.id, currentFolderId, folderName)
      await loadItems(currentDrive, currentFolderId || undefined)
    } catch (error) {
      console.error('Failed to create folder:', error)
      setError('Failed to create folder')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = async () => {
    if (!sharePointService || !searchQuery.trim()) return
    
    try {
      setLoading(true)
      const results = await sharePointService.search(searchQuery, mode === 'onedrive' ? 'myDrive' : 'all')
      // Convert search results to file/folder format
      setItems(results as any)
    } catch (error) {
      console.error('Failed to search:', error)
      setError('Failed to search')
    } finally {
      setLoading(false)
    }
  }

  const isFolder = (item: SharePointFile | SharePointFolder): item is SharePointFolder => {
    return 'folder' in item && item.folder !== undefined
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-semibold text-white">
              {mode === 'onedrive' ? 'OneDrive' : 'SharePoint'} Explorer
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'grid' ? 'bg-purple-600/20 text-purple-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Grid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-lg transition-colors ${
                  viewMode === 'list' ? 'bg-purple-600/20 text-purple-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search files..."
                className="w-64 px-4 py-2 pl-10 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
              />
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
            </div>
            
            <button
              onClick={() => currentDrive && loadItems(currentDrive, currentFolderId || undefined)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => navigateToBreadcrumb(0)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <Home className="w-4 h-4" />
          </button>
          {currentPath.map((path, index) => (
            <div key={index} className="flex items-center gap-2">
              <ChevronRight className="w-4 h-4 text-gray-600" />
              <button
                onClick={() => navigateToBreadcrumb(index + 1)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                {path}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      {(currentDrive || mode === 'onedrive') && (
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-4 py-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowUploader(true)}
              className="px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            
            <button
              onClick={handleCreateFolder}
              className="px-3 py-1.5 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
            >
              <FolderPlus className="w-4 h-4" />
              New Folder
            </button>
            
            {selectedItems.size > 0 && (
              <>
                <div className="h-6 w-px bg-white/10 mx-2" />
                
                <button
                  onClick={handleDelete}
                  className="px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg hover:bg-red-600/30 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedItems.size})
                </button>
                
                {selectedItems.size === 1 && (
                  <button
                    onClick={() => {
                      const item = items.find(i => selectedItems.has(i.id))
                      if (item) {
                        setSelectedItemForPermissions(item)
                        setShowPermissions(true)
                      }
                    }}
                    className="px-3 py-1.5 bg-white/10 text-gray-300 rounded-lg hover:bg-white/20 transition-colors flex items-center gap-2"
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto mb-4" />
              <p className="text-gray-400">Loading...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-4" />
              <p className="text-red-400">{error}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Sites View */}
            {mode === 'sharepoint' && !currentSite && sites.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {sites.map((site) => (
                  <motion.div
                    key={site.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => loadDrives(site)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                        <Folder className="w-5 h-5 text-purple-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{site.displayName}</h3>
                        <p className="text-gray-400 text-sm truncate">{site.name}</p>
                      </div>
                    </div>
                    {site.description && (
                      <p className="text-gray-500 text-sm line-clamp-2">{site.description}</p>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Drives View */}
            {currentSite && !currentDrive && drives.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {drives.map((drive) => (
                  <motion.div
                    key={drive.id}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                    onClick={() => loadItems(drive)}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 bg-blue-600/20 rounded-lg flex items-center justify-center">
                        <Folder className="w-5 h-5 text-blue-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-white font-medium truncate">{drive.name}</h3>
                        <p className="text-gray-400 text-sm">{drive.driveType}</p>
                      </div>
                    </div>
                    {drive.quota && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-400 mb-1">
                          <span>Used</span>
                          <span>{formatBytes(drive.quota.used)} / {formatBytes(drive.quota.total)}</span>
                        </div>
                        <div className="w-full bg-white/10 rounded-full h-2">
                          <div 
                            className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                            style={{ width: `${(drive.quota.used / drive.quota.total) * 100}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {/* Files and Folders View */}
            {(currentDrive || mode === 'onedrive') && items.length > 0 && (
              viewMode === 'grid' ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {items.map((item) => {
                    const selected = selectedItems.has(item.id)
                    const folder = isFolder(item)
                    
                    return (
                      <motion.div
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className={`bg-white/5 backdrop-blur-xl border rounded-xl p-4 transition-all cursor-pointer ${
                          selected ? 'border-purple-500 bg-purple-600/10' : 'border-white/10 hover:bg-white/10'
                        }`}
                        onClick={(e) => {
                          if (e.shiftKey || e.ctrlKey || e.metaKey) {
                            const newSelected = new Set(selectedItems)
                            if (selected) {
                              newSelected.delete(item.id)
                            } else {
                              newSelected.add(item.id)
                            }
                            setSelectedItems(newSelected)
                          } else if (folder) {
                            navigateToFolder(item)
                          } else {
                            onFileSelect?.(item as SharePointFile)
                          }
                        }}
                      >
                        <div className="flex flex-col items-center text-center">
                          <div className="w-12 h-12 mb-2">
                            {folder ? (
                              <Folder className="w-full h-full text-blue-400" />
                            ) : (
                              <FileText className="w-full h-full text-gray-400" />
                            )}
                          </div>
                          <p className="text-white text-sm font-medium truncate w-full">{item.name}</p>
                          <p className="text-gray-500 text-xs mt-1">
                            {folder ? `${item.folder.childCount} items` : formatBytes((item as SharePointFile).size || 0)}
                          </p>
                        </div>
                        
                        {!folder && (
                          <div className="mt-2 flex justify-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation()
                                handleDownload(item as SharePointFile)
                              }}
                              className="p-1.5 hover:bg-white/10 rounded transition-colors"
                            >
                              <Download className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        )}
                      </motion.div>
                    )
                  })}
                </div>
              ) : (
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left p-4 text-gray-400 font-medium">Name</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Modified</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Size</th>
                        <th className="text-left p-4 text-gray-400 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item) => {
                        const selected = selectedItems.has(item.id)
                        const folder = isFolder(item)
                        
                        return (
                          <tr
                            key={item.id}
                            className={`border-b border-white/5 transition-colors cursor-pointer ${
                              selected ? 'bg-purple-600/10' : 'hover:bg-white/5'
                            }`}
                            onClick={(e) => {
                              if (e.shiftKey || e.ctrlKey || e.metaKey) {
                                const newSelected = new Set(selectedItems)
                                if (selected) {
                                  newSelected.delete(item.id)
                                } else {
                                  newSelected.add(item.id)
                                }
                                setSelectedItems(newSelected)
                              } else if (folder) {
                                navigateToFolder(item)
                              } else {
                                onFileSelect?.(item as SharePointFile)
                              }
                            }}
                          >
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {folder ? (
                                  <Folder className="w-5 h-5 text-blue-400" />
                                ) : (
                                  <FileText className="w-5 h-5 text-gray-400" />
                                )}
                                <span className="text-white">{item.name}</span>
                              </div>
                            </td>
                            <td className="p-4 text-gray-400 text-sm">
                              {formatDate(item.lastModifiedDateTime)}
                            </td>
                            <td className="p-4 text-gray-400 text-sm">
                              {folder ? `${item.folder.childCount} items` : formatBytes((item as SharePointFile).size || 0)}
                            </td>
                            <td className="p-4">
                              <div className="flex items-center gap-2">
                                {!folder && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleDownload(item as SharePointFile)
                                    }}
                                    className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                  >
                                    <Download className="w-4 h-4 text-gray-400" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setSelectedItemForPermissions(item)
                                    setShowPermissions(true)
                                  }}
                                  className="p-1.5 hover:bg-white/10 rounded transition-colors"
                                >
                                  <Share2 className="w-4 h-4 text-gray-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )
            )}

            {/* Empty State */}
            {((currentDrive || mode === 'onedrive') && items.length === 0) && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <Folder className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg mb-2">No files or folders</p>
                  <p className="text-gray-500 text-sm">Upload files or create folders to get started</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Upload Modal */}
      {showUploader && currentDrive && sharePointService && (
        <SharePointUploader
          service={sharePointService}
          driveId={currentDrive.id}
          parentId={currentFolderId}
          onClose={() => setShowUploader(false)}
          onUploadComplete={() => {
            setShowUploader(false)
            loadItems(currentDrive, currentFolderId || undefined)
          }}
        />
      )}

      {/* Permissions Modal */}
      {showPermissions && selectedItemForPermissions && currentDrive && sharePointService && (
        <FilePermissions
          service={sharePointService}
          driveId={currentDrive.id}
          item={selectedItemForPermissions}
          onClose={() => {
            setShowPermissions(false)
            setSelectedItemForPermissions(null)
          }}
        />
      )}
    </div>
  )
}

