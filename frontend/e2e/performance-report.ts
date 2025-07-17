import { writeFileSync } from 'fs'
import { join } from 'path'

export interface PerformanceReport {
  timestamp: string
  summary: {
    totalTests: number
    passed: number
    failed: number
    skipped: number
    duration: number
  }
  criticalIssues: Issue[]
  warnings: Issue[]
  metrics: {
    performance: PerformanceMetrics
    accessibility: AccessibilityMetrics
    compatibility: CompatibilityMetrics
    integration: IntegrationMetrics
    load: LoadMetrics
  }
  recommendations: string[]
}

interface Issue {
  severity: 'critical' | 'high' | 'medium' | 'low'
  category: string
  description: string
  affectedPages: string[]
  recommendation: string
}

interface PerformanceMetrics {
  averageLCP: number
  averageFCP: number
  averageTBT: number
  averageCLS: number
  averageTTI: number
  slowestPages: Array<{ path: string; metric: string; value: number }>
  bundleSize: number
  unusedJavaScript: number
}

interface AccessibilityMetrics {
  wcagCompliance: number
  violations: Array<{ rule: string; impact: string; count: number }>
  keyboardNavigable: boolean
  screenReaderCompatible: boolean
  colorContrastIssues: number
}

interface CompatibilityMetrics {
  browserSupport: Record<string, boolean>
  mobileSupport: Record<string, boolean>
  consoleErrors: Array<{ browser: string; error: string }>
  unsupportedFeatures: string[]
}

interface IntegrationMetrics {
  apiAvailability: Record<string, boolean>
  thirdPartyIntegrations: Record<string, { status: string; errors: string[] }>
  dataFlowErrors: string[]
  realTimeConnectionSuccess: boolean
}

interface LoadMetrics {
  concurrentUsers: number
  averageResponseTime: number
  successRate: number
  throughput: number
  peakMemoryUsage: number
  rateLimitingWorking: boolean
}

export class PerformanceReportGenerator {
  private report: PerformanceReport
  
  constructor() {
    this.report = {
      timestamp: new Date().toISOString(),
      summary: {
        totalTests: 0,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: 0
      },
      criticalIssues: [],
      warnings: [],
      metrics: {
        performance: {
          averageLCP: 0,
          averageFCP: 0,
          averageTBT: 0,
          averageCLS: 0,
          averageTTI: 0,
          slowestPages: [],
          bundleSize: 0,
          unusedJavaScript: 0
        },
        accessibility: {
          wcagCompliance: 0,
          violations: [],
          keyboardNavigable: true,
          screenReaderCompatible: true,
          colorContrastIssues: 0
        },
        compatibility: {
          browserSupport: {},
          mobileSupport: {},
          consoleErrors: [],
          unsupportedFeatures: []
        },
        integration: {
          apiAvailability: {},
          thirdPartyIntegrations: {},
          dataFlowErrors: [],
          realTimeConnectionSuccess: true
        },
        load: {
          concurrentUsers: 0,
          averageResponseTime: 0,
          successRate: 0,
          throughput: 0,
          peakMemoryUsage: 0,
          rateLimitingWorking: true
        }
      },
      recommendations: []
    }
  }
  
  addPerformanceMetrics(metrics: Partial<PerformanceMetrics>) {
    Object.assign(this.report.metrics.performance, metrics)
    this.analyzePerformanceIssues()
  }
  
  addAccessibilityMetrics(metrics: Partial<AccessibilityMetrics>) {
    Object.assign(this.report.metrics.accessibility, metrics)
    this.analyzeAccessibilityIssues()
  }
  
  addCompatibilityMetrics(metrics: Partial<CompatibilityMetrics>) {
    Object.assign(this.report.metrics.compatibility, metrics)
    this.analyzeCompatibilityIssues()
  }
  
  addIntegrationMetrics(metrics: Partial<IntegrationMetrics>) {
    Object.assign(this.report.metrics.integration, metrics)
    this.analyzeIntegrationIssues()
  }
  
  addLoadMetrics(metrics: Partial<LoadMetrics>) {
    Object.assign(this.report.metrics.load, metrics)
    this.analyzeLoadIssues()
  }
  
