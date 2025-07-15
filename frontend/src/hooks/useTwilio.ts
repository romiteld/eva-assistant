import { useState, useEffect, useCallback } from 'react'
import { createTwilioService } from '@/lib/services/twilio'
import type { 
  TwilioService,
  CallDetails,
  MessageDetails,
  PhoneNumberDetails,
  RecordingDetails,
  TranscriptionDetails,
  MakeCallOptions,
  SendSMSOptions
} from '@/lib/services/twilio'

export interface TwilioStats {
  calls: {
    total: number
    inbound: number
    outbound: number
    totalDuration: number
    totalCost: number
  }
  messages: {
    total: number
    sent: number
    received: number
    totalCost: number
  }
  recordings: {
    total: number
    totalDuration: number
    totalCost: number
  }
}

export interface ConferenceCall {
  conferenceName: string
  participants: Array<{
    phone: string
    callSid: string
    status: string
  }>
}

export interface IVRStep {
  id: string
  type: 'welcome' | 'menu' | 'gather' | 'record' | 'transfer' | 'hangup'
  message: string
  options?: {
    numDigits?: number
    timeout?: number
    finishOnKey?: string
    action?: string
    transferNumber?: string
  }
  nextSteps?: { [key: string]: string }
}

export interface IVRFlow {
  id: string
  name: string
  steps: IVRStep[]
  isActive: boolean
  phoneNumberSid?: string
}

