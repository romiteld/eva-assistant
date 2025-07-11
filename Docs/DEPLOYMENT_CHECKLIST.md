# EVA Assistant Deployment Checklist

This checklist ensures a smooth and secure deployment of the EVA Assistant system to production.

## Pre-Deployment Phase

### Code Quality
- [ ] All tests passing (`npm run test`)
- [ ] E2E tests passing (`npm run test:e2e`)
- [ ] TypeScript compilation successful (`npx tsc --noEmit`)
- [ ] ESLint checks passing (`npm run lint`)
- [ ] No console.log statements in production code
- [ ] All TODO comments addressed or documented

### Security Review
- [ ] Environment variables reviewed and secured
- [ ] API keys rotated if necessary
- [ ] CORS settings appropriate for production
- [ ] Rate limiting configured
- [ ] SQL injection prevention verified
- [ ] XSS protection enabled
- [ ] CSRF protection active
- [ ] Authentication/authorization tested

### Performance Validation
- [ ] Bundle size optimized (check with `npm run analyze`)
- [ ] Images optimized and using Next.js Image component
- [ ] Database queries optimized with proper indexes
- [ ] Caching strategy implemented
- [ ] Load testing completed
- [ ] Memory usage within acceptable limits

### Database Preparation
- [ ] Database migrations tested in staging
- [ ] Backup of production database completed
- [ ] Rollback procedure documented
- [ ] Database indexes created
- [ ] Connection pool size configured
- [ ] Read replicas configured (if applicable)

### Infrastructure Readiness
- [ ] SSL certificates valid and not expiring soon
- [ ] DNS records configured correctly
- [ ] CDN configured for static assets
- [ ] Load balancer health checks configured
- [ ] Auto-scaling policies defined
- [ ] Monitoring alerts configured

## Deployment Phase

### Pre-Deployment Steps
- [ ] Create deployment tag in Git
- [ ] Notify team of deployment window
- [ ] Put up maintenance page (if required)
- [ ] Scale up infrastructure (if needed)

### Environment Configuration
- [ ] Production environment variables set
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXTAUTH_URL=
NEXTAUTH_SECRET=
FIRECRAWL_API_KEY=
GEMINI_API_KEY=
```

### Deployment Execution
- [ ] Build production bundle (`npm run build`)
- [ ] Deploy to staging environment first
- [ ] Run smoke tests on staging
- [ ] Deploy to production (blue-green or rolling)
- [ ] Verify deployment with health checks

### Database Migrations
- [ ] Backup production database
- [ ] Run migrations with transaction
- [ ] Verify migration success
- [ ] Test critical queries
- [ ] Monitor database performance

## Post-Deployment Phase

### Immediate Verification (0-15 minutes)
- [ ] Health check endpoint responding (`/api/health`)
- [ ] Database connectivity verified (`/api/health/database`)
- [ ] Authentication flow working
- [ ] Critical user journeys tested
- [ ] Error rates normal
- [ ] Response times acceptable

### Monitoring (15-60 minutes)
- [ ] Check error logs for anomalies
- [ ] Monitor memory usage trends
- [ ] Verify CPU usage is stable
- [ ] Check database connection pool
- [ ] Review API response times
- [ ] Confirm no memory leaks

### Extended Monitoring (1-24 hours)
- [ ] User feedback collected
- [ ] Performance metrics reviewed
- [ ] Error patterns analyzed
- [ ] Resource usage trends checked
- [ ] Cache hit rates verified
- [ ] Background job success rates confirmed

## Rollback Procedures

### Immediate Rollback Triggers
- [ ] Critical functionality broken
- [ ] Authentication system failure
- [ ] Database connection errors
- [ ] High error rate (>10%)
- [ ] Severe performance degradation

### Rollback Steps
1. [ ] Notify team of rollback decision
2. [ ] Switch traffic to previous version
3. [ ] Revert database migrations if needed
4. [ ] Verify system stability
5. [ ] Document rollback reason
6. [ ] Plan fixes for next deployment

## Communication Plan

### Internal Communication
- [ ] Deployment start notification sent
- [ ] Status updates every 30 minutes
- [ ] Completion notification sent
- [ ] Post-mortem scheduled (if issues)

### External Communication
- [ ] Status page updated
- [ ] Customer notification sent (if downtime)
- [ ] Support team briefed
- [ ] Documentation updated

## Sign-offs

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Development Lead | | | |
| QA Lead | | | |
| Security Officer | | | |
| Operations Manager | | | |
| Product Owner | | | |

## Post-Deployment Review

### Success Metrics
- [ ] Deployment completed within window
- [ ] Zero customer-impacting incidents
- [ ] Performance metrics maintained or improved
- [ ] All tests passing post-deployment

### Lessons Learned
- What went well:
  - 
  - 
  
- What could be improved:
  - 
  - 

### Action Items
- [ ] Update deployment procedures
- [ ] Improve automation scripts
- [ ] Address technical debt
- [ ] Schedule training sessions

---

**Deployment Date**: _______________  
**Version**: _______________  
**Deployed By**: _______________