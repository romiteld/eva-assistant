'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { BarChart3, LineChart, PieChart, TrendingUp, Calendar, DollarSign } from 'lucide-react'

export default function TwilioAnalytics() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="space-y-6"
    >
      <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Analytics Dashboard</h2>
        <p className="text-gray-400 mb-6">Communication metrics and insights</p>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-white/5 rounded-lg">
            <BarChart3 className="w-8 h-8 text-purple-400 mb-2" />
            <h3 className="font-semibold text-white">Total Calls</h3>
            <p className="text-2xl font-bold text-purple-400">0</p>
            <p className="text-sm text-gray-400">This month</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <LineChart className="w-8 h-8 text-green-400 mb-2" />
            <h3 className="font-semibold text-white">Total SMS</h3>
            <p className="text-2xl font-bold text-green-400">0</p>
            <p className="text-sm text-gray-400">This month</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <TrendingUp className="w-8 h-8 text-blue-400 mb-2" />
            <h3 className="font-semibold text-white">Success Rate</h3>
            <p className="text-2xl font-bold text-blue-400">0%</p>
            <p className="text-sm text-gray-400">Average</p>
          </div>
          
          <div className="p-4 bg-white/5 rounded-lg">
            <DollarSign className="w-8 h-8 text-orange-400 mb-2" />
            <h3 className="font-semibold text-white">Total Cost</h3>
            <p className="text-2xl font-bold text-orange-400">$0</p>
            <p className="text-sm text-gray-400">This month</p>
          </div>
        </div>
        
        {/* Charts Placeholder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 bg-white/5 rounded-lg">
            <h3 className="font-semibold text-white mb-4">Call Volume Trend</h3>
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-white/20 rounded-lg">
              <LineChart className="w-12 h-12 text-gray-600" />
              <span className="ml-2 text-gray-400">Chart placeholder</span>
            </div>
          </div>
          
          <div className="p-6 bg-white/5 rounded-lg">
            <h3 className="font-semibold text-white mb-4">Communication Distribution</h3>
            <div className="h-48 flex items-center justify-center border-2 border-dashed border-white/20 rounded-lg">
              <PieChart className="w-12 h-12 text-gray-600" />
              <span className="ml-2 text-gray-400">Chart placeholder</span>
            </div>
          </div>
        </div>
        
        {/* Recent Activity */}
        <div className="mt-6 p-4 bg-white/5 rounded-lg">
          <h3 className="font-semibold text-white mb-3">Recent Activity</h3>
          <div className="space-y-2">
            {['No recent activity to display'].map((item, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-white/5 rounded">
                <Calendar className="w-4 h-4 text-gray-400" />
                <span className="text-gray-400 text-sm">{item}</span>
              </div>
            ))}
          </div>
        </div>
        
        <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
          <p className="text-yellow-400 text-sm">
            ⚠️ This is a placeholder component. Connect to Twilio Analytics API to display real data.
          </p>
        </div>
      </div>
    </motion.div>
  )
}