import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

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
          <LineChart {...commonProps}>
            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="#374151" />}
            <XAxis dataKey={xAxisKey} {...axisStyle} />
            <YAxis {...axisStyle} />
            <Tooltip contentStyle={tooltipStyle} />
            {showLegend && <Legend />}
            {Array.isArray(dataKey) ? (
              dataKey.map((key, index) => (
                <Line
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
              <Line
                type="monotone"
                dataKey={dataKey}
                stroke={colors[0]}
                strokeWidth={2}
                dot={{ fill: colors[0], r: 4 }}
                activeDot={{ r: 6 }}
              />
            )}
          </LineChart>
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
        <ResponsiveContainer width="100%" height={height}>
          {renderChart()}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}