  private analyzePerformanceIssues() {
    const { performance } = this.report.metrics
    
    // Check Core Web Vitals
    if (performance.averageLCP > 4000) {
      this.report.criticalIssues.push({
        severity: 'critical',
        category: 'Performance',
        description: `Average LCP (${performance.averageLCP}ms) exceeds poor threshold`,
        affectedPages: performance.slowestPages.filter(p => p.metric === 'LCP').map(p => p.path),
        recommendation: 'Optimize largest contentful paint by lazy loading images, optimizing server response times, and removing render-blocking resources'
      })
    }
    
    if (performance.averageTBT > 600) {
      this.report.criticalIssues.push({
        severity: 'high',
        category: 'Performance',
        description: `Average Total Blocking Time (${performance.averageTBT}ms) indicates JavaScript blocking issues`,
        affectedPages: performance.slowestPages.filter(p => p.metric === 'TBT').map(p => p.path),
        recommendation: 'Break up long tasks, defer non-critical JavaScript, and use web workers for heavy computations'
      })
    }
    
    if (performance.bundleSize > 1024 * 1024) {
      this.report.warnings.push({
        severity: 'medium',
        category: 'Performance',
        description: `Bundle size (${(performance.bundleSize / 1024 / 1024).toFixed(2)}MB) is larger than recommended`,
        affectedPages: ['all'],
        recommendation: 'Implement code splitting, tree shaking, and dynamic imports to reduce bundle size'
      })
    }
    
    if (performance.unusedJavaScript > 50) {
      this.report.warnings.push({
        severity: 'medium',
        category: 'Performance',
        description: `${performance.unusedJavaScript}% of JavaScript is unused on initial load`,
        affectedPages: ['all'],
        recommendation: 'Remove unused code and implement better code splitting strategies'
      })
    }
  }
  
  private analyzeAccessibilityIssues() {
    const { accessibility } = this.report.metrics
    
    if (accessibility.wcagCompliance < 100) {
      this.report.criticalIssues.push({
        severity: 'critical',
        category: 'Accessibility',
        description: `WCAG 2.1 AA compliance is only ${accessibility.wcagCompliance}%`,
        affectedPages: ['multiple'],
        recommendation: 'Fix all accessibility violations to ensure compliance with WCAG 2.1 AA standards'
      })
    }
    
    accessibility.violations.forEach(violation => {
      if (violation.impact === 'critical' || violation.impact === 'serious') {
        this.report.criticalIssues.push({
          severity: 'high',
          category: 'Accessibility',
          description: `${violation.rule} violation found (${violation.count} instances)`,
          affectedPages: ['multiple'],
          recommendation: `Fix ${violation.rule} issues to improve accessibility`
        })
      }
    })
    
    if (accessibility.colorContrastIssues > 0) {
      this.report.warnings.push({
        severity: 'medium',
        category: 'Accessibility',
        description: `${accessibility.colorContrastIssues} color contrast issues found`,
        affectedPages: ['multiple'],
        recommendation: 'Ensure all text meets WCAG color contrast ratios (4.5:1 for normal text, 3:1 for large text)'
      })
    }
  }
  
  private analyzeCompatibilityIssues() {
    const { compatibility } = this.report.metrics
    
    const unsupportedBrowsers = Object.entries(compatibility.browserSupport)
      .filter(([_, supported]) => !supported)
      .map(([browser]) => browser)
    
    if (unsupportedBrowsers.length > 0) {
      this.report.criticalIssues.push({
        severity: 'high',
        category: 'Compatibility',
        description: `Application not fully supported in: ${unsupportedBrowsers.join(', ')}`,
        affectedPages: ['all'],
        recommendation: 'Add polyfills or fallbacks for unsupported features in these browsers'
      })
    }
    
    if (compatibility.consoleErrors.length > 0) {
      this.report.warnings.push({
        severity: 'medium',
        category: 'Compatibility',
        description: `${compatibility.consoleErrors.length} console errors detected across browsers`,
        affectedPages: ['multiple'],
        recommendation: 'Fix JavaScript errors to ensure consistent behavior across all browsers'
      })
    }
  }
  
