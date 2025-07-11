import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { DateRange } from '@/types/analytics';
import { cn } from '@/lib/utils';

interface DateRangePickerProps {
  dateRange: DateRange;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

const presetRanges = [
  { label: 'Today', value: 'today', days: 0 },
  { label: 'Yesterday', value: 'yesterday', days: 1 },
  { label: 'Last 7 days', value: 'last7days', days: 7 },
  { label: 'Last 30 days', value: 'last30days', days: 30 },
  { label: 'Last 90 days', value: 'last90days', days: 90 },
];

export default function DateRangePicker({
  dateRange,
  onDateRangeChange,
  className,
}: DateRangePickerProps) {
  const [isCustomOpen, setIsCustomOpen] = useState(false);
  const [tempStartDate, setTempStartDate] = useState<Date | undefined>(dateRange.startDate);
  const [tempEndDate, setTempEndDate] = useState<Date | undefined>(dateRange.endDate);

  const handlePresetSelect = (preset: string, days: number) => {
    const endDate = endOfDay(new Date());
    const startDate = days === 0 ? startOfDay(new Date()) : startOfDay(subDays(new Date(), days));
    
    onDateRangeChange({
      startDate,
      endDate,
      preset: preset as DateRange['preset'],
    });
  };

  const handleCustomRangeApply = () => {
    if (tempStartDate && tempEndDate) {
      onDateRangeChange({
        startDate: startOfDay(tempStartDate),
        endDate: endOfDay(tempEndDate),
        preset: 'custom',
      });
      setIsCustomOpen(false);
    }
  };

  const formatDateRange = () => {
    if (dateRange.preset && dateRange.preset !== 'custom') {
      const preset = presetRanges.find(p => p.value === dateRange.preset);
      return preset?.label || 'Select date range';
    }
    
    return `${format(dateRange.startDate, 'MMM d, yyyy')} - ${format(dateRange.endDate, 'MMM d, yyyy')}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "bg-gray-800 border-gray-700 hover:bg-gray-700 text-gray-300",
            "flex items-center space-x-2",
            className
          )}
        >
          <Calendar className="w-4 h-4" />
          <span>{formatDateRange()}</span>
          <ChevronDown className="w-4 h-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-gray-900 border-gray-700 text-gray-300 w-56"
      >
        {presetRanges.map(({ label, value, days }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => handlePresetSelect(value, days)}
            className="hover:bg-gray-800 cursor-pointer"
          >
            {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator className="bg-gray-700" />
        <Popover open={isCustomOpen} onOpenChange={setIsCustomOpen}>
          <PopoverTrigger asChild>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setIsCustomOpen(true);
              }}
              className="hover:bg-gray-800 cursor-pointer"
            >
              Custom range...
            </DropdownMenuItem>
          </PopoverTrigger>
          <PopoverContent
            className="bg-gray-900 border-gray-700 p-4"
            align="start"
            side="right"
            sideOffset={10}
          >
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">
                  Start Date
                </label>
                <CalendarComponent
                  mode="single"
                  selected={tempStartDate}
                  onSelect={setTempStartDate}
                  disabled={(date) => date > new Date()}
                  className="bg-gray-800 rounded-lg"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-gray-400 mb-2 block">
                  End Date
                </label>
                <CalendarComponent
                  mode="single"
                  selected={tempEndDate}
                  onSelect={setTempEndDate}
                  disabled={(date) => {
                    if (!tempStartDate) return true;
                    return date < tempStartDate || date > new Date();
                  }}
                  className="bg-gray-800 rounded-lg"
                />
              </div>
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsCustomOpen(false)}
                  className="bg-gray-800 border-gray-700 hover:bg-gray-700"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleCustomRangeApply}
                  disabled={!tempStartDate || !tempEndDate}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Apply
                </Button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}