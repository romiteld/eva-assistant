/**
 * Accessibility Validation Component
 * Provides real-time accessibility checking and reporting for development
 */

'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { CheckCircle, AlertCircle, AlertTriangle, Eye, EyeOff } from 'lucide-react';
import { generateContrastReport, type ContrastResult } from '@/lib/utils/color-contrast';
import { a11yValidation } from '@/lib/utils/accessibility';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface AccessibilityIssue {
  id: string;
  element: HTMLElement;
  type: 'contrast' | 'label' | 'role' | 'focus' | 'touch-target';
  severity: 'error' | 'warning' | 'info';
  message: string;
  suggestion?: string;
}

interface AccessibilityValidatorProps {
  enabled?: boolean;
  onIssuesFound?: (issues: AccessibilityIssue[]) => void;
  showOverlay?: boolean;
  mode?: 'dev' | 'audit';
}

export function AccessibilityValidator({ 
  enabled = process.env.NODE_ENV === 'development',
  onIssuesFound,
  showOverlay = true,
  mode = 'dev'
}: AccessibilityValidatorProps) {
  const [issues, setIssues] = useState<AccessibilityIssue[]>([]);
  const [isVisible, setIsVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [contrastReport, setContrastReport] = useState<ReturnType<typeof generateContrastReport> | null>(null);

  // Scan for accessibility issues
  const scanForIssues = useCallback(() => {
    if (!enabled) return;
    
    setIsScanning(true);
    const foundIssues: AccessibilityIssue[] = [];
    
    // Get all interactive elements
    const interactiveElements = document.querySelectorAll(
      'button, input, select, textarea, a[href], [tabindex], [role="button"], [role="link"], [role="menuitem"]'
    );
    
    interactiveElements.forEach((element, index) => {
      const htmlElement = element as HTMLElement;
      const id = `element-${index}`;
      
      // Check for missing labels
      if (!a11yValidation.hasLabel(htmlElement)) {
        foundIssues.push({
          id: `${id}-label`,
          element: htmlElement,
          type: 'label',
          severity: 'error',
          message: 'Interactive element missing accessible label',
          suggestion: 'Add aria-label, aria-labelledby, or associated label element'
        });
      }
      
      // Check for proper roles
      if (!a11yValidation.hasProperRole(htmlElement)) {
        foundIssues.push({
          id: `${id}-role`,
          element: htmlElement,
          type: 'role',
          severity: 'warning',
          message: 'Element may need explicit role attribute',
          suggestion: 'Add appropriate role attribute (button, link, etc.)'
        });
      }
      
      // Check touch target size
      if (!a11yValidation.meetsTouchTargetSize(htmlElement)) {
        foundIssues.push({
          id: `${id}-touch`,
          element: htmlElement,
          type: 'touch-target',
          severity: 'warning',
          message: 'Touch target smaller than 44px minimum',
          suggestion: 'Increase padding or minimum dimensions to 44px'
        });
      }
      
      // Check focus visibility
      const styles = window.getComputedStyle(htmlElement);
      if (styles.outline === 'none' && !styles.boxShadow.includes('focus')) {
        foundIssues.push({
          id: `${id}-focus`,
          element: htmlElement,
          type: 'focus',
          severity: 'warning',
          message: 'Element may not have visible focus indicator',
          suggestion: 'Add focus:outline or focus:ring classes'
        });
      }
    });
    
    // Check for missing alt text on images
    const images = document.querySelectorAll('img');
    images.forEach((img, index) => {
      if (!img.alt && !img.getAttribute('aria-hidden')) {
        foundIssues.push({
          id: `img-${index}`,
          element: img,
          type: 'label',
          severity: 'error',
          message: 'Image missing alt text',
          suggestion: 'Add descriptive alt attribute or aria-hidden="true" for decorative images'
        });
      }
    });
    
    // Check for proper heading hierarchy
    const headings = document.querySelectorAll('h1, h2, h3, h4, h5, h6');
    let lastLevel = 0;
    headings.forEach((heading, index) => {
      const level = parseInt(heading.tagName.charAt(1));
      if (level > lastLevel + 1) {
        foundIssues.push({
          id: `heading-${index}`,
          element: heading as HTMLElement,
          type: 'role',
          severity: 'warning',
          message: `Heading level ${level} skips level ${lastLevel + 1}`,
          suggestion: 'Use proper heading hierarchy without skipping levels'
        });
      }
      lastLevel = level;
    });
    
    setIssues(foundIssues);
    setIsScanning(false);
    
    if (onIssuesFound) {
      onIssuesFound(foundIssues);
    }
  }, [enabled, onIssuesFound]);

  // Generate contrast report
  const generateReport = useCallback(() => {
    const report = generateContrastReport();
    setContrastReport(report);
  }, []);

  // Highlight element on hover
  const highlightElement = useCallback((element: HTMLElement) => {
    element.style.outline = '2px solid #ef4444';
    element.style.outlineOffset = '2px';
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // Remove highlight
  const removeHighlight = useCallback((element: HTMLElement) => {
    element.style.outline = '';
    element.style.outlineOffset = '';
  }, []);

  // Auto-scan on mount and DOM changes
  useEffect(() => {
    if (!enabled) return;
    
    scanForIssues();
    generateReport();
    
    const observer = new MutationObserver(() => {
      setTimeout(scanForIssues, 100); // Debounce
    });
    
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style', 'aria-label', 'aria-labelledby']
    });
    
    return () => observer.disconnect();
  }, [enabled, scanForIssues, generateReport]);

  if (!enabled || !showOverlay) return null;

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="flex flex-col gap-2">
        {/* Toggle Button */}
        <Button
          onClick={() => setIsVisible(!isVisible)}
          variant="outline"
          size="sm"
          className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-lg"
          aria-label={isVisible ? 'Hide accessibility panel' : 'Show accessibility panel'}
        >
          {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          A11Y
          {(errorCount > 0 || warningCount > 0) && (
            <Badge variant="destructive" className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
              {errorCount + warningCount}
            </Badge>
          )}
        </Button>

        {/* Accessibility Panel */}
        {isVisible && (
          <Card className="w-80 max-h-96 bg-white/95 backdrop-blur-sm border-gray-200 shadow-lg">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="h-4 w-4" />
                Accessibility Audit
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time accessibility validation
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 max-h-64 overflow-y-auto">
              {/* Summary */}
              <div className="flex gap-2 text-xs">
                <Badge variant="destructive" className="text-xs">
                  {errorCount} Errors
                </Badge>
                <Badge variant="outline" className="text-xs border-yellow-500 text-yellow-700">
                  {warningCount} Warnings
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {infoCount} Info
                </Badge>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <Button
                  onClick={scanForIssues}
                  size="sm"
                  variant="outline"
                  disabled={isScanning}
                  className="text-xs"
                >
                  {isScanning ? 'Scanning...' : 'Re-scan'}
                </Button>
                <Button
                  onClick={generateReport}
                  size="sm"
                  variant="outline"
                  className="text-xs"
                >
                  Contrast Report
                </Button>
              </div>

              {/* Issues List */}
              <div className="space-y-2">
                {issues.map((issue) => (
                  <div
                    key={issue.id}
                    className="p-2 rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors"
                    onMouseEnter={() => highlightElement(issue.element)}
                    onMouseLeave={() => removeHighlight(issue.element)}
                    onClick={() => issue.element.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                  >
                    <div className="flex items-start gap-2">
                      {issue.severity === 'error' && <AlertCircle className="h-3 w-3 text-red-500 mt-0.5" />}
                      {issue.severity === 'warning' && <AlertTriangle className="h-3 w-3 text-yellow-500 mt-0.5" />}
                      {issue.severity === 'info' && <CheckCircle className="h-3 w-3 text-blue-500 mt-0.5" />}
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900">{issue.message}</p>
                        {issue.suggestion && (
                          <p className="text-xs text-gray-600 mt-1">{issue.suggestion}</p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {issue.element.tagName.toLowerCase()}
                          {issue.element.id && `#${issue.element.id}`}
                          {issue.element.className && `.${issue.element.className.split(' ')[0]}`}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Contrast Report */}
              {contrastReport && (
                <Collapsible>
                  <CollapsibleTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full text-xs">
                      Color Contrast Report ({contrastReport.passRate}% pass rate)
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-1">
                    <div className="text-xs text-gray-600">
                      {contrastReport.passed} passed, {contrastReport.failed} failed
                    </div>
                    <div className="max-h-32 overflow-y-auto space-y-1">
                      {contrastReport.results
                        .filter(r => !r.passes.aa)
                        .map((result, index) => (
                          <div key={index} className="text-xs p-1 bg-red-50 rounded">
                            <div className="font-medium">{result.label}</div>
                            <div className="text-gray-600">Ratio: {result.ratio}:1</div>
                          </div>
                        ))}
                    </div>
                  </CollapsibleContent>
                </Collapsible>
              )}

              {issues.length === 0 && !isScanning && (
                <div className="text-center py-4 text-sm text-gray-500">
                  <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                  No accessibility issues found!
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

export default AccessibilityValidator;