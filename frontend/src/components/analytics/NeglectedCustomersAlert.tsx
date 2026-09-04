'use client';

import React, { useState } from 'react';
import { NeglectedCustomerAlert } from '@/types/analytics';
import { AlertCircle, Clock, ChevronDown, ChevronUp, PlusCircle, ExternalLink, ShieldAlert, CheckCircle2, Building, MessageSquare, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface NeglectedCustomersAlertProps {
    alerts: NeglectedCustomerAlert[];
    onSelectCustomer?: (customerCode: string, customerName: string) => void;
}

export default function NeglectedCustomersAlert({ alerts, onSelectCustomer }: NeglectedCustomersAlertProps): React.JSX.Element {
    const [filter, setFilter] = useState<'all' | 'danger' | 'warning'>('all');
    const [expandedCodes, setExpandedCodes] = useState<Set<string>>(new Set());

    // フィルタリング
    const dangerAlerts = alerts.filter(a => a.alertLevel === 'danger');
    const warningAlerts = alerts.filter(a => a.alertLevel === 'warning');

    const filteredAlerts = alerts.filter(a => {
        if (filter === 'danger') return a.alertLevel === 'danger';
        if (filter === 'warning') return a.alertLevel === 'warning';
        return a.alertLevel === 'danger' || a.alertLevel === 'warning';
    });

    const toggleExpand = (code: string) => {
        setExpandedCodes(prev => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    if (dangerAlerts.length === 0 && warningAlerts.length === 0) {
        return (
            <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-5 mb-6 text-emerald-800 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div>
                    <h3 className="font-bold text-sm">重点顧客の接触状況は極めて良好です</h3>
                    <p className="text-xs text-emerald-700 mt-0.5">
                        すべての重点顧客に対して当月の定期的な接触（訪問・電話）が行われています。
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 md:p-6 mb-8">
            {/* ヘッダー */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-4 border-b border-gray-100">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-rose-100 text-rose-700">
                            <ShieldAlert size={18} />
                        </span>
                        <h2 className="text-lg font-bold text-gray-900">
                            重点顧客 フォロー推奨アラート
                        </h2>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        マトリクスの中で接触が滞っている重点顧客を自動抽出しています。競合他社流出を防ぐため優先してフォローを行ってください。
                    </p>
                </div>

                {/* フィルターボタン */}
                <div className="flex bg-gray-100 p-1 rounded-lg text-xs font-medium self-end sm:self-auto">
                    <button
                        onClick={() => setFilter('all')}
                        className={`px-3 py-1.5 rounded-md transition-colors ${
                            filter === 'all' ? 'bg-white text-gray-900 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        すべて ({dangerAlerts.length + warningAlerts.length})
                    </button>
                    <button
                        onClick={() => setFilter('danger')}
                        className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                            filter === 'danger' ? 'bg-rose-600 text-white shadow-sm font-bold' : 'text-rose-700 hover:bg-rose-50'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-rose-400"></span>
                        30日超未接触 ({dangerAlerts.length})
                    </button>
                    <button
                        onClick={() => setFilter('warning')}
                        className={`px-3 py-1.5 rounded-md transition-colors flex items-center gap-1 ${
                            filter === 'warning' ? 'bg-amber-600 text-white shadow-sm font-bold' : 'text-amber-700 hover:bg-amber-50'
                        }`}
                    >
                        <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                        今月未接触 ({warningAlerts.length})
                    </button>
                </div>
            </div>

            {/* アラート一覧リスト */}
            <div className="mt-4 space-y-2.5 max-h-[360px] overflow-y-auto pr-1">
                {filteredAlerts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-gray-500">
                        該当する顧客はありません
                    </div>
                ) : (
                    filteredAlerts.map(alert => {
                        const isExpanded = expandedCodes.has(alert.code);
                        const isDanger = alert.alertLevel === 'danger';

                        return (
                            <div
                                key={alert.code}
                                className={`border rounded-lg transition-all ${
                                    isDanger
                                        ? 'bg-rose-50/30 border-rose-200 hover:border-rose-300'
                                        : 'bg-amber-50/20 border-amber-200 hover:border-amber-300'
                                }`}
                            >
                                <div className="p-3 sm:p-3.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                        <div className="pt-0.5 shrink-0">
                                            {isDanger ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                                    30日超未接触
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                                                    今月未接触
                                                </span>
                                            )}
                                        </div>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-sm text-gray-900 truncate">
                                                    {alert.name}
                                                </span>
                                                {alert.area && (
                                                    <span className="text-[11px] text-gray-500 bg-gray-100 px-1.5 py-0.2 rounded">
                                                        {alert.area}
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex items-center gap-4 text-xs text-gray-500 mt-1 flex-wrap">
                                                <span className="flex items-center gap-1">
                                                    <Clock size={12} className={isDanger ? 'text-rose-600' : 'text-amber-600'} />
                                                    最終接触: <strong className="text-gray-700">{alert.lastActivityDate || '記録なし'}</strong>
                                                    {alert.daysSinceLastActivity < 999 && (
                                                        <span className={`font-semibold ${isDanger ? 'text-rose-700' : 'text-amber-700'}`}>
                                                            ({alert.daysSinceLastActivity}日前)
                                                        </span>
                                                    )}
                                                </span>
                                                <span>
                                                    前月接触: <strong className="text-gray-700">{alert.previousMonthCount}回</strong>
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 右側アクション */}
                                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                        {(alert.lastBusinessContent || alert.lastNextPlan) && (
                                            <button
                                                onClick={() => toggleExpand(alert.code)}
                                                className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:text-gray-900 bg-white border border-gray-200 rounded-md hover:bg-gray-50 transition-colors flex items-center gap-1"
                                                title="直近の商談メモを表示"
                                            >
                                                <MessageSquare size={13} />
                                                前回のメモ
                                                {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                            </button>
                                        )}

                                        <Link
                                            href={`/reports/batch`}
                                            className="px-3 py-1 text-xs font-bold text-white bg-sf-light-blue hover:bg-blue-600 rounded-md shadow-sm transition-colors flex items-center gap-1"
                                            title="この顧客の日報を作成"
                                        >
                                            <PlusCircle size={13} />
                                            日報作成
                                        </Link>
                                    </div>
                                </div>

                                {/* 前回の商談メモアコーディオン */}
                                {isExpanded && (alert.lastBusinessContent || alert.lastNextPlan) && (
                                    <div className="px-4 pb-3 pt-1 border-t border-gray-100 bg-white/70 rounded-b-lg text-xs space-y-1.5">
                                        {alert.lastBusinessContent && (
                                            <div className="text-gray-700">
                                                <span className="font-semibold text-gray-500 mr-2">前回の商談:</span>
                                                {alert.lastBusinessContent}
                                            </div>
                                        )}
                                        {alert.lastNextPlan && (
                                            <div className="text-blue-800">
                                                <span className="font-semibold text-blue-600 mr-2">次回プラン:</span>
                                                {alert.lastNextPlan}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
