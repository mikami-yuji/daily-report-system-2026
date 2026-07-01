'use client';

import React from 'react';
import { FileText, Calendar, Users, Phone } from 'lucide-react';
import KPICard from '@/components/KPICard';

type KPICardsProps = {
  stats: {
    totalReports: number;
    thisMonth: number;
    visits: number;
    calls: number;
  };
};

export default function KPICards({ stats }: KPICardsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <KPICard 
        title="総日報数" 
        value={stats.totalReports} 
        icon={FileText} 
        color="blue"
      />
      <KPICard 
        title="今月の日報" 
        value={stats.thisMonth} 
        icon={Calendar} 
        color="green"
      />
      <KPICard 
        title="累計訪問件数" 
        value={stats.visits} 
        icon={Users} 
        color="purple"
      />
      <KPICard 
        title="累計電話件数" 
        value={stats.calls} 
        icon={Phone} 
        color="orange"
      />
    </div>
  );
}
