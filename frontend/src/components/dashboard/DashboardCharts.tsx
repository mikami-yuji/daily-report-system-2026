'use client';

import React from 'react';
import { TrendingUp, Star, BarChart3 } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

type ChartDataPoint = {
  month: string;
  visits: number;
  calls: number;
  priorityVisits: number;
  priorityCalls: number;
};

type CustomerRankData = {
  name: string;
  visits: number;
  calls: number;
  total: number;
};

type DashboardChartsProps = {
  backendStats: {
    monthly: ChartDataPoint[];
    priority: {
      uniqueCustomers: number;
      visits: number;
      calls: number;
    };
    ranking: CustomerRankData[];
  };
};

function StatRow({ label, value, color = "text-sf-text" }: { label: string, value: number, color?: string }): React.JSX.Element {
  return (
    <div className="flex justify-between items-center p-3 bg-gray-50 rounded">
      <span className="text-sm text-sf-text-weak">{label}</span>
      <span className={`text-xl font-bold ${color}`}>{value}</span>
    </div>
  );
}

export default function DashboardCharts({ backendStats }: DashboardChartsProps): React.JSX.Element {
  const chartData = [...(backendStats.monthly || [])].reverse();

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 活動推移 (月別) */}
        <div className="lg:col-span-2 bg-white rounded border border-sf-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="text-sf-light-blue" size={20} />
            <h2 className="font-semibold text-lg text-sf-text">活動推移 (月別)</h2>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="visits" name="訪問" fill="#8884d8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="calls" name="電話" fill="#82ca9d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 重点顧客状況 */}
        <div className="bg-white rounded border border-sf-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-4">
            <Star className="text-yellow-500" size={20} />
            <h2 className="font-semibold text-lg text-sf-text">重点顧客状況</h2>
          </div>
          <div className="space-y-4">
            <StatRow label="対象顧客数" value={backendStats.priority.uniqueCustomers} />
            <StatRow label="訪問件数" value={backendStats.priority.visits} color="text-purple-600" />
            <StatRow label="電話件数" value={backendStats.priority.calls} color="text-orange-600" />
          </div>
        </div>
      </div>

      {/* 得意先別 活動ランキング (Top 10) */}
      <div className="bg-white rounded border border-sf-border shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="text-sf-light-blue" size={20} />
          <h2 className="font-semibold text-lg text-sf-text">得意先別 活動ランキング (Top 10)</h2>
        </div>
        <div style={{ width: '100%', height: 400 }}>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart layout="vertical" data={backendStats.ranking} margin={{ left: 40 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis type="number" />
              <YAxis dataKey="name" type="category" width={150} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="visits" name="訪問" fill="#8884d8" stackId="a" />
              <Bar dataKey="calls" name="電話" fill="#82ca9d" stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
