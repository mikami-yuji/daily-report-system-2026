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
    AlertCircle
} from 'lucide-react';
import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false);
    const pathname = usePathname();

    const navItems = [
        { name: 'ホーム', href: '/', icon: LayoutDashboard },
        { name: '日報一覧', href: '/reports', icon: FileText },
        { name: '得意先一覧', href: '/customers', icon: Users },
        { name: 'デザイン検索', href: '/design-search', icon: Package },
        { name: '競合他社情報', href: '/competitor-info', icon: AlertCircle },
        { name: '分析・レポート', href: '/analytics', icon: BarChart2 },
        { name: '設定', href: '/settings', icon: Settings },
    ];

    return (
        <div
            className={`bg-white border-r border-sf-border h-screen flex flex-col transition-all duration-300 ${collapsed ? 'w-16' : 'w-64'
                }`}
        >
            {/* App Header in Sidebar */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-sf-border bg-sf-blue text-white">
                {!collapsed && <span className="font-bold text-lg truncate">Sales Support</span>}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1 hover:bg-white/10 rounded"
                >
                    {collapsed ? <Menu size={20} /> : <ChevronLeft size={20} />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = pathname === item.href;
                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={`flex items-center px-4 py-3 text-sm font-medium transition-colors border-l-4 ${isActive
                                ? 'border-sf-light-blue text-sf-light-blue bg-blue-50'
                                : 'border-transparent text-sf-text-weak hover:bg-gray-50 hover:text-sf-text'
                                }`}
                        >
                            <item.icon size={20} className={collapsed ? 'mx-auto' : 'mr-3'} />
                            {!collapsed && <span>{item.name}</span>}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer / User Info (Simplified) */}
            <div className="p-4 border-t border-sf-border">
                <div className="flex items-center">
                    <div className="w-8 h-8 rounded-full bg-sf-light-blue flex items-center justify-center text-white font-bold text-xs">
                        MY
                    </div>
                    {!collapsed && (
                        <div className="ml-3">
                            <p className="text-sm font-medium text-sf-text">見上 祐司</p>
                            <p className="text-xs text-sf-text-weak">営業部</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
