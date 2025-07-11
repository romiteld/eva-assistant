import React, { useState } from 'react';
import { CheckSquare, Clock, AlertCircle, Calendar, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface Task {
  id: string;
  title: string;
  description: string;
  assignee: string;
  status: 'pending' | 'in_progress' | 'completed';
  priority: 'low' | 'medium' | 'high';
  dueDate: string;
  createdAt: string;
}

const mockTasks: Task[] = [
  {
    id: '1',
    title: 'Review candidate applications',
    description: 'Review and shortlist candidates for Senior Financial Advisor position',
    assignee: 'John Doe',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2024-12-15',
    createdAt: '2024-12-10'
  },
  {
    id: '2',
    title: 'Schedule interviews',
    description: 'Coordinate interview times with shortlisted candidates',
    assignee: 'Jane Smith',
    status: 'pending',
    priority: 'medium',
    dueDate: '2024-12-16',
    createdAt: '2024-12-11'
  },
  {
    id: '3',
    title: 'Update job postings',
    description: 'Refresh job descriptions on all platforms',
    assignee: 'Mike Johnson',
    status: 'completed',
    priority: 'low',
    dueDate: '2024-12-12',
    createdAt: '2024-12-08'
  },
  {
    id: '4',
    title: 'Client follow-up',
    description: 'Send progress update to Wells Fargo recruitment team',
    assignee: 'Sarah Wilson',
    status: 'in_progress',
    priority: 'high',
    dueDate: '2024-12-14',
    createdAt: '2024-12-09'
  },
  {
    id: '5',
    title: 'Reference checks',
    description: 'Conduct reference checks for final candidates',
    assignee: 'John Doe',
    status: 'pending',
    priority: 'medium',
    dueDate: '2024-12-18',
    createdAt: '2024-12-10'
  }
];

export function TasksTable() {
  const [tasks] = useState<Task[]>(mockTasks);

  const getStatusIcon = (status: Task['status']) => {
    switch (status) {
      case 'completed':
        return <CheckSquare className="w-4 h-4 text-green-400" />;
      case 'in_progress':
        return <Clock className="w-4 h-4 text-blue-400" />;
      case 'pending':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
    }
  };

  const getPriorityColor = (priority: Task['priority']) => {
    switch (priority) {
      case 'high':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
    }
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="text-left border-b border-white/10">
            <th className="pb-3 text-sm font-medium text-gray-400">Task</th>
            <th className="pb-3 text-sm font-medium text-gray-400">Assignee</th>
            <th className="pb-3 text-sm font-medium text-gray-400">Status</th>
            <th className="pb-3 text-sm font-medium text-gray-400">Priority</th>
            <th className="pb-3 text-sm font-medium text-gray-400">Due Date</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task: Task) => (
            <tr key={task.id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
              <td className="py-4">
                <div>
                  <h4 className="text-white font-medium">{task.title}</h4>
                  <p className="text-sm text-gray-400 mt-1">{task.description}</p>
                </div>
              </td>
              <td className="py-4">
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">{task.assignee}</span>
                </div>
              </td>
              <td className="py-4">
                <div className="flex items-center gap-2">
                  {getStatusIcon(task.status)}
                  <span className="text-sm text-gray-300 capitalize">
                    {task.status.replace('_', ' ')}
                  </span>
                </div>
              </td>
              <td className="py-4">
                <Badge 
                  variant="outline" 
                  className={getPriorityColor(task.priority)}
                >
                  {task.priority}
                </Badge>
              </td>
              <td className="py-4">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span className="text-sm text-gray-300">{formatDate(task.dueDate)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}