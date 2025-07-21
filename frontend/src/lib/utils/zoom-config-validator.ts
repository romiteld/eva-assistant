/**
 * Zoom Configuration Validator
 * Validates Zoom integration setup and provides configuration recommendations
 */

interface ZoomConfigValidation {
  isValid: boolean;
  mode: 'server_to_server' | 'oauth' | 'unconfigured';
  issues: string[];
  recommendations: string[];
  missingVariables: string[];
  webhookUrl: string;
  summary: string;
}

export function validateZoomConfiguration(): ZoomConfigValidation {
  const issues: string[] = [];
  const recommendations: string[] = [];
  const missingVariables: string[] = [];

  // Check for environment variables
  const hasApiKey = !!process.env.ZOOM_API_KEY || !!process.env.NEXT_PUBLIC_ZOOM_API_KEY;
  const hasClientId = !!process.env.ZOOM_CLIENT_ID || !!process.env.NEXT_PUBLIC_ZOOM_CLIENT_ID;
  const hasClientSecret = !!process.env.ZOOM_CLIENT_SECRET;
  const hasAccountId = !!process.env.ZOOM_ACCOUNT_ID || !!process.env.NEXT_PUBLIC_ZOOM_ACCOUNT_ID;
  const hasWebhookSecret = !!process.env.ZOOM_WEBHOOK_SECRET_TOKEN;
  
  // Determine configuration mode
  let mode: 'server_to_server' | 'oauth' | 'unconfigured' = 'unconfigured';
  let isValid = false;

  if (hasApiKey && hasAccountId && hasClientId && hasClientSecret) {
    mode = 'server_to_server';
    isValid = true;
    recommendations.push('✅ Server-to-Server OAuth is properly configured (recommended)');
    
    if (!hasWebhookSecret) {
      recommendations.push('💡 Consider adding ZOOM_WEBHOOK_SECRET_TOKEN for webhook signature verification');
    } else {
      recommendations.push('✅ Webhook secret configured for secure webhook handling');
    }
  } else if (hasClientId && hasClientSecret) {
    mode = 'oauth';
    isValid = true;
    recommendations.push('✅ Traditional OAuth is configured');
    recommendations.push('💡 Consider upgrading to Server-to-Server OAuth by adding ZOOM_API_KEY and ZOOM_ACCOUNT_ID');
    
    if (!hasWebhookSecret) {
      issues.push('❌ ZOOM_WEBHOOK_SECRET_TOKEN is required for traditional OAuth webhook verification');
      missingVariables.push('ZOOM_WEBHOOK_SECRET_TOKEN');
    }
  } else {
    mode = 'unconfigured';
    isValid = false;
    issues.push('❌ Zoom integration is not properly configured');
  }

  // Check for missing variables based on mode
  if (mode === 'server_to_server') {
    if (!hasApiKey) {
      issues.push('❌ ZOOM_API_KEY is missing for Server-to-Server OAuth');
      missingVariables.push('ZOOM_API_KEY');
    }
    if (!hasAccountId) {
      issues.push('❌ ZOOM_ACCOUNT_ID is missing for Server-to-Server OAuth');
      missingVariables.push('ZOOM_ACCOUNT_ID');
    }
    if (!hasClientId) {
      issues.push('❌ ZOOM_CLIENT_ID is missing for Server-to-Server OAuth');
      missingVariables.push('ZOOM_CLIENT_ID');
    }
    if (!hasClientSecret) {
      issues.push('❌ ZOOM_CLIENT_SECRET is missing for Server-to-Server OAuth');
      missingVariables.push('ZOOM_CLIENT_SECRET');
    }
  } else if (mode === 'oauth') {
    if (!hasClientId) {
      issues.push('❌ ZOOM_CLIENT_ID is missing for OAuth');
      missingVariables.push('ZOOM_CLIENT_ID');
    }
    if (!hasClientSecret) {
      issues.push('❌ ZOOM_CLIENT_SECRET is missing for OAuth');
      missingVariables.push('ZOOM_CLIENT_SECRET');
    }
  } else {
    issues.push('❌ No Zoom authentication method configured');
    recommendations.push('🚀 To set up Server-to-Server OAuth (recommended):');
    recommendations.push('   1. Add ZOOM_API_KEY from your Zoom Marketplace app');
    recommendations.push('   2. Add ZOOM_ACCOUNT_ID from your Zoom account');
    recommendations.push('   3. Add ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET');
    recommendations.push('   4. Optionally add ZOOM_WEBHOOK_SECRET_TOKEN');
    
    recommendations.push('🔗 Or to set up traditional OAuth:');
    recommendations.push('   1. Add ZOOM_CLIENT_ID and ZOOM_CLIENT_SECRET');
    recommendations.push('   2. Add ZOOM_WEBHOOK_SECRET_TOKEN (required)');
    
    missingVariables.push('ZOOM_CLIENT_ID', 'ZOOM_CLIENT_SECRET');
  }

  // Generate summary
  let summary = '';
  if (isValid) {
    summary = `✅ Zoom integration is configured for ${mode.replace('_', '-to-')} OAuth`;
  } else {
    summary = `❌ Zoom integration requires configuration (${missingVariables.length} missing variables)`;
  }

  // Webhook URL
  const webhookUrl = process.env.ZOOM_WEBHOOK_URL || 'https://eva.thewell.solutions/api/webhooks/zoom';

  return {
    isValid,
    mode,
    issues,
    recommendations,
    missingVariables,
    webhookUrl,
    summary,
  };
}

