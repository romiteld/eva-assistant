import React, { memo } from 'react';
import { 
  TrendingUp, TrendingDown, Minus, 
  Users, Mail, Briefcase, CheckCircle, 
  Clock, Zap, BarChart3, Globe 
} from '@/lib/icons';
import { Card, CardContent } from '@/components/ui/card';
import { MetricData } from '@/types/analytics';
import { cn } from '@/lib/utils';

const iconMap: Record<string, any> = {
  users: Users,
  mail: Mail,
  briefcase: Briefcase,
  checkCircle: CheckCircle,
  clock: Clock,
  zap: Zap,
  barChart: BarChart3,
  globe: Globe,
};

interface MetricsCardProps {
  metric: MetricData;
  className?: string;
}

const MetricsCard = memo(function MetricsCard({ metric, className }: MetricsCardProps) {
  const Icon = metric.icon ? iconMap[metric.icon] : BarChart3;
  
  const getTrendIcon = () => {
    if (!metric.change) return null;
    
    if (metric.changeType === 'increase') {
      return <TrendingUp className="w-4 h-4" />;
    } else if (metric.changeType === 'decrease') {
      return <TrendingDown className="w-4 h-4" />;
    }
    return <Minus className="w-4 h-4" />;
  };
  
  const getTrendColor = () => {
    if (!metric.changeType) return 'text-gray-400';
    
    switch (metric.changeType) {
      case 'increase':
        return 'text-green-500';
      case 'decrease':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };
  
  const formatValue = (value: number, unit?: string) => {
    if (unit === 'percent') {
      return `${value}%`;
    } else if (unit === 'time') {
      return `${value}s`;
    } else if (unit === 'currency') {
      return `$${value.toLocaleString()}`;
    }
    return value.toLocaleString();
  };

  return (
    <Card className={cn(
      "bg-gradient-to-br from-gray-900 to-gray-800 border-gray-700 hover:border-gray-600 transition-all",
      className
    )}>
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <Icon className="w-5 h-5 text-gray-400" />
              <p className="text-sm text-gray-400">{metric.label}</p>
            </div>
            <div className="flex items-baseline space-x-2">
              <p className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
                {formatValue(metric.value, metric.unit)}
              </p>
              {metric.change !== undefined && (
                <div className={cn("flex items-center space-x-1 text-sm", getTrendColor())}>
                  {getTrendIcon()}
                  <span>{Math.abs(metric.change)}%</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

MetricsCard.displayName = 'MetricsCard';

export default MetricsCard;