'use client';

import React from 'react';
import Link from 'next/link';
import { Star } from 'lucide-react';
import { Report } from '@/lib/api';

type RecentReportsTableProps = {
  reports: Report[];
};

export default function RecentReportsTable({ reports }: RecentReportsTableProps): React.JSX.Element {
  return (
    <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex justify-between items-center">
        <h2 className="font-semibold text-sm text-sf-text">最近の日報</h2>
        <Link href="/reports" className="text-sm text-sf-light-blue hover:underline">すべて表示</Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-sf-text-weak bg-gray-50 border-b border-sf-border">
            <tr>
              <th className="px-4 py-3 font-medium">日付</th>
              <th className="px-4 py-3 font-medium">訪問先</th>
              <th className="px-4 py-3 font-medium">行動内容</th>
              <th className="px-4 py-3 font-medium">重点</th>
              <th className="px-4 py-3 font-medium">面談者</th>
            </tr>
          </thead>
          <tbody>
            {reports.slice(0, 10).map((report: Report, i: number) => (
              <tr key={i} className="border-b border-sf-border hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 text-sf-text">{report.日付}</td>
                <td className="px-4 py-3 font-medium text-sf-light-blue">
                  <Link href={`/customers/${report.得意先CD}`} className="hover:underline">{report.訪問先名}</Link>
                </td>
                <td className="px-4 py-3 text-sf-text">{report.行動内容}</td>
                <td className="px-4 py-3 text-center">
                  {report.重点顧客 && report.重点顧客 !== '-' && <Star size={16} className="text-yellow-500 inline" />}
                </td>
                <td className="px-4 py-3 text-sf-text">{report.面談者}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
