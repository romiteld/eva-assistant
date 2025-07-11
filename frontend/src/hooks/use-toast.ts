import { toast as sonnerToast } from 'sonner';

// Type the toast function to match Sonner's API
type ToastOptions = {
  title?: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success' | 'warning';
  duration?: number;
  [key: string]: any;
};

// Wrapper function to handle the variant mapping
export const toast = (options: ToastOptions | string) => {
  if (typeof options === 'string') {
    return sonnerToast(options);
  }
  
  const { title, description, variant, ...rest } = options;
  
  // Map our variant to Sonner's type
  let toastType: 'success' | 'error' | 'info' | 'warning' | undefined;
  if (variant === 'destructive') {
    toastType = 'error';
  } else if (variant === 'success') {
    toastType = 'success';
  } else if (variant === 'warning') {
    toastType = 'warning';
  }
  
  // Combine title and description
  const message = title || '';
  const toastOptions = {
    ...rest,
    description,
  };
  
  if (toastType) {
    return sonnerToast[toastType](message, toastOptions);
  }
  
  return sonnerToast(message, toastOptions);
};

export function useToast() {
  return {
    toast,
  };
}