/**
 * Print validation results to console
 */
export function printZoomConfigValidation(): void {
  const validation = validateZoomConfiguration();
  
  console.log('\n' + '='.repeat(60));
  console.log('🔍 ZOOM INTEGRATION CONFIGURATION VALIDATOR');
  console.log('='.repeat(60));
  
  console.log(`\n📊 Summary: ${validation.summary}`);
  console.log(`🔧 Mode: ${validation.mode.replace('_', '-to-').toUpperCase()}`);
  console.log(`🌐 Webhook URL: ${validation.webhookUrl}`);
  
  if (validation.issues.length > 0) {
    console.log('\n🚨 Issues Found:');
    validation.issues.forEach(issue => console.log(`  ${issue}`));
  }
  
  if (validation.recommendations.length > 0) {
    console.log('\n💡 Recommendations:');
    validation.recommendations.forEach(rec => console.log(`  ${rec}`));
  }
  
  if (validation.missingVariables.length > 0) {
    console.log('\n📝 Missing Environment Variables:');
    validation.missingVariables.forEach(variable => console.log(`  - ${variable}`));
    
    console.log('\n📋 Quick Setup Guide:');
    if (validation.mode === 'unconfigured') {
      console.log('  For Server-to-Server OAuth (recommended):');
      console.log('    ZOOM_API_KEY="your_api_key_here"');
      console.log('    ZOOM_ACCOUNT_ID="your_account_id"');
      console.log('    ZOOM_CLIENT_ID="your_client_id"');
      console.log('    ZOOM_CLIENT_SECRET="your_client_secret"');
      console.log('    ZOOM_WEBHOOK_SECRET_TOKEN="your_webhook_secret" # Optional');
      
      console.log('\n  For Traditional OAuth:');
      console.log('    ZOOM_CLIENT_ID="your_client_id"');
      console.log('    ZOOM_CLIENT_SECRET="your_client_secret"');
      console.log('    ZOOM_WEBHOOK_SECRET_TOKEN="your_webhook_secret" # Required');
    }
  }
  
  console.log('\n' + '='.repeat(60) + '\n');
}

/**
 * Get configuration for Zoom app creation
 */
export function getZoomAppConfig(): {
  appType: 'Server-to-Server OAuth' | 'OAuth';
  requiredScopes: string[];
  webhookEvents: string[];
  redirectUri?: string;
} {
  const validation = validateZoomConfiguration();
  
  const baseConfig = {
    requiredScopes: [
      'meeting:write',
      'meeting:read', 
      'user:read',
      'user:write',
      'recording:read',
      'recording:write'
    ],
    webhookEvents: [
      'meeting.started',
      'meeting.ended',
      'meeting.participant_joined',
      'meeting.participant_left',
      'recording.completed',
      'recording.transcript_completed'
    ]
  };
  
  if (validation.mode === 'server_to_server') {
    return {
      appType: 'Server-to-Server OAuth',
      ...baseConfig
    };
  } else {
    return {
      appType: 'OAuth',
      redirectUri: 'https://eva.thewell.solutions/api/auth/zoom/callback',
      ...baseConfig
    };
  }
}