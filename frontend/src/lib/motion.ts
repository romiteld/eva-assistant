import { useReducedMotion } from 'framer-motion';

// Selective imports to reduce bundle size
export { motion, useReducedMotion, AnimatePresence } from 'framer-motion';

// Common animation variants optimized for reduced motion
export const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.3 }
};

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  transition: { duration: 0.2 }
};

export const slideIn = {
  initial: { opacity: 0, x: -20 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.2 }
};

// Reduced motion variants
export const reducedMotionVariants = {
  fadeInUp: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.1 }
  },
  fadeIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.1 }
  },
  slideIn: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    transition: { duration: 0.1 }
  }
};

// Hook to get motion-aware variants
export const useMotionVariants = () => {
  const shouldReduceMotion = useReducedMotion();
  
  return {
    fadeInUp: shouldReduceMotion ? reducedMotionVariants.fadeInUp : fadeInUp,
    fadeIn: shouldReduceMotion ? reducedMotionVariants.fadeIn : fadeIn,
    slideIn: shouldReduceMotion ? reducedMotionVariants.slideIn : slideIn,
  };
};