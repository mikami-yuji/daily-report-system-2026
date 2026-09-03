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
import { CloudOff, RefreshCw } from 'lucide-react';

function SyncStatus({ collapsed }: { collapsed: boolean }) {
    const { isOnline, fileServerConnected, pendingSyncCount, triggerServerSync, offlineReports, syncReports } = useOffline();
    const browserPending = offlineReports.filter(r => r.status === 'pending' || r.status === 'error').length;
    const browserSyncing = offlineReports.filter(r => r.status === 'syncing').length;

    const isServerOffline = !fileServerConnected;
    const totalPending = pendingSyncCount + browserPending;

    // 完全に正常な場合：安心の接続中インジケーター
    if (isOnline && !isServerOffline && totalPending === 0 && browserSyncing === 0) {
        if (collapsed) {
            return (
                <div className="flex justify-center" title="社内サーバー正常接続中">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100"></span>
                </div>
            );
        }
        return (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="font-medium">社内サーバー: 接続中</span>
            </div>
        );
    }

    // ブラウザ同期中
    if (browserSyncing > 0) {
        return (
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-blue-50 text-blue-700 text-xs border border-blue-200">
                <RefreshCw size={14} className="animate-spin text-blue-600" />
                {!collapsed && <span>データ同期中...</span>}
            </div>
        );
    }

    // ファイルサーバー切断または一時退避キューが存在する場合
    if (isServerOffline || totalPending > 0) {
        return (
            <div
                onClick={() => {
                    if (isOnline && fileServerConnected) {
                        triggerServerSync();
                        syncReports();
                    }
                }}
                className={`p-2 rounded-md text-xs cursor-pointer transition-all border ${
                    isServerOffline 
                        ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100' 
                        : 'bg-blue-50 text-blue-800 border-blue-300 hover:bg-blue-100'
                }`}
                title="クリックして最新状態をサーバーへ同期"
            >
                <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle size={14} className="text-amber-600 flex-shrink-0" />
                    {!collapsed && (
                        <div className="flex-1 truncate">
                            {isServerOffline ? 'ファイルサーバー切断中' : '一時退避データあり'}
                        </div>
                    )}
                </div>
                {!collapsed && (
                    <div className="mt-1 text-[11px] text-gray-600 pl-5">
                        {totalPending > 0 ? (
                            <>
                                <span className="font-bold text-amber-700">{totalPending}件</span> 退避中（復旧時自動反映）
                                <div className="text-[10px] text-blue-600 underline mt-0.5">今すぐ再同期を試す</div>
                            </>
                        ) : (
                            <span>ローカルキャッシュで閲覧中</span>
                        )}
                    </div>
                )}
            </div>
        );
    }

    // PC自体がオフライン
    return (
        <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-gray-100 text-gray-700 text-xs border border-gray-300">
            <CloudOff size={14} className="text-gray-500" />
            {!collapsed && <span>オフラインモード</span>}
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
