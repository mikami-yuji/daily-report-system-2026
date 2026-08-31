'use client';

import {
    LayoutDashboard,
    FileText,
    BarChart2,
    Settings,
    ChevronLeft,
    Menu,
    Users,
    Package,
    AlertCircle,
    AlertTriangle,
    Calendar,
    Building2,
    ClipboardList,
    FileBarChart2
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOffline } from '@/context/OfflineContext';
import { CloudOff, RefreshCw, CheckCircle } from 'lucide-react';

function SyncStatus({ collapsed }: { collapsed: boolean }) {
    const { isOnline, offlineReports, syncReports } = useOffline();
    const pendingCount = offlineReports.filter(r => r.status === 'pending' || r.status === 'error').length;
    const syncingCount = offlineReports.filter(r => r.status === 'syncing').length;

    if (pendingCount === 0 && syncingCount === 0 && isOnline) return null;

    return (
        <div className={`mb-2 p-2 rounded text-xs flex items-center gap-2 ${!isOnline ? 'bg-gray-100 text-gray-600' :
            syncingCount > 0 ? 'bg-blue-50 text-blue-600' :
                'bg-yellow-50 text-yellow-600'
            }`}>
            {syncingCount > 0 ? (
                <RefreshCw size={16} className="animate-spin" />
            ) : !isOnline ? (
                <CloudOff size={16} />
            ) : (
                <CheckCircle size={16} />
            )}

            {!collapsed && (
                <div className="flex-1">
                    {!isOnline ? (
                        <span>オフライン ({pendingCount}件未送信)</span>
                    ) : syncingCount > 0 ? (
                        <span>同期中... ({syncingCount}件)</span>
                    ) : (
                        <button onClick={() => syncReports()} className="hover:underline text-left">
                            {pendingCount}件の未送信データ
                            <br />
                            <span className="text-[10px] opacity-75">クリックして同期</span>
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    const navItems = [
        { name: 'ホーム', href: '/', icon: LayoutDashboard },
        { name: '日報一覧', href: '/reports', icon: FileText },
        { name: '新規日報作成', href: '/reports/batch', icon: ClipboardList },
        { name: '得意先一覧', href: '/customers', icon: Users },
        { name: 'カレンダー', href: '/calendar', icon: Calendar },
        { name: 'デザイン検索', href: '/design-search', icon: Package },
        { name: '量販店調査検索', href: '/mass-retailer-survey', icon: Building2 },
        { name: '競合他社情報', href: '/competitor-info', icon: AlertCircle },
        { name: 'クレーム対応', href: '/complaints', icon: AlertTriangle },
        { name: '月次サマリー', href: '/reports/summary', icon: FileBarChart2 },
        { name: '全メンバー分析', href: '/analytics/members', icon: Users },
        { name: '分析・レポート', href: '/analytics', icon: BarChart2 },
        { name: '売上分析', href: '/sales-analysis', icon: BarChart2 },
        { name: '設定', href: '/settings', icon: Settings },
    ];

    return (
        <div
            className={`bg-white border-r border-sf-border h-screen flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'
                }`}
        >
            {/* App Header in Sidebar */}
            <div className="h-14 flex-shrink-0 flex items-center justify-between px-4 border-b border-sf-border bg-sf-blue text-white">
                {!collapsed && <span className="font-bold text-lg truncate">Sales Support</span>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 hover:bg-white/10 rounded"
                    title={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
                    aria-label={collapsed ? "サイドバーを開く" : "サイドバーを閉じる"}
                >
                    {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            {/* Navigation (Scrollable & Compact) */}
            <nav className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-2 space-y-0.5">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            prefetch={false}
                            className={`flex items-center px-3.5 py-2 text-sm font-medium transition-colors border-l-4 ${isActive
                                ? 'border-sf-light-blue text-sf-light-blue bg-blue-50 font-semibold'
                                : 'border-transparent text-sf-text-weak hover:bg-gray-50 hover:text-sf-text'
                                }`}
                            title={collapsed ? item.name : undefined}
                        >
                            <item.icon size={18} className={collapsed ? 'mx-auto' : 'mr-3 flex-shrink-0'} />
                            {!collapsed && <span className="truncate">{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / User Info (Simplified) */}
            <div className="p-3 border-t border-sf-border flex-shrink-0">
                <SyncStatus collapsed={collapsed} />
            </div>
        </div>
    );
}
