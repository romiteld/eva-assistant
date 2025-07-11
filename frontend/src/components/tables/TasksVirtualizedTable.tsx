import React, { useState, useEffect, useRef, useCallback } from 'react';
import { CheckCircle, Clock, AlertCircle, Calendar, User } from 'lucide-react';
import { VirtualizedList, VirtualizedListRef } from '../virtualized/VirtualizedList';
import { getPaginatedTasks } from '@/lib/supabase/pagination';
import { useAuth } from '@/app/providers';
import { useServerPagination } from '@/hooks/usePagination';

interface Task {
  id: string;
  title: string;
  description?: string;
  priority: number;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  due_date?: string;
  assigned_agent?: string;
  created_at: string;
  updated_at: string;
  completed_at?: string;
}

export default function TasksVirtualizedTable() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const listRef = useRef<VirtualizedListRef>(null);
  
  const {
    currentPage,
    pageSize,
    totalItems,
    isLoading,
    error,
    setPage,
    setTotalItems
  } = useServerPagination({
    initialPageSize: 50,
    onPageChange: async (page, size) => {
      await fetchTasks(page, size);
    }
  });

  // Fetch tasks
  const fetchTasks = useCallback(async (page: number, size: number) => {
    if (!user) return;

    try {
      const result = await getPaginatedTasks(user.id, {
        page,
        pageSize: size,
        sortBy: 'priority',
        sortDirection: 'desc'
      });

      if (page === 1) {
        setTasks(result.data);
      } else {
        setTasks(prev => [...prev, ...result.data]);
      }
      
      setTotalItems(result.totalCount);
      setHasMore(page < result.totalPages);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchTasks(1, pageSize);
    }
  }, [user, fetchTasks, pageSize]);

  // Load more tasks
  const loadMore = useCallback(async () => {
    if (!hasMore || isLoading) return;
    
    const nextPage = Math.ceil(tasks.length / pageSize) + 1;
    await setPage(nextPage);
  }, [hasMore, isLoading, tasks.length, pageSize, setPage]);

  // Get status icon and color
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-yellow-500 animate-pulse" />;
      case 'cancelled':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  // Get priority color
  const getPriorityColor = (priority: number) => {
    if (priority >= 0.8) return 'bg-red-900/50 text-red-300';
    if (priority >= 0.6) return 'bg-yellow-900/50 text-yellow-300';
    if (priority >= 0.4) return 'bg-blue-900/50 text-blue-300';
    return 'bg-gray-900/50 text-gray-300';
  };

  // Calculate item height based on content
  const getItemHeight = (index: number) => {
    const task = tasks[index];
    if (!task) return 80;
    
    // Base height + extra for description
    return task.description ? 100 : 80;
  };

  // Render task item
  const renderTask = (task: Task, index: number, style: React.CSSProperties) => {
    return (
      <div
        style={style}
        className="px-6 py-3 border-b border-gray-800 hover:bg-gray-800/30 transition-colors cursor-pointer"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-3 flex-1">
            {/* Status Icon */}
            <div className="mt-1">
              {getStatusIcon(task.status)}
            </div>
            
            {/* Task Details */}
            <div className="flex-1 min-w-0">
              <h3 className="font-medium text-sm text-gray-100 truncate">
                {task.title}
              </h3>
              {task.description && (
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                  {task.description}
                </p>
              )}
              
              {/* Metadata */}
              <div className="flex items-center space-x-4 mt-2">
                {task.assigned_agent && (
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <User className="w-3 h-3" />
                    <span>{task.assigned_agent}</span>
                  </div>
                )}
                
                {task.due_date && (
                  <div className="flex items-center space-x-1 text-xs text-gray-400">
                    <Calendar className="w-3 h-3" />
                    <span>{new Date(task.due_date).toLocaleDateString()}</span>
                  </div>
                )}
                
                <span className="text-xs text-gray-500">
                  Updated {new Date(task.updated_at).toLocaleTimeString()}
                </span>
              </div>
            </div>
          </div>
          
          {/* Priority Badge */}
          <div className="ml-4">
            <span className={`px-2 py-1 rounded text-xs font-medium ${getPriorityColor(task.priority)}`}>
              P{Math.round(task.priority * 10)}
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800">
      <div className="px-6 py-4 border-b border-gray-800 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Tasks</h2>
          <p className="text-sm text-gray-400 mt-1">
            {totalItems} total tasks • {tasks.filter(t => t.status === 'in_progress').length} in progress
          </p>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={() => listRef.current?.scrollToTop()}
            className="px-3 py-1 text-sm bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            Scroll to Top
          </button>
        </div>
      </div>
      
      {/* Virtualized List */}
      <div className="relative">
        <VirtualizedList
          ref={listRef}
          items={tasks}
          height={600}
          itemHeight={getItemHeight}
          renderItem={renderTask}
          onLoadMore={loadMore}
          hasMore={hasMore}
          isLoading={isLoading}
          threshold={10}
          overscan={5}
          className="scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-900"
          emptyMessage="No tasks found"
          loadingComponent={
            <div className="flex items-center justify-center space-x-2 text-gray-400 py-4">
              <div className="w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
              <span>Loading more tasks...</span>
            </div>
          }
        />
      </div>
      
      {/* Summary Stats */}
      <div className="px-6 py-3 border-t border-gray-800 flex items-center justify-between text-sm">
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-gray-400">
              {tasks.filter(t => t.status === 'completed').length} Completed
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <Clock className="w-4 h-4 text-yellow-500" />
            <span className="text-gray-400">
              {tasks.filter(t => t.status === 'in_progress').length} In Progress
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-blue-500" />
            <span className="text-gray-400">
              {tasks.filter(t => t.status === 'pending').length} Pending
            </span>
          </div>
        </div>
        
        {error && (
          <span className="text-red-400 text-xs">
            Error loading tasks
          </span>
        )}
      </div>
    </div>
  );
}