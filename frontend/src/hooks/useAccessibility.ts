/**
 * Comprehensive accessibility hook for EVA platform
 * Provides screen reader announcements, focus management, and keyboard navigation
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { liveRegionUtils, focusUtils, keyboardUtils, generateId } from '@/lib/utils/accessibility';

interface UseAccessibilityOptions {
  announceOnMount?: string;
  announceOnUnmount?: string;
  trapFocus?: boolean;
  autoFocus?: boolean;
  skipLinks?: boolean;
}

export const useAccessibility = (options: UseAccessibilityOptions = {}) => {
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const containerRef = useRef<HTMLElement | null>(null);
  const focusRestorer = useRef<(() => void) | null>(null);
  const focusTrapper = useRef<(() => void) | null>(null);
  
  // Announce function
  const announce = useCallback((message: string, level: 'polite' | 'assertive' = 'polite') => {
    liveRegionUtils.announce(message, level);
    setAnnouncements(prev => [...prev.slice(-4), message]); // Keep last 5 announcements
  }, []);

  // Screen reader only text
  const srOnly = useCallback((text: string) => {
    return React.createElement('span', { className: 'sr-only' }, text);
  }, []);

  // Focus management
  const trapFocus = useCallback(() => {
    if (containerRef.current && options.trapFocus) {
      focusTrapper.current = focusUtils.trapFocus(containerRef.current);
    }
  }, [options.trapFocus]);

  const releaseFocus = useCallback(() => {
    if (focusTrapper.current) {
      focusTrapper.current();
      focusTrapper.current = null;
    }
  }, []);

  const saveFocus = useCallback(() => {
    focusRestorer.current = focusUtils.saveFocus();
  }, []);

  const restoreFocus = useCallback(() => {
    if (focusRestorer.current) {
      focusRestorer.current();
      focusRestorer.current = null;
    }
  }, []);

  // Auto-focus first focusable element
  const autoFocus = useCallback(() => {
    if (containerRef.current && options.autoFocus) {
      const focusableElements = focusUtils.getFocusableElements(containerRef.current);
      focusableElements[0]?.focus();
    }
  }, [options.autoFocus]);

  // Skip links functionality
  const addSkipLinks = useCallback(() => {
    if (!options.skipLinks) return;

    const skipToMain = document.createElement('a');
    skipToMain.href = '#main-content';
    skipToMain.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-purple-600 text-white px-4 py-2 rounded-lg z-50';
    skipToMain.textContent = 'Skip to main content';
    
    const skipToNav = document.createElement('a');
    skipToNav.href = '#main-navigation';
    skipToNav.className = 'sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-32 bg-purple-600 text-white px-4 py-2 rounded-lg z-50';
    skipToNav.textContent = 'Skip to navigation';
    
    document.body.prepend(skipToMain, skipToNav);
    
    return () => {
      skipToMain.remove();
      skipToNav.remove();
    };
  }, [options.skipLinks]);

  // Mount/unmount announcements
  useEffect(() => {
    if (options.announceOnMount) {
      announce(options.announceOnMount);
    }
    
    const cleanupSkipLinks = addSkipLinks();
    
    return () => {
      if (options.announceOnUnmount) {
        announce(options.announceOnUnmount);
      }
      cleanupSkipLinks?.();
    };
  }, [options.announceOnMount, options.announceOnUnmount, announce, addSkipLinks]);

  // Focus trap setup
  useEffect(() => {
    if (options.trapFocus) {
      trapFocus();
    }
    
    return () => {
      releaseFocus();
    };
  }, [options.trapFocus, trapFocus, releaseFocus]);

  // Auto-focus setup
  useEffect(() => {
    if (options.autoFocus) {
      autoFocus();
    }
  }, [options.autoFocus, autoFocus]);

  return {
    containerRef,
    announce,
    srOnly,
    trapFocus,
    releaseFocus,
    saveFocus,
    restoreFocus,
    autoFocus,
    announcements,
    
    // Helper functions
    generateId: () => generateId('eva-component'),
    
    // Focus management utilities
    focusFirst: () => {
      if (containerRef.current) {
        const focusableElements = focusUtils.getFocusableElements(containerRef.current);
        focusableElements[0]?.focus();
      }
    },
    
    focusLast: () => {
      if (containerRef.current) {
        const focusableElements = focusUtils.getFocusableElements(containerRef.current);
        focusableElements[focusableElements.length - 1]?.focus();
      }
    }
  };
};

// Hook for keyboard navigation in lists/menus
export const useKeyboardNavigation = (items: HTMLElement[], options: {
  loop?: boolean;
  orientation?: 'horizontal' | 'vertical';
  onActivate?: (index: number) => void;
} = {}) => {
  const [currentIndex, setCurrentIndex] = useState(-1);
  const { loop = true, orientation = 'vertical', onActivate } = options;

  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    const isVertical = orientation === 'vertical';
    const nextKey = isVertical ? 'ArrowDown' : 'ArrowRight';
    const prevKey = isVertical ? 'ArrowUp' : 'ArrowLeft';
    
    let newIndex = currentIndex;
    
    switch (event.key) {
      case nextKey:
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : (loop ? 0 : currentIndex);
        break;
      case prevKey:
        newIndex = currentIndex > 0 ? currentIndex - 1 : (loop ? items.length - 1 : currentIndex);
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = items.length - 1;
        break;
      case 'Enter':
      case ' ':
        if (onActivate && currentIndex >= 0) {
          event.preventDefault();
          onActivate(currentIndex);
        }
        return;
      default:
        return;
    }
    
    event.preventDefault();
    setCurrentIndex(newIndex);
    items[newIndex]?.focus();
  }, [currentIndex, items, loop, orientation, onActivate]);

  const focusIndex = useCallback((index: number) => {
    if (index >= 0 && index < items.length) {
      setCurrentIndex(index);
      items[index]?.focus();
    }
  }, [items]);

  return {
    currentIndex,
    setCurrentIndex,
    handleKeyDown,
    focusIndex,
    
    // Helper functions
    focusFirst: () => focusIndex(0),
    focusLast: () => focusIndex(items.length - 1),
    focusNext: () => {
      const nextIndex = currentIndex < items.length - 1 ? currentIndex + 1 : (loop ? 0 : currentIndex);
      focusIndex(nextIndex);
    },
    focusPrevious: () => {
      const prevIndex = currentIndex > 0 ? currentIndex - 1 : (loop ? items.length - 1 : currentIndex);
      focusIndex(prevIndex);
    }
  };
};

// Hook for form accessibility
export const useFormAccessibility = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const announce = useCallback((message: string, level: 'polite' | 'assertive' = 'polite') => {
    liveRegionUtils.announce(message, level);
  }, []);

  const setFieldError = useCallback((fieldName: string, error: string) => {
    setErrors(prev => ({ ...prev, [fieldName]: error }));
    if (error) {
      announce(`${fieldName} ${error}`, 'assertive');
    }
  }, [announce]);

  const clearFieldError = useCallback((fieldName: string) => {
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[fieldName];
      return newErrors;
    });
  }, []);

  const setFieldTouched = useCallback((fieldName: string, isTouched: boolean = true) => {
    setTouched(prev => ({ ...prev, [fieldName]: isTouched }));
  }, []);

  const getFieldProps = useCallback((fieldName: string, options: {
    required?: boolean;
    label?: string;
    description?: string;
  } = {}) => {
    const { required = false, label, description } = options;
    const hasError = !!errors[fieldName];
    const isTouched = touched[fieldName];
    const fieldId = generateId(fieldName);
    const errorId = `${fieldId}-error`;
    const descriptionId = `${fieldId}-description`;

    return {
      id: fieldId,
      'aria-required': required,
      'aria-invalid': hasError,
      'aria-describedby': [
        hasError ? errorId : null,
        description ? descriptionId : null
      ].filter(Boolean).join(' ') || undefined,
      onBlur: () => setFieldTouched(fieldName, true),
      
      // Error element props
      errorProps: hasError ? {
        id: errorId,
        role: 'alert',
        'aria-live': 'polite',
        className: 'text-red-600 text-sm mt-1'
      } : null,
      
      // Description element props
      descriptionProps: description ? {
        id: descriptionId,
        className: 'text-gray-600 text-sm mt-1'
      } : null,
      
      // Label props
      labelProps: {
        htmlFor: fieldId,
        className: 'block text-sm font-medium text-gray-700 mb-1'
      },
      
      // State
      hasError,
      isTouched,
      error: errors[fieldName]
    };
  }, [errors, touched, setFieldTouched]);

  const announceFormSubmission = useCallback((success: boolean, message: string) => {
    announce(message, success ? 'polite' : 'assertive');
  }, [announce]);

  return {
    errors,
    touched,
    setFieldError,
    clearFieldError,
    setFieldTouched,
    getFieldProps,
    announceFormSubmission,
    
    // Validation helpers
    hasErrors: Object.keys(errors).length > 0,
    getErrorCount: () => Object.keys(errors).length,
    
    // Reset functions
    resetErrors: () => setErrors({}),
    resetTouched: () => setTouched({}),
    resetForm: () => {
      setErrors({});
      setTouched({});
    }
  };
};

// Hook for managing loading states accessibly
export const useLoadingState = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const announce = useCallback((message: string) => {
    liveRegionUtils.announce(message, 'polite');
  }, []);

  const startLoading = useCallback((message: string = 'Loading...') => {
    setIsLoading(true);
    setLoadingMessage(message);
    announce(message);
  }, [announce]);

  const stopLoading = useCallback((completionMessage?: string) => {
    setIsLoading(false);
    setLoadingMessage('');
    if (completionMessage) {
      announce(completionMessage);
    }
  }, [announce]);

  const LoadingSpinner = useCallback(() => React.createElement(
    'div',
    {
      role: "status",
      'aria-live': "polite",
      'aria-label': loadingMessage,
      className: "flex items-center justify-center"
    },
    React.createElement('div', {
      className: "animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600"
    }),
    React.createElement('span', {
      className: "sr-only"
    }, loadingMessage)
  ), [loadingMessage]);

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
    LoadingSpinner
  };
};

export default useAccessibility;