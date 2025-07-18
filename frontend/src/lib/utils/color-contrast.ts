/**
 * Color contrast utilities for WCAG compliance
 * Validates color combinations across the EVA platform
 */

export interface ColorPair {
  foreground: string;
  background: string;
  label: string;
}

export interface ContrastResult {
  ratio: number;
  passes: {
    aa: boolean;
    aaa: boolean;
    aaLarge: boolean;
    aaaLarge: boolean;
  };
  level: 'fail' | 'aa' | 'aaa';
}

// Convert hex to RGB
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

// Convert RGB to relative luminance
function getLuminance(r: number, g: number, b: number): number {
  const [rs, gs, bs] = [r, g, b].map(c => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
}

// Calculate contrast ratio
export function getContrastRatio(color1: string, color2: string): number {
  const rgb1 = hexToRgb(color1);
  const rgb2 = hexToRgb(color2);
  
  if (!rgb1 || !rgb2) return 0;
  
  const lum1 = getLuminance(rgb1.r, rgb1.g, rgb1.b);
  const lum2 = getLuminance(rgb2.r, rgb2.g, rgb2.b);
  
  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);
  
  return (brightest + 0.05) / (darkest + 0.05);
}

// Check contrast compliance
export function checkContrast(foreground: string, background: string, isLargeText: boolean = false): ContrastResult {
  const ratio = getContrastRatio(foreground, background);
  
  const aa = isLargeText ? 3 : 4.5;
  const aaa = isLargeText ? 4.5 : 7;
  
  return {
    ratio: Math.round(ratio * 100) / 100,
    passes: {
      aa: ratio >= 4.5,
      aaa: ratio >= 7,
      aaLarge: ratio >= 3,
      aaaLarge: ratio >= 4.5
    },
    level: ratio >= 7 ? 'aaa' : ratio >= 4.5 ? 'aa' : 'fail'
  };
}

// EVA platform color palette with contrast validation
export const evaColorPalette: ColorPair[] = [
  // Primary colors
  { foreground: '#ffffff', background: '#6366f1', label: 'White on Primary Purple' },
  { foreground: '#ffffff', background: '#3b82f6', label: 'White on Primary Blue' },
  { foreground: '#ffffff', background: '#10b981', label: 'White on Success Green' },
  { foreground: '#ffffff', background: '#ef4444', label: 'White on Error Red' },
  { foreground: '#ffffff', background: '#f59e0b', label: 'White on Warning Yellow' },
  
  // Glass morphism backgrounds
  { foreground: '#ffffff', background: '#1f2937', label: 'White on Glass Dark' },
  { foreground: '#d1d5db', background: '#1f2937', label: 'Light Gray on Glass Dark' },
  { foreground: '#9ca3af', background: '#1f2937', label: 'Medium Gray on Glass Dark' },
  { foreground: '#6b7280', background: '#1f2937', label: 'Dark Gray on Glass Dark' },
  
  // Background combinations
  { foreground: '#1f2937', background: '#ffffff', label: 'Dark Gray on White' },
  { foreground: '#374151', background: '#ffffff', label: 'Medium Gray on White' },
  { foreground: '#6b7280', background: '#f9fafb', label: 'Gray on Light Background' },
  
  // Accent colors
  { foreground: '#ffffff', background: '#8b5cf6', label: 'White on Purple 500' },
  { foreground: '#ffffff', background: '#a855f7', label: 'White on Purple 600' },
  { foreground: '#ffffff', background: '#7c3aed', label: 'White on Violet 600' },
  
  // Status colors
  { foreground: '#065f46', background: '#d1fae5', label: 'Dark Green on Light Green' },
  { foreground: '#991b1b', background: '#fee2e2', label: 'Dark Red on Light Red' },
  { foreground: '#92400e', background: '#fef3c7', label: 'Dark Yellow on Light Yellow' },
  { foreground: '#1e40af', background: '#dbeafe', label: 'Dark Blue on Light Blue' },
  
  // Glassmorphic overlays
  { foreground: '#ffffff', background: '#0f172a', label: 'White on Dark Slate (bg-slate-900)' },
  { foreground: '#f1f5f9', background: '#0f172a', label: 'Light Slate on Dark Slate' },
  { foreground: '#cbd5e1', background: '#0f172a', label: 'Medium Slate on Dark Slate' },
  
  // Interactive elements
  { foreground: '#ffffff', background: '#1d4ed8', label: 'White on Blue 700 (hover)' },
  { foreground: '#ffffff', background: '#7c2d12', label: 'White on Orange 900' },
  { foreground: '#ffffff', background: '#166534', label: 'White on Green 800' },
];

// Validate all color combinations
export function validatePaletteContrast(): Array<ColorPair & ContrastResult> {
  return evaColorPalette.map(pair => ({
    ...pair,
    ...checkContrast(pair.foreground, pair.background)
  }));
}

// Generate contrast report
export function generateContrastReport(): {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: Array<ColorPair & ContrastResult>;
} {
  const results = validatePaletteContrast();
  const passed = results.filter(r => r.passes.aa).length;
  const failed = results.length - passed;
  
  return {
    total: results.length,
    passed,
    failed,
    passRate: Math.round((passed / results.length) * 100),
    results
  };
}

// Color suggestions for better contrast
export function suggestBetterColors(foreground: string, background: string): {
  suggestions: string[];
  type: 'lighten' | 'darken' | 'both';
} {
  const currentRatio = getContrastRatio(foreground, background);
  
  if (currentRatio >= 4.5) {
    return { suggestions: [], type: 'both' };
  }
  
  // For EVA's dark theme, suggest lighter text or darker backgrounds
  const suggestions = [
    '#ffffff', // Pure white
    '#f8fafc', // slate-50
    '#f1f5f9', // slate-100
    '#e2e8f0', // slate-200
    '#cbd5e1', // slate-300
  ];
  
  return {
    suggestions,
    type: 'lighten'
  };
}

// Check if color meets minimum contrast for text size
export function meetsMinimumContrast(
  foreground: string, 
  background: string, 
  fontSize: number, 
  fontWeight: number = 400
): boolean {
  const ratio = getContrastRatio(foreground, background);
  const isLargeText = fontSize >= 18 || (fontSize >= 14 && fontWeight >= 700);
  
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

// Real-time contrast checker for development
export function createContrastChecker(): {
  check: (fg: string, bg: string) => ContrastResult;
  monitor: (element: HTMLElement) => void;
  stopMonitoring: () => void;
} {
  let observers: MutationObserver[] = [];
  
  const check = (fg: string, bg: string) => checkContrast(fg, bg);
  
  const monitor = (element: HTMLElement) => {
    const observer = new MutationObserver(() => {
      const styles = window.getComputedStyle(element);
      const fg = styles.color;
      const bg = styles.backgroundColor;
      
      // Convert to hex if needed and check contrast
      // This is a simplified version - full implementation would need more robust color parsing
      console.log('Contrast check:', { fg, bg, element });
    });
    
    observer.observe(element, {
      attributes: true,
      attributeFilter: ['style', 'class']
    });
    
    observers.push(observer);
  };
  
  const stopMonitoring = () => {
    observers.forEach(obs => obs.disconnect());
    observers = [];
  };
  
  return { check, monitor, stopMonitoring };
}

const colorContrastTools = {
  getContrastRatio,
  checkContrast,
  validatePaletteContrast,
  generateContrastReport,
  suggestBetterColors,
  meetsMinimumContrast,
  createContrastChecker,
  evaColorPalette
};

export default colorContrastTools;