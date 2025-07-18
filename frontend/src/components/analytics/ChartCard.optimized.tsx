import React, { Suspense, lazy, memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Optimized dynamic import for charts
const ChartsBundle = lazy(() => import('./charts/ChartsBundle'));

export type ChartType = 'line' | 'bar' | 'pie' | 'area' | 'radar';

interface ChartCardProps {
  title: string;
  description?: string;
  data: any[];
  type: ChartType;
  dataKey?: string | string[];
  xAxisKey?: string;
  height?: number;
  className?: string;
  colors?: string[];
  showGrid?: boolean;
  showLegend?: boolean;
}

const ChartLoadingFallback = memo(({ height }: { height: number }) => (
  <div 
    className="animate-pulse bg-gray-700 rounded flex items-center justify-center"
    style={{ height }}
  >
    <div className="text-gray-400 text-sm">Loading chart...</div>
  </div>
));

ChartLoadingFallback.displayName = 'ChartLoadingFallback';

const ChartCard = memo(function ChartCard({
  title,
  description,
  data,
  type,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  className,
  colors,
  showGrid = true,
  showLegend = true,
}: ChartCardProps) {
  return (
    <Card className={cn(
      "bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700",
      className
    )}>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        {description && (
          <p className="text-sm text-gray-400 mt-1">{description}</p>
        )}
      </CardHeader>
      <CardContent>
        <Suspense fallback={<ChartLoadingFallback height={height} />}>
          <ChartsBundle
            data={data}
            type={type}
            dataKey={dataKey}
            xAxisKey={xAxisKey}
            height={height}
            colors={colors}
            showGrid={showGrid}
            showLegend={showLegend}
          />
        </Suspense>
      </CardContent>
    </Card>
  );
});

ChartCard.displayName = 'ChartCard';

export default ChartCard;