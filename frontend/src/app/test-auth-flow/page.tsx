'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/browser'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw,
  Mail,
  Shield,
  Cookie,
  Key,
  User,
  LogOut,
  Loader2,
  ChevronRight,
  ExternalLink,
  Clock,
  Zap,
  Database,
  Network
} from 'lucide-react'

interface TestResult {
  id: string
  name: string
  status: 'pending' | 'running' | 'passed' | 'failed' | 'warning'
  message: string
  details?: any
  timestamp?: number
}

interface AuthState {
  isAuthenticated: boolean
  user: any
  session: any
  cookies: { name: string; value: string }[]
  headers: Record<string, string>
}

export default function AuthTestFlow() {
  const [tests, setTests] = useState<TestResult[]>([
    { id: 'cookies', name: 'Browser Cookies', status: 'pending', message: 'Checking cookie support...' },
    { id: 'csrf', name: 'CSRF Token', status: 'pending', message: 'Verifying CSRF protection...' },
    { id: 'session', name: 'Session State', status: 'pending', message: 'Checking current session...' },
    { id: 'api-health', name: 'API Health', status: 'pending', message: 'Testing API connectivity...' },
    { id: 'db-connection', name: 'Database Connection', status: 'pending', message: 'Verifying database access...' },
    { id: 'auth-flow', name: 'Auth Flow Ready', status: 'pending', message: 'Checking auth configuration...' },
  ])
  
  const [authState, setAuthState] = useState<AuthState>({
    isAuthenticated: false,
    user: null,
    session: null,
    cookies: [],
    headers: {}
  })
  
  const [email, setEmail] = useState('')
  const [isTestingAuth, setIsTestingAuth] = useState(false)
  const [currentStep, setCurrentStep] = useState<'initial' | 'email-sent' | 'authenticated'>('initial')
  const [performanceMetrics, setPerformanceMetrics] = useState<Record<string, number>>({})

  // Update test status
  const updateTest = useCallback((id: string, updates: Partial<TestResult>) => {
    setTests(prev => prev.map(test => 
      test.id === id 
        ? { ...test, ...updates, timestamp: Date.now() }
        : test
    ))
  }, [])

  // Check browser cookies
  const checkCookies = useCallback(async () => {
    updateTest('cookies', { status: 'running' })
    
    try {
      // Test cookie setting
      document.cookie = 'test-cookie=test-value; path=/'
      const cookies = document.cookie.split(';').map(c => {
        const [name, value] = c.trim().split('=')
        return { name, value }
      })
      
      const hasTestCookie = cookies.some(c => c.name === 'test-cookie')
      
      if (hasTestCookie) {
        // Clean up test cookie
        document.cookie = 'test-cookie=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/'
        
        updateTest('cookies', {
          status: 'passed',
          message: 'Cookie support verified',
          details: { cookieCount: cookies.length }
        })
        
        setAuthState(prev => ({ ...prev, cookies }))
      } else {
        updateTest('cookies', {
          status: 'failed',
          message: 'Cookies are disabled or blocked'
        })
      }
    } catch (error) {
      updateTest('cookies', {
        status: 'failed',
        message: 'Cookie test failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }, [updateTest])

  // Check CSRF token
  const checkCSRFToken = useCallback(async () => {
    updateTest('csrf', { status: 'running' })
    
    try {
      const response = await fetch('/api/csrf')
      const data = await response.json()
      
      const csrfCookie = document.cookie
        .split(';')
        .find(c => c.trim().startsWith('csrf-token='))
      
      if (csrfCookie && data.token) {
        updateTest('csrf', {
          status: 'passed',
          message: 'CSRF protection active',
          details: { hasToken: true, tokenLength: data.token.length }
        })
      } else {
        updateTest('csrf', {
          status: 'warning',
          message: 'CSRF token not found',
          details: { cookieFound: !!csrfCookie, apiToken: !!data.token }
        })
      }
    } catch (error) {
      updateTest('csrf', {
        status: 'failed',
        message: 'CSRF check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }, [updateTest])

  // Check current session
  const checkSession = useCallback(async () => {
    updateTest('session', { status: 'running' })
    
    try {
      const startTime = performance.now()
      const supabase = createClient()
      const { data: { session }, error } = await supabase.auth.getSession()
      const endTime = performance.now()
      
      setPerformanceMetrics(prev => ({
        ...prev,
        sessionCheck: endTime - startTime
      }))
      
      if (error) {
        updateTest('session', {
          status: 'failed',
          message: 'Session check failed',
          details: { error: error.message }
        })
        return
      }
      
      if (session) {
        updateTest('session', {
          status: 'passed',
          message: 'Active session found',
          details: {
            userId: session.user.id,
            email: session.user.email,
            expiresAt: session.expires_at
          }
        })
        
        setAuthState(prev => ({
          ...prev,
          isAuthenticated: true,
          session,
          user: session.user
        }))
        setCurrentStep('authenticated')
      } else {
        updateTest('session', {
          status: 'warning',
          message: 'No active session',
          details: { authenticated: false }
        })
      }
    } catch (error) {
      updateTest('session', {
        status: 'failed',
        message: 'Session check error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }, [updateTest])

  // Check API health
  const checkAPIHealth = useCallback(async () => {
    updateTest('api-health', { status: 'running' })
    
    try {
      const startTime = performance.now()
      const response = await fetch('/api/health')
      const data = await response.json()
      const endTime = performance.now()
      
      setPerformanceMetrics(prev => ({
        ...prev,
        apiHealth: endTime - startTime
      }))
      
      if (response.ok && data.status === 'healthy') {
        updateTest('api-health', {
          status: 'passed',
          message: 'API is healthy',
          details: { 
            responseTime: `${(endTime - startTime).toFixed(2)}ms`,
            ...data 
          }
        })
      } else {
        updateTest('api-health', {
          status: 'failed',
          message: 'API health check failed',
          details: { status: response.status, data }
        })
      }
    } catch (error) {
      updateTest('api-health', {
        status: 'failed',
        message: 'Cannot connect to API',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }, [updateTest])

  // Check database connection
  const checkDatabase = useCallback(async () => {
    updateTest('db-connection', { status: 'running' })
    
    try {
      const startTime = performance.now()
      const response = await fetch('/api/health/database')
      const data = await response.json()
      const endTime = performance.now()
      
      setPerformanceMetrics(prev => ({
        ...prev,
        dbConnection: endTime - startTime
      }))
      
      if (response.ok && data.connected) {
        updateTest('db-connection', {
          status: 'passed',
          message: 'Database connected',
          details: {
            responseTime: `${(endTime - startTime).toFixed(2)}ms`,
            version: data.version
          }
        })
      } else {
        updateTest('db-connection', {
          status: 'failed',
          message: 'Database connection failed',
          details: data
        })
      }
    } catch (error) {
      updateTest('db-connection', {
        status: 'failed',
        message: 'Database check error',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }, [updateTest])

  // Check auth flow configuration
  const checkAuthFlow = useCallback(async () => {
    updateTest('auth-flow', { status: 'running' })
    
    try {
      const response = await fetch('/api/debug-auth')
      const data = await response.json()
      
      const hasRequiredConfig = 
        data.supabase?.url && 
        data.supabase?.configured &&
        data.cookies?.some((c: any) => c.name === 'csrf-token')
      
      if (hasRequiredConfig) {
        updateTest('auth-flow', {
          status: 'passed',
          message: 'Auth flow properly configured',
          details: {
            supabaseUrl: data.supabase?.url,
            cookieCount: data.cookies?.length
          }
        })
        
        setAuthState(prev => ({ ...prev, headers: data.headers || {} }))
      } else {
        updateTest('auth-flow', {
          status: 'failed',
          message: 'Auth configuration incomplete',
          details: data
        })
      }
    } catch (error) {
      updateTest('auth-flow', {
        status: 'failed',
        message: 'Auth flow check failed',
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      })
    }
  }, [updateTest])

  // Run all initial tests
  useEffect(() => {
    const runTests = async () => {
      await checkCookies()
      await checkCSRFToken()
      await checkSession()
      await checkAPIHealth()
      await checkDatabase()
      await checkAuthFlow()
    }
    
    runTests()
  }, [checkAPIHealth, checkAuthFlow, checkCSRFToken, checkCookies, checkDatabase, checkSession])

  // Test authentication flow
  const testAuthFlow = async () => {
    if (!email) return
    
    setIsTestingAuth(true)
    
    try {
      const supabase = createClient()
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/test-auth-flow`
        }
      })
      
      if (error) {
        throw error
      }
      
      setCurrentStep('email-sent')
    } catch (error) {
      console.error('Auth test failed:', error)
    } finally {
      setIsTestingAuth(false)
    }
  }

  // Test logout
  const testLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      
      setAuthState({
        isAuthenticated: false,
        user: null,
        session: null,
        cookies: [],
        headers: {}
      })
      
      setCurrentStep('initial')
      
      // Re-run tests after logout
      await checkSession()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  // Get status icon
  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return <CheckCircle className="w-5 h-5 text-green-400" />
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-400" />
      case 'warning':
        return <AlertCircle className="w-5 h-5 text-yellow-400" />
      case 'running':
        return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
      default:
        return <Clock className="w-5 h-5 text-gray-400" />
    }
  }

  // Get status color
  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'passed':
        return 'text-green-400'
      case 'failed':
        return 'text-red-400'
      case 'warning':
        return 'text-yellow-400'
      case 'running':
        return 'text-blue-400'
      default:
        return 'text-gray-400'
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-purple-950/20 to-slate-950 p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">
            Authentication Flow Test Suite
          </h1>
          <p className="text-gray-400">
            Comprehensive testing and debugging for EVA authentication system
          </p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Test Results */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6"
          >
            <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-purple-400" />
              System Health Checks
            </h2>
            
            <div className="space-y-3">
              {tests.map((test: TestResult) => (
                <motion.div
                  key={test.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-start gap-3 p-3 bg-white/5 rounded-lg"
                >
                  {getStatusIcon(test.status)}
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-white">{test.name}</h3>
                      {test.timestamp && (
                        <span className="text-xs text-gray-500">
                          {new Date(test.timestamp).toLocaleTimeString()}
                        </span>
                      )}
                    </div>
                    <p className={`text-sm mt-1 ${getStatusColor(test.status)}`}>
                      {test.message}
                    </p>
                    {test.details && (
                      <pre className="text-xs text-gray-400 mt-2 overflow-x-auto">
                        {JSON.stringify(test.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Performance Metrics */}
            {Object.keys(performanceMetrics).length > 0 && (
              <div className="mt-6 p-4 bg-white/5 rounded-lg">
                <h3 className="text-sm font-medium text-gray-400 mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4" />
                  Performance Metrics
                </h3>
                <div className="space-y-1">
                  {Object.entries(performanceMetrics).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500">{key}:</span>
                      <span className="text-white font-mono">{value.toFixed(2)}ms</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>

          {/* Auth State & Testing */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            {/* Current Auth State */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-purple-400" />
                Authentication State
              </h2>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <span className="text-gray-400">Status:</span>
                  <span className={`font-medium ${authState.isAuthenticated ? 'text-green-400' : 'text-gray-400'}`}>
                    {authState.isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
                  </span>
                </div>
                
                {authState.user && (
                  <>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">Email:</span>
                      <span className="text-white">{authState.user.email}</span>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                      <span className="text-gray-400">User ID:</span>
                      <span className="text-white font-mono text-xs">{authState.user.id}</span>
                    </div>
                  </>
                )}
                
                {authState.session && (
                  <div className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <span className="text-gray-400">Expires:</span>
                    <span className="text-white text-sm">
                      {new Date(authState.session.expires_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Auth Flow Testing */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Mail className="w-5 h-5 text-purple-400" />
                Test Authentication Flow
              </h2>
              
              <AnimatePresence mode="wait">
                {currentStep === 'initial' && !authState.isAuthenticated && (
                  <motion.div
                    key="initial"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <input
                      type="email"
                      value={email}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                      placeholder="Enter test email"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                    />
                    
                    <button
                      onClick={testAuthFlow}
                      disabled={!email || isTestingAuth}
                      className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      {isTestingAuth ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Sending Magic Link...
                        </>
                      ) : (
                        <>
                          Start Auth Test
                          <ChevronRight className="w-4 h-4" />
                        </>
                      )}
                    </button>
                  </motion.div>
                )}

                {currentStep === 'email-sent' && (
                  <motion.div
                    key="email-sent"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="text-center py-8"
                  >
                    <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Mail className="w-8 h-8 text-green-400" />
                    </div>
                    <h3 className="text-lg font-medium text-white mb-2">
                      Magic Link Sent!
                    </h3>
                    <p className="text-gray-400 mb-4">
                      Check your email and click the link to continue
                    </p>
                    <p className="text-sm text-gray-500">
                      Email sent to: {email}
                    </p>
                  </motion.div>
                )}

                {authState.isAuthenticated && (
                  <motion.div
                    key="authenticated"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="space-y-4"
                  >
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <p className="text-green-400 font-medium flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Authentication Successful!
                      </p>
                    </div>
                    
                    <button
                      onClick={testLogout}
                      className="w-full py-3 px-4 bg-red-600/80 hover:bg-red-600 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <LogOut className="w-4 h-4" />
                      Test Logout
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Debug Information */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <Cookie className="w-5 h-5 text-purple-400" />
                Debug Information
              </h2>
              
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Active Cookies</h3>
                  <div className="space-y-1">
                    {authState.cookies.length > 0 ? (
                      authState.cookies.map((cookie, i) => (
                        <div key={i} className="text-xs text-gray-300 font-mono bg-white/5 p-2 rounded">
                          {cookie.name}: {cookie.value ? '***' : '(empty)'}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No cookies found</p>
                    )}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">Security Headers</h3>
                  <div className="space-y-1">
                    {Object.entries(authState.headers).length > 0 ? (
                      Object.entries(authState.headers).slice(0, 5).map(([key, value]) => (
                        <div key={key} className="text-xs text-gray-300 font-mono bg-white/5 p-2 rounded">
                          {key}: {value}
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500">No headers available</p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Links */}
            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
              <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                <ExternalLink className="w-5 h-5 text-purple-400" />
                Quick Links
              </h2>
              
              <div className="space-y-2">
                <a
                  href="/login"
                  className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                >
                  <span>Login Page</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
                <a
                  href="/dashboard"
                  className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                >
                  <span>Dashboard (Protected)</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
                <a
                  href="/api/debug-auth"
                  target="_blank"
                  className="flex items-center justify-between p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-colors text-gray-300 hover:text-white"
                >
                  <span>Debug API Endpoint</span>
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}