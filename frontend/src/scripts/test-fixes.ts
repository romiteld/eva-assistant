#!/usr/bin/env ts-node
// Script to verify all fixes have been properly implemented

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

console.log('🔍 Testing Voice Agent Fixes Implementation...\n');

const results: { test: string; status: '✅' | '❌'; details?: string }[] = [];

// Test 1: Check Supabase singleton pattern
try {
  const browserPath = path.join(process.cwd(), 'src/lib/supabase/browser.ts');
  const browserContent = fs.readFileSync(browserPath, 'utf-8');
  
  if (browserContent.includes('let client: ReturnType<typeof createBrowserClient') && 
      browserContent.includes('if (client) {')) {
    results.push({ test: 'Supabase singleton pattern', status: '✅' });
  } else {
    results.push({ test: 'Supabase singleton pattern', status: '❌', details: 'Singleton not properly implemented' });
  }
} catch (error) {
  results.push({ test: 'Supabase singleton pattern', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Test 2: Check useToast hook fix
try {
  const conflictingToast = path.join(process.cwd(), 'src/hooks/use-toast.tsx');
  if (!fs.existsSync(conflictingToast)) {
    results.push({ test: 'useToast hook conflict resolved', status: '✅' });
  } else {
    results.push({ test: 'useToast hook conflict resolved', status: '❌', details: 'Conflicting use-toast.tsx still exists' });
  }
} catch (error) {
  results.push({ test: 'useToast hook conflict resolved', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Test 3: Check Gemini model update
try {
  const voicePath = path.join(process.cwd(), 'src/lib/services/voice.ts');
  const voiceContent = fs.readFileSync(voicePath, 'utf-8');
  
  if (voiceContent.includes('gemini-2.0-flash-exp')) {
    results.push({ test: 'Gemini model updated', status: '✅' });
  } else {
    results.push({ test: 'Gemini model updated', status: '❌', details: 'Old model name still in use' });
  }
} catch (error) {
  results.push({ test: 'Gemini model updated', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Test 4: Check AudioWorklet implementation
try {
  const workletPath = path.join(process.cwd(), 'public/audio-processor-worklet.js');
  const processorPath = path.join(process.cwd(), 'src/lib/audio/processor-worklet.ts');
  
  if (fs.existsSync(workletPath) && fs.existsSync(processorPath)) {
    const processorContent = fs.readFileSync(processorPath, 'utf-8');
    if (processorContent.includes('AudioWorkletNode')) {
      results.push({ test: 'AudioWorkletNode migration', status: '✅' });
    } else {
      results.push({ test: 'AudioWorkletNode migration', status: '❌', details: 'AudioWorkletNode not found in processor' });
    }
  } else {
    results.push({ test: 'AudioWorkletNode migration', status: '❌', details: 'Required files not found' });
  }
} catch (error) {
  results.push({ test: 'AudioWorkletNode migration', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Test 5: Check Gemini proxy implementation
try {
  const proxyPath = path.join(process.cwd(), 'src/app/api/gemini/route.ts');
  const voicePath = path.join(process.cwd(), 'src/lib/services/voice.ts');
  
  if (fs.existsSync(proxyPath)) {
    const voiceContent = fs.readFileSync(voicePath, 'utf-8');
    if (voiceContent.includes('/api/gemini/ws')) {
      results.push({ test: 'Gemini API proxy', status: '✅' });
    } else {
      results.push({ test: 'Gemini API proxy', status: '❌', details: 'Voice service not using proxy' });
    }
  } else {
    results.push({ test: 'Gemini API proxy', status: '❌', details: 'Proxy route not found' });
  }
} catch (error) {
  results.push({ test: 'Gemini API proxy', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Test 6: Check auth enforcement
try {
  const voiceAgentPath = path.join(process.cwd(), 'src/components/voice/VoiceAgent.tsx');
  const useVoiceAgentPath = path.join(process.cwd(), 'src/hooks/useVoiceAgent.ts');
  
  const voiceAgentContent = fs.readFileSync(voiceAgentPath, 'utf-8');
  const useVoiceAgentContent = fs.readFileSync(useVoiceAgentPath, 'utf-8');
  
  if (voiceAgentContent.includes('useAuth') && useVoiceAgentContent.includes('useAuth')) {
    results.push({ test: 'Auth enforcement', status: '✅' });
  } else {
    results.push({ test: 'Auth enforcement', status: '❌', details: 'Auth not properly enforced' });
  }
} catch (error) {
  results.push({ test: 'Auth enforcement', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Test 7: Check broadcast implementation
try {
  const broadcastPath = path.join(process.cwd(), 'src/lib/realtime/voice-broadcast.ts');
  const useVoiceAgentPath = path.join(process.cwd(), 'src/hooks/useVoiceAgent.ts');
  
  if (fs.existsSync(broadcastPath)) {
    const useVoiceAgentContent = fs.readFileSync(useVoiceAgentPath, 'utf-8');
    if (useVoiceAgentContent.includes('VoiceBroadcastService')) {
      results.push({ test: 'Realtime broadcast', status: '✅' });
    } else {
      results.push({ test: 'Realtime broadcast', status: '❌', details: 'Broadcast not integrated in hook' });
    }
  } else {
    results.push({ test: 'Realtime broadcast', status: '❌', details: 'Broadcast service not found' });
  }
} catch (error) {
  results.push({ test: 'Realtime broadcast', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Test 8: Check imports standardization
try {
  const searchPatterns = [
    { pattern: /from ['"]@\/lib\/supabase['"]/, name: 'old supabase import' },
    { pattern: /from ['"]@\/lib\/supabase\/client['"]/, name: 'old client import' },
  ];
  
  let foundOldImports = false;
  const srcDir = path.join(process.cwd(), 'src');
  
  function checkDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory() && !file.includes('node_modules')) {
        checkDirectory(fullPath);
      } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
        const content = fs.readFileSync(fullPath, 'utf-8');
        for (const { pattern } of searchPatterns) {
          if (pattern.test(content)) {
            foundOldImports = true;
            break;
          }
        }
      }
    }
  }
  
  checkDirectory(srcDir);
  
  if (!foundOldImports) {
    results.push({ test: 'Import standardization', status: '✅' });
  } else {
    results.push({ test: 'Import standardization', status: '❌', details: 'Old import patterns still found' });
  }
} catch (error) {
  results.push({ test: 'Import standardization', status: '❌', details: error instanceof Error ? error.message : 'Unknown error' });
}

// Print results
console.log('Test Results:');
console.log('=============\n');

results.forEach(({ test, status, details }) => {
  console.log(`${status} ${test}`);
  if (details) {
    console.log(`   ↳ ${details}`);
  }
});

const passed = results.filter(r => r.status === '✅').length;
const total = results.length;

console.log('\n=============');
console.log(`Summary: ${passed}/${total} tests passed`);

if (passed === total) {
  console.log('\n🎉 All fixes have been successfully implemented!');
  process.exit(0);
} else {
  console.log('\n⚠️  Some fixes are incomplete. Please review the failed tests.');
  process.exit(1);
}