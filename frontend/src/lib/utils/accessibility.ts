/**
 * Accessibility utilities for EVA platform
 * Provides helpers for ARIA attributes, live regions, and accessibility best practices
 */

import { useEffect, useRef, useState } from 'react';

// Color contrast checking utility
export const colorContrastUtils = {
  // Calculate relative luminance for a color
  getLuminance: (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  // Calculate contrast ratio between two colors
  getContrastRatio: (color1: string, color2: string): number => {
    const hex1 = color1.replace('#', '');
    const hex2 = color2.replace('#', '');
    
    const r1 = parseInt(hex1.substr(0, 2), 16);
    const g1 = parseInt(hex1.substr(2, 2), 16);
    const b1 = parseInt(hex1.substr(4, 2), 16);
    
    const r2 = parseInt(hex2.substr(0, 2), 16);
    const g2 = parseInt(hex2.substr(2, 2), 16);
    const b2 = parseInt(hex2.substr(4, 2), 16);
    
    const lum1 = colorContrastUtils.getLuminance(r1, g1, b1);
    const lum2 = colorContrastUtils.getLuminance(r2, g2, b2);
    
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    
    return (brightest + 0.05) / (darkest + 0.05);
  },

  // Check if contrast ratio meets WCAG AA standards
  meetsWCAGAA: (color1: string, color2: string): boolean => {
    return colorContrastUtils.getContrastRatio(color1, color2) >= 4.5;
  },

  // Check if contrast ratio meets WCAG AAA standards
  meetsWCAGAAA: (color1: string, color2: string): boolean => {
    return colorContrastUtils.getContrastRatio(color1, color2) >= 7;
  }
};

// Generate unique IDs for accessibility
export const generateId = (() => {
  let counter = 0;
  return (prefix: string = 'eva-a11y') => `${prefix}-${++counter}`;
})();

// ARIA live region utilities
export const liveRegionUtils = {
  // Create a live region for announcements
  createLiveRegion: (level: 'polite' | 'assertive' = 'polite'): HTMLElement => {
    const liveRegion = document.createElement('div');
    liveRegion.setAttribute('aria-live', level);
    liveRegion.setAttribute('aria-atomic', 'true');
    liveRegion.setAttribute('class', 'sr-only');
    liveRegion.setAttribute('id', generateId('live-region'));
    document.body.appendChild(liveRegion);
    return liveRegion;
  },

  // Announce message to screen readers
  announce: (message: string, level: 'polite' | 'assertive' = 'polite'): void => {
    const existingRegion = document.querySelector(`[aria-live="${level}"]`);
    let liveRegion: HTMLElement;
    
    if (existingRegion) {
      liveRegion = existingRegion as HTMLElement;
    } else {
      liveRegion = liveRegionUtils.createLiveRegion(level);
    }
    
    liveRegion.textContent = message;
    
    // Clear the message after a delay to allow for re-announcements
    setTimeout(() => {
      liveRegion.textContent = '';
    }, 1000);
  }
};

// Focus management utilities
export const focusUtils = {
  // Get all focusable elements within a container
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const focusableSelectors = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]'
    ].join(', ');
    
    return Array.from(container.querySelectorAll(focusableSelectors));
  },

  // Trap focus within a container (for modals, dialogs)
  trapFocus: (container: HTMLElement): (() => void) => {
    const focusableElements = focusUtils.getFocusableElements(container);
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];
    
    const handleTabKey = (event: KeyboardEvent) => {
      if (event.key !== 'Tab') return;
      
      if (event.shiftKey) {
        if (document.activeElement === firstFocusable) {
          lastFocusable.focus();
          event.preventDefault();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          firstFocusable.focus();
          event.preventDefault();
        }
      }
    };
    
    container.addEventListener('keydown', handleTabKey);
    
    // Focus the first element
    firstFocusable?.focus();
    
    // Return cleanup function
    return () => {
      container.removeEventListener('keydown', handleTabKey);
    };
  },

  // Save and restore focus
  saveFocus: (): (() => void) => {
    const activeElement = document.activeElement as HTMLElement;
    
    return () => {
      if (activeElement && activeElement.focus) {
        activeElement.focus();
      }
    };
  }
};

// Keyboard navigation utilities
export const keyboardUtils = {
  // Standard keyboard event handlers
  handleArrowKeys: (
    event: KeyboardEvent,
    items: HTMLElement[],
    currentIndex: number,
    onIndexChange: (newIndex: number) => void
  ): void => {
    let newIndex = currentIndex;
    
    switch (event.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        newIndex = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        newIndex = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
        break;
      case 'Home':
        newIndex = 0;
        break;
      case 'End':
        newIndex = items.length - 1;
        break;
      default:
        return;
    }
    
    event.preventDefault();
    onIndexChange(newIndex);
    items[newIndex]?.focus();
  },

  // Handle Enter/Space for activation
  handleActivation: (
    event: KeyboardEvent,
    onActivate: () => void
  ): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  }
};

