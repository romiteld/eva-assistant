# Analytics Dashboard Components

## Overview

The Analytics Dashboard provides comprehensive insights into the AI-powered recruitment platform's performance, including lead generation metrics, campaign performance, agent usage statistics, and user activity trends.

## Components

### 1. AnalyticsDashboard
Main dashboard component that orchestrates all analytics features.

**Features:**
- Date range selection
- Multiple metric views (tabs)
- Real-time data fetching with fallback to mock data
- Export functionality
- Responsive design

### 2. MetricsCard
Displays key performance indicators (KPIs) with trend indicators.

**Props:**
- `metric: MetricData` - Metric data including value, label, change percentage, and icon

**Features:**
- Gradient text for values
- Trend indicators (up/down/neutral)
- Icon support
- Unit formatting (percent, time, currency)

### 3. ChartCard
Versatile chart component supporting multiple chart types.

**Props:**
- `title: string` - Chart title
- `description?: string` - Optional description
- `data: any[]` - Chart data
- `type: ChartType` - Chart type (line, bar, pie, area, radar)
- `dataKey?: string | string[]` - Data key(s) to display
- `xAxisKey?: string` - X-axis data key
- `height?: number` - Chart height (default: 300)
- `colors?: string[]` - Custom color palette
- `showGrid?: boolean` - Show grid lines
- `showLegend?: boolean` - Show legend

**Supported Chart Types:**
- Line charts for trends
- Bar charts for comparisons
- Pie charts for distributions
- Area charts for cumulative data
- Radar charts for multi-dimensional analysis

### 4. DateRangePicker
Date range selection component with preset options.

**Props:**
- `dateRange: DateRange` - Current date range
- `onDateRangeChange: (range: DateRange) => void` - Change handler

**Features:**
- Preset ranges (Today, Yesterday, Last 7/30/90 days)
- Custom date range selection
- Calendar UI for date picking

## Data Service

### AnalyticsService
Service class for fetching analytics data from Supabase.

**Methods:**
- `getOverviewMetrics()` - Fetch high-level KPIs
- `getLeadGenerationMetrics()` - Lead-specific analytics
- `getCampaignMetrics()` - Email campaign performance
- `getAgentUsageMetrics()` - AI agent utilization
- `getUserActivityMetrics()` - User engagement data

## Usage

```tsx
import { AnalyticsDashboard } from '@/components/analytics';

function AnalyticsPage() {
  return (
    <DashboardLayout>
      <AnalyticsDashboard />
    </DashboardLayout>
  );
}
```

## Data Structure

### MetricData
```typescript
interface MetricData {
  label: string;
  value: number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  unit?: string;
  icon?: string;
}
```

### Chart Data Types
The analytics dashboard uses various data structures for different metrics:
- Lead metrics by source and status
- Campaign performance statistics
- Agent task completion rates
- User activity trends

## Styling

All components follow the existing glassmorphic design system:
- Dark background with gradients
- Border styling with gray-700
- Hover effects and transitions
- Responsive grid layouts

## Performance Considerations

- Data fetching with error handling and fallbacks
- Optimized chart rendering with Recharts
- Memoization for expensive calculations
- Responsive design for mobile devices

## Future Enhancements

1. Real-time data updates with WebSocket
2. Advanced filtering options
3. Custom metric creation
4. Scheduled report generation
5. Data export in multiple formats (CSV, PDF)
6. Drill-down capabilities for detailed analysis
7. Predictive analytics using ML models
8. Comparison views (period over period)
9. Custom dashboard layouts
10. Integration with external analytics tools