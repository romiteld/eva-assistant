import React, { Suspense, lazy } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// Lazy load chart components to reduce bundle size
const LineChartComponent = lazy(() => import('recharts').then(module => ({ default: module.LineChart })));
const LineComponent = lazy(() => import('recharts').then(module => ({ default: module.Line })));
const BarChartComponent = lazy(() => import('recharts').then(module => ({ default: module.BarChart })));
const BarComponent = lazy(() => import('recharts').then(module => ({ default: module.Bar })));
const PieChartComponent = lazy(() => import('recharts').then(module => ({ default: module.PieChart })));
const PieComponent = lazy(() => import('recharts').then(module => ({ default: module.Pie })));
const CellComponent = lazy(() => import('recharts').then(module => ({ default: module.Cell })));
const XAxisComponent = lazy(() => import('recharts').then(module => ({ default: module.XAxis })));
const YAxisComponent = lazy(() => import('recharts').then(module => ({ default: module.YAxis })));
const CartesianGridComponent = lazy(() => import('recharts').then(module => ({ default: module.CartesianGrid })));
const TooltipComponent = lazy(() => import('recharts').then(module => ({ default: module.Tooltip })));
const LegendComponent = lazy(() => import('recharts').then(module => ({ default: module.Legend })));
const ResponsiveContainerComponent = lazy(() => import('recharts').then(module => ({ default: module.ResponsiveContainer })));
const AreaComponent = lazy(() => import('recharts').then(module => ({ default: module.Area })));
const AreaChartComponent = lazy(() => import('recharts').then(module => ({ default: module.AreaChart })));
const RadarChartComponent = lazy(() => import('recharts').then(module => ({ default: module.RadarChart })));
const PolarGridComponent = lazy(() => import('recharts').then(module => ({ default: module.PolarGrid })));
const PolarAngleAxisComponent = lazy(() => import('recharts').then(module => ({ default: module.PolarAngleAxis })));
const PolarRadiusAxisComponent = lazy(() => import('recharts').then(module => ({ default: module.PolarRadiusAxis })));
const RadarComponent = lazy(() => import('recharts').then(module => ({ default: module.Radar })));

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

const defaultColors = [
  '#3b82f6', // blue-500
  '#8b5cf6', // purple-500
  '#ec4899', // pink-500
  '#10b981', // green-500
  '#f59e0b', // yellow-500
  '#ef4444', // red-500
];

export default function ChartCard({
  title,
  description,
  data,
  type,
  dataKey = 'value',
  xAxisKey = 'name',
  height = 300,
  className,
  colors = defaultColors,
  showGrid = true,
  showLegend = true,
}: ChartCardProps) {
  const renderChart = () => {
    const commonProps = {
      data,
      margin: { top: 5, right: 30, left: 20, bottom: 5 },
    };

    const axisStyle = {
      stroke: '#6b7280',
      fontSize: 12,
    };

    const tooltipStyle = {
      backgroundColor: '#1f2937',
      border: '1px solid #374151',
      borderRadius: '8px',
      fontSize: '12px',
    };

    switch (type) {
      case 'line':
        return (
          <Suspense fallback={<div className="animate-pulse bg-gray-700 h-full rounded" />}>
            <LineChartComponent {...commonProps}>
              {showGrid && <CartesianGridComponent strokeDasharray="3 3" stroke="#374151" />}
              <XAxisComponent dataKey={xAxisKey} {...axisStyle} />
              <YAxisComponent {...axisStyle} />
              <TooltipComponent contentStyle={tooltipStyle} />
              {showLegend && <LegendComponent />}
              {Array.isArray(dataKey) ? (
                dataKey.map((key, index) => (
                  <LineComponent
                    key={key}
                    type="monotone"
                    dataKey={key}
                    stroke={colors[index % colors.length]}
                    strokeWidth={2}
                    dot={{ fill: colors[index % colors.length], r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                ))
              ) : (
                <LineComponent
                  type="monotone"
                  dataKey={dataKey}
                  stroke={colors[0]}
                  strokeWidth={2}
                  dot={{ fill: colors[0], r: 4 }}
                  activeDot={{ r: 6 }}
                />
              )}
            </LineChartComponent>
          </Suspense>
        );

      case 'bar':
        return (
          <BarChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis dataKey={xAxisKey} {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            {showLegend && <Legend />}
            {Array.isArray(dataKey) ? (
              dataKey.map((key, index) => (
                <Bar
                  key={key}
                  dataKey={key}
                  fill={colors[index % colors.length]}
                  radius={[8, 8, 0, 0]}
                />
              ))
            ) : (
              <Bar dataKey={dataKey} fill={colors[0]} radius={[8, 8, 0, 0]} />
            )}
          </BarChart>
        );

      case 'area':
        return (
          <AreaChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis dataKey={xAxisKey} {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            {showLegend && <Legend />}
            {Array.isArray(dataKey) ? (
              dataKey.map((key, index) => (
                <Area
                  key={key}
                  type="monotone"
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                  strokeWidth={2}
                />
              ))
            ) : (
              <Area
                type="monotone"
                dataKey={dataKey}
                stroke={colors[0]}
                fill={colors[0]}
                fillOpacity={0.6}
                strokeWidth={2}
              />
            )}
          </AreaChart>
        );

      case 'pie':
        return (
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ percent }) => `${(percent * 100).toFixed(0)}%`}
              outerRadius={100}
              fill="#8884d8"
              dataKey={typeof dataKey === 'string' ? dataKey : 'value'}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={tooltipStyle} />
            {showLegend && <Legend />}
          </PieChart>
        );

      case 'radar':
        return (
          <RadarChart {...commonProps}>
            <PolarGrid stroke="#374151" />
            <PolarAngleAxis dataKey={xAxisKey} {...axisStyle} />
            <PolarRadiusAxis {...axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            {showLegend && <Legend />}
            {Array.isArray(dataKey) ? (
              dataKey.map((key, index) => (
                <Radar
                  key={key}
                  name={key}
                  dataKey={key}
                  stroke={colors[index % colors.length]}
                  fill={colors[index % colors.length]}
                  fillOpacity={0.6}
                />
              ))
            ) : (
              <Radar
                name={dataKey}
                dataKey={dataKey}
                stroke={colors[0]}
                fill={colors[0]}
                fillOpacity={0.6}
              />
            )}
          </RadarChart>
        );

      default:
        return <div />;
    }
  };

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
        <Suspense fallback={<div className="animate-pulse bg-gray-700 h-full rounded" style={{ height }} />}>
          <ResponsiveContainerComponent width="100%" height={height}>
            {renderChart()}
          </ResponsiveContainerComponent>
        </Suspense>
      </CardContent>
    </Card>
  );
}