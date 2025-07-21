'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useZoomMeetings } from '@/hooks/useZoomMeetings'
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend 
} from 'recharts'
import { 
  Video, 
  Users, 
  Clock, 
  Calendar,
  TrendingUp,
  Activity,
  FileVideo,
  Wifi
} from 'lucide-react'

export function ZoomAnalytics() {
  const { meetings, loading } = useZoomMeetings()
  const [analytics, setAnalytics] = useState({
    totalMeetings: 0,
    totalDuration: 0,
    averageDuration: 0,
    totalParticipants: 0,
    meetingsByType: [] as any[],
    meetingsByDay: [] as any[],
    participationTrend: [] as any[],
    recordingStats: {
      total: 0,
      totalSize: 0
    }
  })

  const calculateAnalytics = useCallback(() => {
    const totalMeetings = meetings.length
    const totalDuration = meetings.reduce((sum, m) => sum + (m.duration || 0), 0)
    const averageDuration = totalMeetings > 0 ? Math.round(totalDuration / totalMeetings) : 0

    // Calculate meetings by type
    const typeCount: Record<string, number> = {}
    meetings.forEach(meeting => {
      const type = meeting.type === 1 ? 'Instant' : 'Scheduled'
      typeCount[type] = (typeCount[type] || 0) + 1
    })

    const meetingsByType = Object.entries(typeCount).map(([name, value]) => ({
      name,
      value,
      percentage: Math.round((value / totalMeetings) * 100)
    }))

    // Calculate meetings by day of week
    const dayCount: Record<string, number> = {
      'Mon': 0, 'Tue': 0, 'Wed': 0, 'Thu': 0, 'Fri': 0, 'Sat': 0, 'Sun': 0
    }
    meetings.forEach(meeting => {
      const day = new Date(meeting.start_time).toLocaleDateString('en', { weekday: 'short' })
      if (day in dayCount) {
        dayCount[day]++
      }
    })

    const meetingsByDay = Object.entries(dayCount).map(([day, count]) => ({
      day,
      count
    }))

    // Calculate participation trend (last 7 days)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date()
      date.setDate(date.getDate() - (6 - i))
      return date.toISOString().split('T')[0]
    })

    const participationByDay: Record<string, number> = {}
    last7Days.forEach(date => {
      participationByDay[date] = 0
    })

    meetings.forEach(meeting => {
      const date = new Date(meeting.start_time).toISOString().split('T')[0]
      if (date in participationByDay) {
        participationByDay[date]++
      }
    })

    const participationTrend = Object.entries(participationByDay).map(([date, count]) => ({
      date: new Date(date).toLocaleDateString('en', { month: 'short', day: 'numeric' }),
      meetings: count
    }))

    setAnalytics({
      totalMeetings,
      totalDuration,
      averageDuration,
      totalParticipants: 0, // Participant data not available in current API
      meetingsByType,
      meetingsByDay,
      participationTrend,
      recordingStats: {
        total: 0, // Recording data requires separate API call
        totalSize: 0 // Would need to calculate from recording data
      }
    })
  }, [meetings])

  useEffect(() => {
    if (meetings.length > 0) {
      calculateAnalytics()
    }
  }, [meetings, calculateAnalytics])

  const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042']

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Meetings</p>
                <p className="text-2xl font-bold">{analytics.totalMeetings}</p>
              </div>
              <Video className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Duration</p>
                <p className="text-2xl font-bold">{Math.round(analytics.totalDuration / 60)}h</p>
              </div>
              <Clock className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Average Duration</p>
                <p className="text-2xl font-bold">{analytics.averageDuration}m</p>
              </div>
              <Activity className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">With Recordings</p>
                <p className="text-2xl font-bold">{analytics.recordingStats.total}</p>
              </div>
              <FileVideo className="h-8 w-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Meeting Types */}
        <Card>
          <CardHeader>
            <CardTitle>Meeting Types</CardTitle>
            <CardDescription>Distribution of instant vs scheduled meetings</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analytics.meetingsByType}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.percentage}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {analytics.meetingsByType.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Meetings by Day */}
        <Card>
          <CardHeader>
            <CardTitle>Meetings by Day</CardTitle>
            <CardDescription>Meeting distribution across weekdays</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analytics.meetingsByDay}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#8884d8" />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Participation Trend */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Meeting Trend</CardTitle>
            <CardDescription>Meetings over the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={analytics.participationTrend}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="meetings" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  dot={{ fill: '#8884d8' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}