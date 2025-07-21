'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { 
  X, 
  Share2, 
  Link2, 
  Users, 
  Shield, 
  Eye, 
  Edit, 
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Mail,
  Clock,
  Lock
} from 'lucide-react'
import { SharePointService, SharePointFile, SharePointFolder, SharePointPermission } from '@/lib/services/sharepoint'

interface FilePermissionsProps {
  service: SharePointService
  driveId: string
  item: SharePointFile | SharePointFolder
  onClose: () => void
}

export default function FilePermissions({
  service,
  driveId,
  item,
  onClose
}: FilePermissionsProps) {
  const [permissions, setPermissions] = useState<SharePointPermission[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'people' | 'links'>('people')
  const [showAddPeople, setShowAddPeople] = useState(false)
  const [showCreateLink, setShowCreateLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Form states
  const [emails, setEmails] = useState('')
  const [permission, setPermission] = useState<'view' | 'edit'>('view')
  const [message, setMessage] = useState('')
  const [linkType, setLinkType] = useState<'view' | 'edit'>('view')
  const [linkScope, setLinkScope] = useState<'anonymous' | 'organization'>('organization')
  const [linkExpiration, setLinkExpiration] = useState('')
  const [linkPassword, setLinkPassword] = useState('')

  const loadPermissions = useCallback(async () => {
    try {
      setLoading(true)
      const perms = await service.getItemPermissions(driveId, item.id)
      setPermissions(perms)
    } catch (error) {
      console.error('Failed to load permissions:', error)
      setError('Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [service, driveId, item.id])

  useEffect(() => {
    loadPermissions()
  }, [loadPermissions])

  const handleGrantPermission = async () => {
    if (!emails.trim()) return

    try {
      setLoading(true)
      const emailList = emails.split(',').map(e => e.trim()).filter(e => e)
      const roles = permission === 'edit' ? ['write'] : ['read']
      
      await service.grantPermission(
        driveId,
        item.id,
        emailList,
        roles,
        message || undefined
      )
      
      await loadPermissions()
      setShowAddPeople(false)
      setEmails('')
      setMessage('')
    } catch (error) {
      console.error('Failed to grant permission:', error)
      setError('Failed to grant permission')
    } finally {
      setLoading(false)
    }
  }

  const handleCreateLink = async () => {
    try {
      setLoading(true)
      
      const result = await service.createShareLink(
        driveId,
        item.id,
        linkType,
        linkScope,
        linkExpiration || undefined,
        linkPassword || undefined
      )
      
      await loadPermissions()
      setShowCreateLink(false)
      
      // Copy link to clipboard
      if (result.link?.webUrl) {
        navigator.clipboard.writeText(result.link.webUrl)
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 2000)
      }
    } catch (error) {
      console.error('Failed to create share link:', error)
      setError('Failed to create share link')
    } finally {
      setLoading(false)
    }
  }

  const handleRemovePermission = async (permissionId: string) => {
    const confirmed = confirm('Are you sure you want to remove this permission?')
    if (!confirmed) return

    try {
      setLoading(true)
      await service.removePermission(driveId, item.id, permissionId)
      await loadPermissions()
    } catch (error) {
      console.error('Failed to remove permission:', error)
      setError('Failed to remove permission')
    } finally {
      setLoading(false)
    }
  }

  const copyLink = (url: string) => {
    navigator.clipboard.writeText(url)
    setLinkCopied(true)
    setTimeout(() => setLinkCopied(false), 2000)
  }

  const peoplePermissions = permissions.filter(p => p.grantedTo || p.grantedToIdentities)
  const linkPermissions = permissions.filter(p => p.link)

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Share2 className="w-6 h-6 text-purple-400" />
              <h2 className="text-xl font-semibold text-white">Manage Access</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
          
          <p className="text-gray-400">{item.name}</p>
        </div>

        {/* Tabs */}
        <div className="bg-white/5 backdrop-blur-xl border-b border-white/10 px-6">
          <div className="flex gap-6">
            <button
              onClick={() => setActiveTab('people')}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'people'
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                People
              </div>
            </button>
            
            <button
              onClick={() => setActiveTab('links')}
              className={`py-3 border-b-2 transition-colors ${
                activeTab === 'links'
                  ? 'border-purple-500 text-white'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Link2 className="w-4 h-4" />
                Links
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {loading && permissions.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-2" />
                <p className="text-red-400">{error}</p>
              </div>
            </div>
          ) : (
            <>
              {activeTab === 'people' && (
                <div className="space-y-4">
                  {/* Add People Button */}
                  {!showAddPeople && (
                    <button
                      onClick={() => setShowAddPeople(true)}
                      className="w-full px-4 py-3 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Users className="w-4 h-4" />
                      Add People
                    </button>
                  )}

                  {/* Add People Form */}
                  {showAddPeople && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Email addresses (comma-separated)
                        </label>
                        <input
                          type="text"
                          value={emails}
                          onChange={(e) => setEmails(e.target.value)}
                          placeholder="john@example.com, jane@example.com"
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Permission level
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setPermission('view')}
                            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                              permission === 'view'
                                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                            Can view
                          </button>
                          <button
                            onClick={() => setPermission('edit')}
                            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                              permission === 'edit'
                                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Edit className="w-4 h-4" />
                            Can edit
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Message (optional)
                        </label>
                        <textarea
                          value={message}
                          onChange={(e) => setMessage(e.target.value)}
                          placeholder="Add a message..."
                          rows={3}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
                        />
                      </div>
                      
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setShowAddPeople(false)}
                          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleGrantPermission}
                          disabled={!emails.trim() || loading}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Send Invite
                        </button>
                      </div>
                    </div>
                  )}

                  {/* People List */}
                  {peoplePermissions.map((perm) => (
                    <div key={perm.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-600/20 rounded-full flex items-center justify-center">
                            <Users className="w-5 h-5 text-purple-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {perm.grantedTo?.user?.displayName || 
                               perm.grantedToIdentities?.[0]?.user?.displayName || 
                               'Unknown User'}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {perm.grantedTo?.user?.email || 
                               perm.grantedToIdentities?.[0]?.user?.email || ''}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <span className="text-gray-400 text-sm">
                            {perm.roles.includes('write') ? 'Can edit' : 'Can view'}
                          </span>
                          <button
                            onClick={() => handleRemovePermission(perm.id)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'links' && (
                <div className="space-y-4">
                  {/* Create Link Button */}
                  {!showCreateLink && (
                    <button
                      onClick={() => setShowCreateLink(true)}
                      className="w-full px-4 py-3 bg-purple-600/20 text-purple-400 rounded-lg hover:bg-purple-600/30 transition-colors flex items-center justify-center gap-2"
                    >
                      <Link2 className="w-4 h-4" />
                      Create Link
                    </button>
                  )}

                  {/* Create Link Form */}
                  {showCreateLink && (
                    <div className="bg-white/5 border border-white/10 rounded-lg p-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Link type
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setLinkType('view')}
                            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                              linkType === 'view'
                                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Eye className="w-4 h-4" />
                            View only
                          </button>
                          <button
                            onClick={() => setLinkType('edit')}
                            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                              linkType === 'edit'
                                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Edit className="w-4 h-4" />
                            Can edit
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Who can access
                        </label>
                        <div className="flex gap-3">
                          <button
                            onClick={() => setLinkScope('organization')}
                            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                              linkScope === 'organization'
                                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Shield className="w-4 h-4" />
                            Organization
                          </button>
                          <button
                            onClick={() => setLinkScope('anonymous')}
                            className={`flex-1 px-3 py-2 rounded-lg border transition-colors flex items-center justify-center gap-2 ${
                              linkScope === 'anonymous'
                                ? 'bg-purple-600/20 border-purple-500 text-purple-400'
                                : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                            }`}
                          >
                            <Users className="w-4 h-4" />
                            Anyone
                          </button>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Expiration date (optional)
                        </label>
                        <input
                          type="datetime-local"
                          value={linkExpiration}
                          onChange={(e) => setLinkExpiration(e.target.value)}
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      
                      <div>
                        <label className="block text-sm font-medium text-gray-400 mb-2">
                          Password (optional)
                        </label>
                        <input
                          type="password"
                          value={linkPassword}
                          onChange={(e) => setLinkPassword(e.target.value)}
                          placeholder="Enter password"
                          className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
                        />
                      </div>
                      
                      <div className="flex justify-end gap-3">
                        <button
                          onClick={() => setShowCreateLink(false)}
                          className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleCreateLink}
                          disabled={loading}
                          className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                          {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                          Create Link
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Links List */}
                  {linkPermissions.map((perm) => (
                    <div key={perm.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-600/20 rounded-full flex items-center justify-center">
                            <Link2 className="w-5 h-5 text-blue-400" />
                          </div>
                          <div>
                            <p className="text-white font-medium">
                              {perm.link?.type === 'view' ? 'View link' : 'Edit link'}
                            </p>
                            <p className="text-gray-400 text-sm">
                              {perm.link?.scope === 'anonymous' ? 'Anyone with the link' : 'People in your organization'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => copyLink(perm.link?.webUrl || '')}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors flex items-center gap-2"
                          >
                            {linkCopied ? (
                              <Check className="w-4 h-4 text-green-400" />
                            ) : (
                              <Copy className="w-4 h-4 text-gray-400" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRemovePermission(perm.id)}
                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4 text-gray-400" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="bg-white/5 rounded-lg p-2 overflow-hidden">
                        <p className="text-gray-400 text-sm truncate">
                          {perm.link?.webUrl}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Toast Notification */}
        {linkCopied && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2"
          >
            <Check className="w-4 h-4" />
            Link copied to clipboard
          </motion.div>
        )}
      </motion.div>
    </div>
  )
}