  private analyzeIntegrationIssues() {
    const { integration } = this.report.metrics
    
    const failedAPIs = Object.entries(integration.apiAvailability)
      .filter(([_, available]) => !available)
      .map(([api]) => api)
    
    if (failedAPIs.length > 0) {
      this.report.criticalIssues.push({
        severity: 'critical',
        category: 'Integration',
        description: `APIs not responding: ${failedAPIs.join(', ')}`,
        affectedPages: ['all'],
        recommendation: 'Fix API endpoints or implement proper error handling and fallbacks'
      })
    }
    
    const failedIntegrations = Object.entries(integration.thirdPartyIntegrations)
      .filter(([_, { status }]) => status !== 'connected')
      .map(([name]) => name)
    
    if (failedIntegrations.length > 0) {
      this.report.warnings.push({
        severity: 'high',
        category: 'Integration',
        description: `Third-party integrations failing: ${failedIntegrations.join(', ')}`,
        affectedPages: ['dashboard'],
        recommendation: 'Check API keys, network connectivity, and integration configurations'
      })
    }
    
    if (!integration.realTimeConnectionSuccess) {
      this.report.criticalIssues.push({
        severity: 'high',
        category: 'Integration',
        description: 'WebSocket/real-time connections are failing',
        affectedPages: ['dashboard', 'tasks', 'orchestrator'],
        recommendation: 'Fix WebSocket server configuration and ensure proper connection handling'
      })
    }
  }
  
  private analyzeLoadIssues() {
    const { load } = this.report.metrics
    
    if (load.successRate < 95) {
      this.report.criticalIssues.push({
        severity: 'critical',
        category: 'Load Testing',
        description: `Success rate under load is only ${load.successRate}%`,
        affectedPages: ['all'],
        recommendation: 'Optimize server capacity, implement caching, and improve error handling'
      })
    }
    
    if (load.averageResponseTime > 3000) {
      this.report.warnings.push({
        severity: 'high',
        category: 'Load Testing',
        description: `Average response time (${load.averageResponseTime}ms) is too high under load`,
        affectedPages: ['all'],
        recommendation: 'Optimize database queries, implement caching, and consider horizontal scaling'
      })
    }
    
    if (load.peakMemoryUsage > 1024) {
      this.report.warnings.push({
        severity: 'medium',
        category: 'Load Testing',
        description: `Peak memory usage (${load.peakMemoryUsage}MB) indicates potential memory leaks`,
        affectedPages: ['dashboard'],
        recommendation: 'Profile memory usage, fix leaks, and implement proper cleanup in components'
      })
    }
  }
  
  generateRecommendations() {
    // Performance recommendations
    if (this.report.metrics.performance.averageLCP > 2500) {
      this.report.recommendations.push(
        '1. Implement lazy loading for below-the-fold images',
        '2. Optimize server response times with caching',
        '3. Use CDN for static assets',
        '4. Preload critical resources'
      )
    }
    
    // Accessibility recommendations
    if (this.report.metrics.accessibility.wcagCompliance < 100) {
      this.report.recommendations.push(
        '5. Add proper ARIA labels to all interactive elements',
        '6. Ensure all form fields have associated labels',
        '7. Implement skip navigation links',
        '8. Test with screen readers regularly'
      )
    }
    
    // Integration recommendations
    if (Object.keys(this.report.metrics.integration.apiAvailability).some(api => !this.report.metrics.integration.apiAvailability[api])) {
      this.report.recommendations.push(
        '9. Implement proper API error handling and retry logic',
        '10. Add health check endpoints for all services',
        '11. Create fallback UI states for API failures',
        '12. Monitor API performance and availability'
      )
    }
    
    // General recommendations
    this.report.recommendations.push(
      '13. Set up continuous performance monitoring',
      '14. Implement automated testing in CI/CD pipeline',
      '15. Regular security audits and dependency updates',
      '16. User experience testing with real users'
    )
  }
  