export function useTwilio() {
  const [service, setService] = useState<TwilioService | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  
  // Data states
  const [phoneNumbers, setPhoneNumbers] = useState<PhoneNumberDetails[]>([])
  const [calls, setCalls] = useState<CallDetails[]>([])
  const [messages, setMessages] = useState<MessageDetails[]>([])
  const [recordings, setRecordings] = useState<RecordingDetails[]>([])
  const [stats, setStats] = useState<TwilioStats | null>(null)
  const [ivrFlows, setIvrFlows] = useState<IVRFlow[]>([])
  const [activeConferences, setActiveConferences] = useState<ConferenceCall[]>([])

  // Initialize Twilio service
  useEffect(() => {
    const initTwilio = async () => {
      try {
        setLoading(true)
        setError(null)
        
        // Check if we have configuration
        const response = await fetch('/api/twilio/config')
        if (!response.ok) {
          throw new Error('Twilio configuration not found')
        }
        
        const config = await response.json()
        const twilioService = createTwilioService(config)
        setService(twilioService)
        
        // Load initial data
        await Promise.all([
          loadPhoneNumbers(twilioService),
          loadRecentCalls(twilioService),
          loadRecentMessages(twilioService),
          loadIVRFlows()
        ])
        
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to initialize Twilio')
        console.error('Twilio initialization error:', err)
      } finally {
        setLoading(false)
      }
    }
    
    initTwilio()
  }, [])

  // Load phone numbers
  const loadPhoneNumbers = useCallback(async (twilioService: TwilioService) => {
    try {
      const numbers = await twilioService.listPhoneNumbers()
      setPhoneNumbers(numbers)
    } catch (err) {
      console.error('Error loading phone numbers:', err)
    }
  }, [])

  // Load recent calls
  const loadRecentCalls = useCallback(async (twilioService: TwilioService, limit = 50) => {
    try {
      const recentCalls = await twilioService.listCalls({ limit })
      setCalls(recentCalls)
    } catch (err) {
      console.error('Error loading calls:', err)
    }
  }, [])

  // Load recent messages
  const loadRecentMessages = useCallback(async (twilioService: TwilioService, limit = 50) => {
    try {
      const recentMessages = await twilioService.getMessages({ limit })
      setMessages(recentMessages)
    } catch (err) {
      console.error('Error loading messages:', err)
    }
  }, [])

  // Load IVR flows from API
  const loadIVRFlows = useCallback(async () => {
    try {
      const response = await fetch('/api/twilio/ivr')
      if (response.ok) {
        const flows = await response.json()
        setIvrFlows(flows)
      }
    } catch (err) {
      console.error('Error loading IVR flows:', err)
    }
  }, [])

  // Phone number management
  const purchasePhoneNumber = useCallback(async (options: {
    areaCode?: string
    contains?: string
    smsEnabled?: boolean
    voiceEnabled?: boolean
    mmsEnabled?: boolean
  }) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const number = await service.purchasePhoneNumber(options)
      setPhoneNumbers(prev => [...prev, number])
      return number
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to purchase phone number'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  const releasePhoneNumber = useCallback(async (phoneNumberSid: string) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      await service.releasePhoneNumber(phoneNumberSid)
      setPhoneNumbers(prev => prev.filter(n => n.sid !== phoneNumberSid))
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to release phone number'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  const updatePhoneNumber = useCallback(async (phoneNumberSid: string, updates: {
    friendlyName?: string
    voiceUrl?: string
    smsUrl?: string
    statusCallback?: string
  }) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const updated = await service.updatePhoneNumber(phoneNumberSid, updates)
      setPhoneNumbers(prev => 
        prev.map(n => n.sid === phoneNumberSid ? updated : n)
      )
      return updated
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to update phone number'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  // Call management
  const makeCall = useCallback(async (options: MakeCallOptions) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const call = await service.makeCall(options)
      setCalls(prev => [call, ...prev])
      return call
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to make call'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  const getCall = useCallback(async (callSid: string) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const call = await service.getCall(callSid)
      setCalls(prev => prev.map(c => c.sid === callSid ? call : c))
      return call
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to get call'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  const hangupCall = useCallback(async (callSid: string) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      await service.updateCall(callSid, { status: 'completed' })
      setCalls(prev => prev.map(c => 
        c.sid === callSid ? { ...c, status: 'completed' } : c
      ))
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to hang up call'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  // SMS management
  const sendSMS = useCallback(async (options: SendSMSOptions) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const message = await service.sendSMSEnhanced(options)
      setMessages(prev => [message, ...prev])
      return message
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to send SMS'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  const sendBulkSMS = useCallback(async (recipients: Array<{ to: string; body: string }>) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const results = await service.sendBulkSMS(recipients)
      // Refresh messages after bulk send
      await loadRecentMessages(service)
      return results
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to send bulk SMS'
      setError(error)
      throw new Error(error)
    }
  }, [service, loadRecentMessages])

  // Recording management
  const getRecording = useCallback(async (recordingSid: string) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const recording = await service.getRecording(recordingSid)
      setRecordings(prev => {
        const exists = prev.find(r => r.sid === recordingSid)
        if (exists) {
          return prev.map(r => r.sid === recordingSid ? recording : r)
        }
        return [...prev, recording]
      })
      return recording
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to get recording'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  const getRecordingUrl = useCallback(async (recordingSid: string, format: 'mp3' | 'wav' = 'mp3') => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      return await service.getRecordingUrl(recordingSid, format)
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to get recording URL'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  const deleteRecording = useCallback(async (recordingSid: string) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      await service.deleteRecording(recordingSid)
      setRecordings(prev => prev.filter(r => r.sid !== recordingSid))
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to delete recording'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  // Conference management
  const createConferenceCall = useCallback(async (options: {
    conferenceName: string
    participants: Array<{
      phone: string
      name: string
      role: 'interviewer' | 'candidate'
    }>
    record?: boolean
  }) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const conference = await service.createConferenceCall(options)
      setActiveConferences(prev => [...prev, conference])
      return conference
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to create conference call'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  // IVR management
  const createIVRFlow = useCallback(async (flow: Omit<IVRFlow, 'id'>) => {
    try {
      setError(null)
      const response = await fetch('/api/twilio/ivr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flow)
      })
      
      if (!response.ok) {
        throw new Error('Failed to create IVR flow')
      }
      
      const newFlow = await response.json()
      setIvrFlows(prev => [...prev, newFlow])
      return newFlow
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to create IVR flow'
      setError(error)
      throw new Error(error)
    }
  }, [])

  const updateIVRFlow = useCallback(async (flowId: string, updates: Partial<IVRFlow>) => {
    try {
      setError(null)
      const response = await fetch(`/api/twilio/ivr/${flowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      })
      
      if (!response.ok) {
        throw new Error('Failed to update IVR flow')
      }
      
      const updated = await response.json()
      setIvrFlows(prev => prev.map(f => f.id === flowId ? updated : f))
      return updated
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to update IVR flow'
      setError(error)
      throw new Error(error)
    }
  }, [])

  const deleteIVRFlow = useCallback(async (flowId: string) => {
    try {
      setError(null)
      const response = await fetch(`/api/twilio/ivr/${flowId}`, {
        method: 'DELETE'
      })
      
      if (!response.ok) {
        throw new Error('Failed to delete IVR flow')
      }
      
      setIvrFlows(prev => prev.filter(f => f.id !== flowId))
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to delete IVR flow'
      setError(error)
      throw new Error(error)
    }
  }, [])

  const activateIVRFlow = useCallback(async (flowId: string, phoneNumberSid: string) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      await service.setupIVRSystem(phoneNumberSid)
      
      // Mark flow as active
      setIvrFlows(prev => prev.map(f => ({
        ...f,
        isActive: f.id === flowId,
        phoneNumberSid: f.id === flowId ? phoneNumberSid : f.phoneNumberSid
      })))
      
      return true
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to activate IVR flow'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  // Analytics
  const loadStats = useCallback(async (startDate: Date, endDate: Date) => {
    if (!service) throw new Error('Twilio service not initialized')
    
    try {
      setError(null)
      const statistics = await service.getUsageStatistics(startDate, endDate)
      setStats(statistics)
      return statistics
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to load statistics'
      setError(error)
      throw new Error(error)
    }
  }, [service])

  // Refresh all data
  const refreshData = useCallback(async () => {
    if (!service) return
    
    try {
      setError(null)
      await Promise.all([
        loadPhoneNumbers(service),
        loadRecentCalls(service),
        loadRecentMessages(service),
        loadIVRFlows()
      ])
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Failed to refresh data'
      setError(error)
      throw new Error(error)
    }
  }, [service, loadPhoneNumbers, loadRecentCalls, loadRecentMessages, loadIVRFlows])

  return {
    // State
    loading,
    error,
    phoneNumbers,
    calls,
    messages,
    recordings,
    stats,
    ivrFlows,
    activeConferences,
    
    // Phone number management
    purchasePhoneNumber,
    releasePhoneNumber,
    updatePhoneNumber,
    
    // Call management
    makeCall,
    getCall,
    hangupCall,
    
    // SMS management
    sendSMS,
    sendBulkSMS,
    
    // Recording management
    getRecording,
    getRecordingUrl,
    deleteRecording,
    
    // Conference management
    createConferenceCall,
    
    // IVR management
    createIVRFlow,
    updateIVRFlow,
    deleteIVRFlow,
    activateIVRFlow,
    
    // Analytics
    loadStats,
    
    // Utilities
    refreshData,
    clearError: () => setError(null)
  }
}