'use client';

import React, { useState } from 'react';
import { TasksTable } from '@/components/dashboard/TasksTable';
import { TaskCalendar } from '@/components/dashboard/TaskCalendar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CheckSquare, Clock, AlertCircle, TrendingUp, List, Calendar } from 'lucide-react';
import { useTasks, useTaskStatistics } from '@/hooks/useTasks';
import { LoadingState } from '@/components/ui/loading-states';

export default function TaskManagementPage() {
  const { tasks, loading: tasksLoading } = useTasks();
  const { statistics, loading: statsLoading } = useTaskStatistics();

  // Calculate task statistics
  const completedTasks = tasks.filter(task => task.status === 'completed').length;
  const inProgressTasks = tasks.filter(task => task.status === 'in_progress').length;
  const pendingTasks = tasks.filter(task => task.status === 'pending').length;
  
  // Calculate due today tasks
  const today = new Date();
  const dueTodayTasks = tasks.filter(task => {
    if (!task.due_date) return false;
    const dueDate = new Date(task.due_date);
    return dueDate.toDateString() === today.toDateString() && 
           !['completed', 'cancelled'].includes(task.status);
  }).length;

  // Calculate productivity as completion rate
  const totalTasks = tasks.length;
  const productivityRate = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return (
    <>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Task Management</h1>
          <p className="text-gray-400 mt-2">Track and manage all your recruitment tasks in one place</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-green-400" />
                Completed
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <LoadingState variant="skeleton" className="h-8 w-12 mb-2" />
              ) : (
                <div className="text-2xl font-bold text-white">{completedTasks}</div>
              )}
              <p className="text-xs text-gray-400">Total completed</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                In Progress
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <LoadingState variant="skeleton" className="h-8 w-12 mb-2" />
              ) : (
                <div className="text-2xl font-bold text-white">{inProgressTasks}</div>
              )}
              <p className="text-xs text-gray-400">Active tasks</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-yellow-400" />
                Due Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <LoadingState variant="skeleton" className="h-8 w-12 mb-2" />
              ) : (
                <div className="text-2xl font-bold text-white">{dueTodayTasks}</div>
              )}
              <p className="text-xs text-gray-400">Urgent tasks</p>
            </CardContent>
          </Card>

          <Card className="bg-white/5 backdrop-blur-xl border-white/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                Productivity
              </CardTitle>
            </CardHeader>
            <CardContent>
              {tasksLoading ? (
                <LoadingState variant="skeleton" className="h-8 w-12 mb-2" />
              ) : (
                <div className="text-2xl font-bold text-white">{productivityRate}%</div>
              )}
              <p className="text-xs text-gray-400">Completion rate</p>
            </CardContent>
          </Card>
        </div>

        <Card className="bg-white/5 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="text-white">Task Management</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="list" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/5 border-white/10">
                <TabsTrigger 
                  value="list"
                  className="flex items-center gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  <List className="w-4 h-4" />
                  List View
                </TabsTrigger>
                <TabsTrigger 
                  value="calendar"
                  className="flex items-center gap-2 data-[state=active]:bg-white/10 data-[state=active]:text-white"
                >
                  <Calendar className="w-4 h-4" />
                  Calendar View
                </TabsTrigger>
              </TabsList>
              <TabsContent value="list" className="mt-4">
                <TasksTable />
              </TabsContent>
              <TabsContent value="calendar" className="mt-4">
                <TaskCalendar />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </>
  );
}