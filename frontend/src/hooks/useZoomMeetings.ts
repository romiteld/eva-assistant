import { useState, useEffect, useCallback } from 'react'
import { ZoomMeetingService } from '@/lib/services/zoom-meetings'
import { zoomOAuth } from '@/lib/auth/zoom-oauth'
import type { ZoomMeeting, CreateMeetingRequest, UpdateMeetingRequest } from '@/lib/services/zoom-meetings'

export function useZoomMeetings() {
  const [meetingService] = useState(() => new ZoomMeetingService())
  const [meetings, setMeetings] = useState<ZoomMeeting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)

  // Check authentication status
  const checkAuth = useCallback(async () => {
    try {
      const authenticated = await zoomOAuth.isAuthenticated()
      setIsAuthenticated(authenticated)
      return authenticated
    } catch (err) {
      setError('Failed to check authentication')
      return false
    }
  }, [])

  // Load meetings
  const loadMeetings = useCallback(async (type: 'scheduled' | 'live' | 'upcoming' | 'upcoming_meetings' | 'previous_meetings' = 'scheduled') => {
    const authenticated = await checkAuth()
    if (!authenticated) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      
      const response = await meetingService.listMeetings({ type })
      setMeetings(response.meetings || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load meetings')
    } finally {
      setLoading(false)
    }
  }, [meetingService, checkAuth])

  // Create meeting
  const createMeeting = useCallback(async (meetingData: CreateMeetingRequest): Promise<ZoomMeeting> => {
    try {
      setError(null)
      
      const meeting = await meetingService.createMeeting(meetingData)
      
      // Refresh meetings list
      await loadMeetings()
      
      return meeting
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to create meeting'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService, loadMeetings])

  // Update meeting
  const updateMeeting = useCallback(async (meetingId: string, updates: UpdateMeetingRequest): Promise<void> => {
    try {
      setError(null)
      
      await meetingService.updateMeeting(meetingId, updates)
      
      // Refresh meetings list
      await loadMeetings()
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to update meeting'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService, loadMeetings])

  // Delete meeting
  const deleteMeeting = useCallback(async (meetingId: string): Promise<void> => {
    try {
      setError(null)
      
      await meetingService.deleteMeeting(meetingId)
      
      // Refresh meetings list
      await loadMeetings()
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to delete meeting'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService, loadMeetings])

  // Get meeting details
  const getMeeting = useCallback(async (meetingId: string): Promise<ZoomMeeting> => {
    try {
      setError(null)
      return await meetingService.getMeeting(meetingId)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to get meeting'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService])

  // Start meeting
  const startMeeting = useCallback(async (meetingId: string): Promise<string> => {
    try {
      setError(null)
      const result = await meetingService.startMeeting(meetingId)
      return result.start_url
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to start meeting'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService])

  // Get join URL
  const getJoinUrl = useCallback(async (meetingId: string): Promise<string> => {
    try {
      setError(null)
      const result = await meetingService.getJoinUrl(meetingId)
      return result.join_url
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to get join URL'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService])

  // Create instant meeting
  const createInstantMeeting = useCallback(async (topic: string): Promise<ZoomMeeting> => {
    try {
      setError(null)
      
      const meeting = await meetingService.createInstantMeeting(topic)
      
      // Refresh meetings list
      await loadMeetings()
      
      return meeting
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to create instant meeting'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService, loadMeetings])

  // Schedule meeting
  const scheduleMeeting = useCallback(async (
    topic: string,
    startTime: string,
    duration: number
  ): Promise<ZoomMeeting> => {
    try {
      setError(null)
      
      const meeting = await meetingService.scheduleMeeting(topic, startTime, duration)
      
      // Refresh meetings list
      await loadMeetings()
      
      return meeting
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to schedule meeting'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService, loadMeetings])

  // Get meeting status
  const getMeetingStatus = useCallback(async (meetingId: string) => {
    try {
      setError(null)
      return await meetingService.getMeetingStatus(meetingId)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to get meeting status'
      setError(error)
      throw new Error(error)
    }
  }, [meetingService])

  // OAuth actions
  const connectZoom = useCallback(async () => {
    try {
      setError(null)
      const authUrl = zoomOAuth.generateAuthUrl()
      window.location.href = authUrl
    } catch (err) {
      setError('Failed to connect to Zoom')
    }
  }, [])

  const disconnectZoom = useCallback(async () => {
    try {
      setError(null)
      await zoomOAuth.revokeTokens()
      setIsAuthenticated(false)
      setMeetings([])
    } catch (err) {
      setError('Failed to disconnect from Zoom')
    }
  }, [])

  // Refresh meetings
  const refreshMeetings = useCallback(() => {
    loadMeetings()
  }, [loadMeetings])

  // Get upcoming meetings
  const getUpcomingMeetings = useCallback(() => {
    const now = new Date()
    return meetings.filter(meeting => {
      const startTime = new Date(meeting.start_time)
      return startTime > now
    }).sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
  }, [meetings])

  // Get live meetings
  const getLiveMeetings = useCallback(() => {
    return meetings.filter(meeting => meeting.status === 'started')
  }, [meetings])

  // Load initial data
  useEffect(() => {
    loadMeetings()
  }, [loadMeetings])

  return {
    // State
    meetings,
    loading,
    error,
    isAuthenticated,

    // Meeting actions
    createMeeting,
    updateMeeting,
    deleteMeeting,
    getMeeting,
    startMeeting,
    getJoinUrl,
    createInstantMeeting,
    scheduleMeeting,
    getMeetingStatus,

    // OAuth actions
    connectZoom,
    disconnectZoom,

    // Utility actions
    refreshMeetings,
    loadMeetings,

    // Computed values
    upcomingMeetings: getUpcomingMeetings(),
    liveMeetings: getLiveMeetings(),
  }
}