  generateHTMLReport(): string {
    this.generateRecommendations()
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>EVA Performance & Integration Test Report</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px;
      border-radius: 10px;
      margin-bottom: 30px;
    }
    h1 { margin: 0 0 10px 0; }
    .timestamp { opacity: 0.8; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 20px;
      margin-bottom: 30px;
    }
    .summary-card {
      background: white;
      padding: 20px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card h3 { margin: 0 0 10px 0; color: #667eea; }
    .summary-card .value { font-size: 2em; font-weight: bold; }
    .section {
      background: white;
      padding: 25px;
      border-radius: 8px;
      margin-bottom: 20px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .issue {
      border-left: 4px solid;
      padding: 15px;
      margin: 15px 0;
      background: #f8f9fa;
      border-radius: 4px;
    }
    .issue.critical { border-color: #dc3545; background: #f8d7da; }
    .issue.high { border-color: #fd7e14; background: #fff3cd; }
    .issue.medium { border-color: #ffc107; background: #fff9e6; }
    .issue.low { border-color: #28a745; background: #d4edda; }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .metric {
      padding: 15px;
      background: #f8f9fa;
      border-radius: 6px;
      border: 1px solid #dee2e6;
    }
    .metric-label { color: #6c757d; font-size: 0.9em; }
    .metric-value { font-size: 1.5em; font-weight: bold; color: #495057; }
    .recommendation {
      padding: 10px 15px;
      margin: 10px 0;
      background: #e7f3ff;
      border-left: 4px solid #0066cc;
      border-radius: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid #dee2e6;
    }
    th { background: #f8f9fa; font-weight: 600; }
    .badge {
      display: inline-block;
      padding: 4px 8px;
      border-radius: 4px;
      font-size: 0.85em;
      font-weight: 500;
    }
    .badge.success { background: #28a745; color: white; }
    .badge.warning { background: #ffc107; color: #333; }
    .badge.danger { background: #dc3545; color: white; }
  </style>
</head>
<body>
  <div class="header">
    <h1>EVA Performance & Integration Test Report</h1>
    <div class="timestamp">Generated: ${new Date(this.report.timestamp).toLocaleString()}</div>
  </div>
  
  <div class="summary">
    <div class="summary-card">
      <h3>Total Tests</h3>
      <div class="value">${this.report.summary.totalTests}</div>
    </div>
    <div class="summary-card">
      <h3>Passed</h3>
      <div class="value" style="color: #28a745">${this.report.summary.passed}</div>
    </div>
    <div class="summary-card">
      <h3>Failed</h3>
      <div class="value" style="color: #dc3545">${this.report.summary.failed}</div>
    </div>
    <div class="summary-card">
      <h3>Success Rate</h3>
      <div class="value">${((this.report.summary.passed / this.report.summary.totalTests) * 100).toFixed(1)}%</div>
    </div>
  </div>
  
  ${this.report.criticalIssues.length > 0 ? `
  <div class="section">
    <h2>🚨 Critical Issues (${this.report.criticalIssues.length})</h2>
    ${this.report.criticalIssues.map(issue => `
      <div class="issue ${issue.severity}">
        <h4>${issue.category}: ${issue.description}</h4>
        <p><strong>Affected Pages:</strong> ${issue.affectedPages.join(', ')}</p>
        <p><strong>Recommendation:</strong> ${issue.recommendation}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}
  
  <div class="section">
    <h2>📊 Performance Metrics</h2>
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">Average LCP</div>
        <div class="metric-value">${this.report.metrics.performance.averageLCP}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">Average FCP</div>
        <div class="metric-value">${this.report.metrics.performance.averageFCP}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">Average TBT</div>
        <div class="metric-value">${this.report.metrics.performance.averageTBT}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">Bundle Size</div>
        <div class="metric-value">${(this.report.metrics.performance.bundleSize / 1024).toFixed(2)}KB</div>
      </div>
    </div>
    
    ${this.report.metrics.performance.slowestPages.length > 0 ? `
    <h3>Slowest Pages</h3>
    <table>
      <tr><th>Page</th><th>Metric</th><th>Value</th></tr>
      ${this.report.metrics.performance.slowestPages.map(page => `
        <tr>
          <td>${page.path}</td>
          <td>${page.metric}</td>
          <td>${page.value}ms</td>
        </tr>
      `).join('')}
    </table>
    ` : ''}
  </div>
  
  <div class="section">
    <h2>♿ Accessibility</h2>
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">WCAG Compliance</div>
        <div class="metric-value">${this.report.metrics.accessibility.wcagCompliance}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Color Contrast Issues</div>
        <div class="metric-value">${this.report.metrics.accessibility.colorContrastIssues}</div>
      </div>
    </div>
    
    ${this.report.metrics.accessibility.violations.length > 0 ? `
    <h3>Violations</h3>
    <table>
      <tr><th>Rule</th><th>Impact</th><th>Count</th></tr>
      ${this.report.metrics.accessibility.violations.map(v => `
        <tr>
          <td>${v.rule}</td>
          <td><span class="badge ${v.impact === 'critical' ? 'danger' : 'warning'}">${v.impact}</span></td>
          <td>${v.count}</td>
        </tr>
      `).join('')}
    </table>
    ` : ''}
  </div>
  
  <div class="section">
    <h2>🔗 Integration Status</h2>
    <h3>API Availability</h3>
    <div class="metric-grid">
      ${Object.entries(this.report.metrics.integration.apiAvailability).map(([api, available]) => `
        <div class="metric">
          <div class="metric-label">${api}</div>
          <div class="metric-value">
            <span class="badge ${available ? 'success' : 'danger'}">${available ? 'Available' : 'Failing'}</span>
          </div>
        </div>
      `).join('')}
    </div>
    
    <h3>Third-party Integrations</h3>
    <table>
      <tr><th>Integration</th><th>Status</th><th>Errors</th></tr>
      ${Object.entries(this.report.metrics.integration.thirdPartyIntegrations).map(([name, data]) => `
        <tr>
          <td>${name}</td>
          <td><span class="badge ${data.status === 'connected' ? 'success' : 'danger'}">${data.status}</span></td>
          <td>${data.errors.join(', ') || 'None'}</td>
        </tr>
      `).join('')}
    </table>
  </div>
  
  <div class="section">
    <h2>📈 Load Testing Results</h2>
    <div class="metric-grid">
      <div class="metric">
        <div class="metric-label">Concurrent Users</div>
        <div class="metric-value">${this.report.metrics.load.concurrentUsers}</div>
      </div>
      <div class="metric">
        <div class="metric-label">Avg Response Time</div>
        <div class="metric-value">${this.report.metrics.load.averageResponseTime}ms</div>
      </div>
      <div class="metric">
        <div class="metric-label">Success Rate</div>
        <div class="metric-value">${this.report.metrics.load.successRate}%</div>
      </div>
      <div class="metric">
        <div class="metric-label">Throughput</div>
        <div class="metric-value">${this.report.metrics.load.throughput} req/s</div>
      </div>
    </div>
  </div>
  
  <div class="section">
    <h2>💡 Recommendations</h2>
    ${this.report.recommendations.map(rec => `
      <div class="recommendation">${rec}</div>
    `).join('')}
  </div>
  
  ${this.report.warnings.length > 0 ? `
  <div class="section">
    <h2>⚠️ Warnings (${this.report.warnings.length})</h2>
    ${this.report.warnings.map(warning => `
      <div class="issue ${warning.severity}">
        <h4>${warning.category}: ${warning.description}</h4>
        <p><strong>Affected Pages:</strong> ${warning.affectedPages.join(', ')}</p>
        <p><strong>Recommendation:</strong> ${warning.recommendation}</p>
      </div>
    `).join('')}
  </div>
  ` : ''}
</body>
</html>
    `
    
    return html
  }
  
  saveReport(outputPath: string = './test-results/performance-report.html') {
    const html = this.generateHTMLReport()
    writeFileSync(outputPath, html)
    console.log(`Performance report saved to: ${outputPath}`)
  }
}

// Export for use in tests
export const reportGenerator = new PerformanceReportGenerator()