// React hooks for accessibility
export const useAccessibility = () => {
  const [announcements, setAnnouncements] = useState<string[]>([]);
  const liveRegionRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    // Create live region on mount
    liveRegionRef.current = liveRegionUtils.createLiveRegion('polite');
    
    return () => {
      // Cleanup on unmount
      if (liveRegionRef.current) {
        document.body.removeChild(liveRegionRef.current);
      }
    };
  }, []);

  const announce = (message: string, level: 'polite' | 'assertive' = 'polite') => {
    liveRegionUtils.announce(message, level);
    setAnnouncements(prev => [...prev, message]);
  };

  return {
    announce,
    announcements
  };
};

// Hook for managing focus
export const useFocus = () => {
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const itemRefs = useRef<(HTMLElement | null)[]>([]);

  const setItemRef = (index: number) => (element: HTMLElement | null) => {
    itemRefs.current[index] = element;
  };

  const focusItem = (index: number) => {
    setFocusedIndex(index);
    itemRefs.current[index]?.focus();
  };

  const handleKeyNavigation = (event: KeyboardEvent) => {
    const items = itemRefs.current.filter(Boolean);
    keyboardUtils.handleArrowKeys(event, items, focusedIndex, setFocusedIndex);
  };

  return {
    focusedIndex,
    setFocusedIndex,
    setItemRef,
    focusItem,
    handleKeyNavigation
  };
};

// Validation utilities for accessibility
export const a11yValidation = {
  // Check if element has proper label
  hasLabel: (element: HTMLElement): boolean => {
    return !!(
      element.getAttribute('aria-label') ||
      element.getAttribute('aria-labelledby') ||
      element.querySelector('label')
    );
  },

  // Check if interactive element has proper role
  hasProperRole: (element: HTMLElement): boolean => {
    const tagName = element.tagName.toLowerCase();
    const role = element.getAttribute('role');
    
    if (['button', 'input', 'select', 'textarea', 'a'].includes(tagName)) {
      return true;
    }
    
    return !!(role && ['button', 'link', 'menuitem', 'tab', 'checkbox', 'radio'].includes(role));
  },

  // Check if element meets minimum touch target size (44px)
  meetsTouchTargetSize: (element: HTMLElement): boolean => {
    const rect = element.getBoundingClientRect();
    return rect.width >= 44 && rect.height >= 44;
  },

  // Validate form field
  validateFormField: (element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): string[] => {
    const errors: string[] = [];
    
    if (!a11yValidation.hasLabel(element)) {
      errors.push('Missing label or aria-label');
    }
    
    if (element.hasAttribute('required') && !element.getAttribute('aria-required')) {
      errors.push('Required field should have aria-required="true"');
    }
    
    if (element.getAttribute('aria-invalid') === 'true' && !element.getAttribute('aria-describedby')) {
      errors.push('Invalid field should have aria-describedby pointing to error message');
    }
    
    return errors;
  }
};

// ARIA attributes builder
export const ariaBuilder = {
  // Build ARIA attributes for form fields
  formField: (options: {
    label?: string;
    required?: boolean;
    invalid?: boolean;
    describedBy?: string;
    errorId?: string;
  }) => {
    const attrs: Record<string, string> = {};
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.required) {
      attrs['aria-required'] = 'true';
    }
    
    if (options.invalid) {
      attrs['aria-invalid'] = 'true';
    }
    
    if (options.describedBy || options.errorId) {
      attrs['aria-describedby'] = [options.describedBy, options.errorId].filter(Boolean).join(' ');
    }
    
    return attrs;
  },

  // Build ARIA attributes for buttons
  button: (options: {
    label?: string;
    describedBy?: string;
    pressed?: boolean;
    expanded?: boolean;
    controls?: string;
    hasPopup?: boolean;
  }) => {
    const attrs: Record<string, string> = {};
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.describedBy) {
      attrs['aria-describedby'] = options.describedBy;
    }
    
    if (options.pressed !== undefined) {
      attrs['aria-pressed'] = options.pressed.toString();
    }
    
    if (options.expanded !== undefined) {
      attrs['aria-expanded'] = options.expanded.toString();
    }
    
    if (options.controls) {
      attrs['aria-controls'] = options.controls;
    }
    
    if (options.hasPopup) {
      attrs['aria-haspopup'] = 'true';
    }
    
    return attrs;
  },

  // Build ARIA attributes for navigation
  navigation: (options: {
    label?: string;
    current?: boolean;
    level?: number;
    setSize?: number;
    posInSet?: number;
  }) => {
    const attrs: Record<string, string> = {};
    
    if (options.label) {
      attrs['aria-label'] = options.label;
    }
    
    if (options.current) {
      attrs['aria-current'] = 'page';
    }
    
    if (options.level) {
      attrs['aria-level'] = options.level.toString();
    }
    
    if (options.setSize) {
      attrs['aria-setsize'] = options.setSize.toString();
    }
    
    if (options.posInSet) {
      attrs['aria-posinset'] = options.posInSet.toString();
    }
    
    return attrs;
  }
};

const accessibilityUtils = {
  colorContrastUtils,
  generateId,
  liveRegionUtils,
  focusUtils,
  keyboardUtils,
  useAccessibility,
  useFocus,
  a11yValidation,
  ariaBuilder
};

export default accessibilityUtils;