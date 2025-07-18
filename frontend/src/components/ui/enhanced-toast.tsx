'use client';

import React from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Info, 
  Loader2,
  X,
  ExternalLink,
  Copy,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

interface ToastAction {
  label: string;
  onClick: () => void;
  icon?: React.ReactNode;
}

interface EnhancedToastProps {
  id?: string;
  type?: ToastType;
  title: string;
  description?: string;
  duration?: number;
  persistent?: boolean;
  actions?: ToastAction[];
  onClose?: () => void;
  className?: string;
}

const toastConfig = {
  success: {
    icon: CheckCircle2,
    className: 'border-green-200 bg-green-50 dark:bg-green-900/20',
    iconClassName: 'text-green-600 dark:text-green-400'
  },
  error: {
    icon: XCircle,
    className: 'border-red-200 bg-red-50 dark:bg-red-900/20',
    iconClassName: 'text-red-600 dark:text-red-400'
  },
  warning: {
    icon: AlertCircle,
    className: 'border-yellow-200 bg-yellow-50 dark:bg-yellow-900/20',
    iconClassName: 'text-yellow-600 dark:text-yellow-400'
  },
  info: {
    icon: Info,
    className: 'border-blue-200 bg-blue-50 dark:bg-blue-900/20',
    iconClassName: 'text-blue-600 dark:text-blue-400'
  },
  loading: {
    icon: Loader2,
    className: 'border-purple-200 bg-purple-50 dark:bg-purple-900/20',
    iconClassName: 'text-purple-600 dark:text-purple-400 animate-spin'
  }
};

export function useEnhancedToast() {
  const { toast: originalToast } = useToast();

  const toast = {
    success: (props: Omit<EnhancedToastProps, 'type'>) => {
      return originalToast({
        ...props,
        // @ts-ignore - Adding custom property
        type: 'success'
      });
    },
    error: (props: Omit<EnhancedToastProps, 'type'>) => {
      return originalToast({
        ...props,
        // @ts-ignore - Adding custom property
        type: 'error',
        duration: props.duration || 6000 // Errors stay longer
      });
    },
    warning: (props: Omit<EnhancedToastProps, 'type'>) => {
      return originalToast({
        ...props,
        // @ts-ignore - Adding custom property
        type: 'warning'
      });
    },
    info: (props: Omit<EnhancedToastProps, 'type'>) => {
      return originalToast({
        ...props,
        // @ts-ignore - Adding custom property
        type: 'info'
      });
    },
    loading: (props: Omit<EnhancedToastProps, 'type'>) => {
      return originalToast({
        ...props,
        // @ts-ignore - Adding custom property
        type: 'loading',
        duration: props.persistent ? Infinity : props.duration
      });
    },
    promise: async <T,>(
      promise: Promise<T>,
      messages: {
        loading: string;
        success: string | ((data: T) => string);
        error: string | ((error: any) => string);
      }
    ) => {
      const toastId = originalToast({
        title: messages.loading,
        // @ts-ignore - Adding custom property
        type: 'loading',
        duration: Infinity
      });

      try {
        const result = await promise;
        originalToast({
          id: toastId.id,
          title: typeof messages.success === 'function' 
            ? messages.success(result) 
            : messages.success,
          // @ts-ignore - Adding custom property
          type: 'success'
        });
        return result;
      } catch (error) {
        originalToast({
          id: toastId.id,
          title: typeof messages.error === 'function'
            ? messages.error(error)
            : messages.error,
          // @ts-ignore - Adding custom property
          type: 'error',
          duration: 6000
        });
        throw error;
      }
    }
  };

  return { toast };
}

// Custom Toast Component
export function EnhancedToast({
  type = 'info',
  title,
  description,
  actions,
  onClose,
  className
}: EnhancedToastProps) {
  const config = toastConfig[type];
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'relative flex items-start gap-3 p-4 pr-8 rounded-lg border shadow-lg',
        'bg-white dark:bg-gray-900',
        config.className,
        className
      )}
    >
      <Icon className={cn('w-5 h-5 flex-shrink-0 mt-0.5', config.iconClassName)} />
      
      <div className="flex-1 space-y-1">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
          {title}
        </p>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
        {actions && actions.length > 0 && (
          <div className="flex items-center gap-2 mt-3">
            {actions.map((action, index) => (
              <Button
                key={index}
                size="sm"
                variant="ghost"
                onClick={action.onClick}
                className="h-auto py-1 px-2 text-xs"
              >
                {action.icon}
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
      
      {onClose && (
        <Button
          size="sm"
          variant="ghost"
          onClick={onClose}
          className="absolute top-2 right-2 h-auto p-1"
        >
          <X className="w-4 h-4" />
        </Button>
      )}
    </motion.div>
  );
}

// Notification Stack Component
interface NotificationStackProps {
  notifications: EnhancedToastProps[];
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

export function NotificationStack({ 
  notifications, 
  position = 'bottom-right' 
}: NotificationStackProps) {
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 -translate-x-1/2'
  };

  return (
    <div className={cn(
      'fixed z-50 pointer-events-none',
      positionClasses[position]
    )}>
      <AnimatePresence>
        <div className="space-y-2 pointer-events-auto">
          {notifications.map((notification) => (
            <EnhancedToast key={notification.id} {...notification} />
          ))}
        </div>
      </AnimatePresence>
    </div>
  );
}

// Common toast patterns
export const toastPatterns = {
  apiError: (error: any) => ({
    type: 'error' as const,
    title: 'API Error',
    description: error.message || 'An unexpected error occurred',
    actions: [
      {
        label: 'Retry',
        icon: <RefreshCw className="w-3 h-3 mr-1" />,
        onClick: () => window.location.reload()
      }
    ]
  }),
  
  copySuccess: (text: string) => ({
    type: 'success' as const,
    title: 'Copied to clipboard',
    description: text.length > 50 ? `${text.substring(0, 50)}...` : text
  }),
  
  formSuccess: (action: string) => ({
    type: 'success' as const,
    title: `${action} successful`,
    description: 'Your changes have been saved'
  }),
  
  networkError: () => ({
    type: 'error' as const,
    title: 'Network Error',
    description: 'Please check your internet connection',
    persistent: true,
    actions: [
      {
        label: 'Retry',
        icon: <RefreshCw className="w-3 h-3 mr-1" />,
        onClick: () => window.location.reload()
      }
    ]
  }),
  
  updateAvailable: () => ({
    type: 'info' as const,
    title: 'Update Available',
    description: 'A new version is available. Refresh to update.',
    persistent: true,
    actions: [
      {
        label: 'Refresh',
        icon: <RefreshCw className="w-3 h-3 mr-1" />,
        onClick: () => window.location.reload()
      }
    ]
  })
};