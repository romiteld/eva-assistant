import { NextRequest, NextResponse } from 'next/server'
import { runIntegrationHealthTests } from '@/app/api/__tests__/integration-health-tester'

// GET /api/test/integration-health
export async function GET(request: NextRequest) {
  try {
    // Check for authentication or test environment
    const isTestEnvironment = process.env.NODE_ENV === 'development' || 
                            process.env.ALLOW_TEST_ENDPOINTS === 'true'
    
    if (!isTestEnvironment) {
      return NextResponse.json(
        { error: 'Test endpoints are disabled in production' },
        { status: 403 }
      )
    }

    // Get test parameters from query
    const searchParams = request.nextUrl.searchParams
    const testMode = searchParams.get('mode') as 'basic' | 'comprehensive' | 'stress' || 'comprehensive'
    const verbose = searchParams.get('verbose') === 'true'

    // Run integration tests
    const { results, report } = await runIntegrationHealthTests({
      testMode,
      verbose,
    })

    // Calculate overall system health
    const totalHealth = results.reduce((sum, r) => sum + r.overallHealth, 0) / results.length
    const criticalIssues = results.filter(r => r.status === 'failed').length

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      testMode,
      summary: {
        totalIntegrations: results.length,
        overallHealth: totalHealth,
        healthy: results.filter(r => r.status === 'healthy').length,
        degraded: results.filter(r => r.status === 'degraded').length,
        failed: results.filter(r => r.status === 'failed').length,
        criticalIssues,
      },
      results,
      report,
    })
  } catch (error) {
    console.error('Integration health test error:', error)
    
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}