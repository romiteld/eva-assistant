# Bundle Analysis Report

## Summary
- Total Bundle Size: 195.5 KB
- Validation: ❌ FAILED
- Violations: 4

## Large Pages
- /dashboard/twilio: 413 KB (568 KB first load)
- /dashboard/voice: 310 KB (560 KB first load)
- /dashboard/analytics: 32.9 KB (376 KB first load)
- /dashboard/zoho: 7.48 KB (344 KB first load)
- /dashboard/post-predictor: 14.4 KB (311 KB first load)
- /dashboard/deals: 20.4 KB (317 KB first load)

## Optimization Opportunities
- Twilio Integration: 413 KB → 113 KB (Code splitting and lazy loading)
- Voice Agent: 310 KB → 110 KB (Dynamic imports for AI models)
- Analytics Dashboard: 32.9 KB → 12.899999999999999 KB (Chart library tree-shaking)
- Framer Motion: 32.5 KB → 7.5 KB (Selective imports and reduced motion)
- Lucide Icons: 28.3 KB → 8.3 KB (Individual icon imports)

## Recommendations
- Consider lazy loading Framer Motion animations for non-critical components
- Use useReducedMotion to disable animations for users who prefer reduced motion
- Implement animation variants with shorter durations for better performance
- Consider using dynamic imports for lucide-react icons to reduce bundle size
- Only import specific icons instead of the entire icon library
- Enable compression (gzip/brotli) on the server
- Use React.memo for components that don't need frequent re-renders
- Implement code splitting for routes that are not immediately needed
