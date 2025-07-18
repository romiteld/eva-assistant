#!/usr/bin/env tsx

import { analyzeBundleSize, generatePerformanceReport, validateBundleSizes } from './bundle-analyzer'
import { writeFileSync } from 'fs'
import { join } from 'path'

// Generate comprehensive bundle report
async function generateBundleReport() {
  console.log('🔍 Analyzing bundle size...')
  
  const analysis = analyzeBundleSize()
  const validation = validateBundleSizes(analysis)
  const report = generatePerformanceReport()
  
  // Calculate potential savings
  const totalPotentialSavings = analysis.optimizationOpportunities.reduce(
    (total, opp) => total + opp.potentialSavings,
    0
  )
  
  const savingsPercentage = (totalPotentialSavings / analysis.totalSize) * 100
  
  console.log('\n📊 Bundle Analysis Results:')
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log(`📦 Total Bundle Size: ${analysis.totalSize} KB`)
  console.log(`✅ Validation: ${validation.passed ? 'PASSED' : 'FAILED'}`)
  console.log(`⚠️  Violations: ${validation.violations.length}`)
  console.log(`💰 Potential Savings: ${totalPotentialSavings} KB (${savingsPercentage.toFixed(1)}%)`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  
  // Show large pages
  console.log('\n🚨 Large Pages:')
  analysis.largePages.forEach((page, index) => {
    const status = page.size > 250 ? '🔴' : page.size > 200 ? '🟡' : '🟢'
    console.log(`${status} ${page.page}: ${page.size} KB (${page.firstLoadJS} KB first load)`)
  })
  
  // Show optimization opportunities
  console.log('\n🎯 Top Optimization Opportunities:')
  analysis.optimizationOpportunities
    .sort((a, b) => b.potentialSavings - a.potentialSavings)
    .slice(0, 5)
    .forEach((opp, index) => {
      const savingsPercent = Math.round((opp.potentialSavings / opp.currentSize) * 100)
      console.log(`${index + 1}. ${opp.component}: ${opp.currentSize} KB → ${opp.currentSize - opp.potentialSavings} KB (-${savingsPercent}%)`)
      console.log(`   Strategy: ${opp.strategy}`)
    })
  
  // Show violations
  if (validation.violations.length > 0) {
    console.log('\n❌ Bundle Size Violations:')
    validation.violations.forEach((violation, index) => {
      const icon = violation.severity === 'error' ? '🔴' : '🟡'
      console.log(`${icon} ${violation.type}: ${violation.current} KB (limit: ${violation.limit} KB)`)
    })
  }
  
  // Show recommendations
  console.log('\n💡 Recommendations:')
  analysis.recommendations.slice(0, 5).forEach((rec, index) => {
    console.log(`${index + 1}. ${rec}`)
  })
  
  // Save detailed report
  const reportPath = join(process.cwd(), 'bundle-analysis-report.md')
  writeFileSync(reportPath, report, 'utf8')
  console.log(`\n📄 Detailed report saved to: ${reportPath}`)
  
  // Generate CI/CD recommendations
  console.log('\n🔧 CI/CD Integration:')
  console.log('Add to your CI/CD pipeline:')
  console.log('```yaml')
  console.log('- name: Bundle Size Analysis')
  console.log('  run: |')
  console.log('    npm run bundle:report')
  console.log('    # Fail if bundle size exceeds limits')
  console.log(`    if [ ${validation.violations.filter(v => v.severity === 'error').length} -gt 0 ]; then`)
  console.log('      echo "❌ Bundle size limits exceeded!"')
  console.log('      exit 1')
  console.log('    fi')
  console.log('```')
  
  // Performance recommendations based on analysis
  console.log('\n⚡ Performance Recommendations:')
  if (analysis.framerMotionSize > 30) {
    console.log('• Consider reducing Framer Motion usage or implementing lazy loading')
  }
  if (analysis.lucideIconsSize > 25) {
    console.log('• Switch to OptimizedIcon component for better tree shaking')
  }
  if (analysis.largePages.some(p => p.size > 300)) {
    console.log('• Implement code splitting for pages larger than 300 KB')
  }
  if (totalPotentialSavings > 100) {
    console.log('• High potential for optimization - consider immediate action')
  }
  
  console.log('\n🚀 Next Steps:')
  console.log('1. Run `npm run build:analyze` to see detailed bundle composition')
  console.log('2. Implement code splitting for large pages')
  console.log('3. Switch to OptimizedIcon component')
  console.log('4. Add bundle size monitoring to CI/CD')
  console.log('5. Set up performance budgets')
  
  return {
    analysis,
    validation,
    report,
    totalPotentialSavings,
    savingsPercentage
  }
}

// Run if called directly
if (require.main === module) {
  generateBundleReport().catch(console.error)
}

export { generateBundleReport }