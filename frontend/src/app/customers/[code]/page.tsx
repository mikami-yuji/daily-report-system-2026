'use client';

import { useEffect, useState } from 'react';
import { getReports, Report } from '@/lib/api';
import {
    User,
    MapPin,
    Calendar,
    Phone,
    FileText,
    Package,
    Layers,
    TrendingUp,
    Clock,
    ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

interface DesignRequest {
    designNo: number;
    designProposal: string;
    designType: string;
    designName: string;
    designProgress: string;
    requests: Report[];
    lastUpdate: string;
}

export default function CustomerDetailPage() {
    const params = useParams();
    const customerCode = params.code as string;

    const [reports, setReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [customerName, setCustomerName] = useState('');
    const [activeTab, setActiveTab] = useState<'timeline' | 'designs'>('timeline');
    const [designRequests, setDesignRequests] = useState<DesignRequest[]>([]);

    useEffect(() => {
        if (customerCode) {
            getReports().then(data => {
                const customerReports = data.filter(r => String(r.得意先CD) === customerCode);

                customerReports.sort((a, b) => {
                    const dateA = String(a.日付 || '');
                    const dateB = String(b.日付 || '');
                    return dateB.localeCompare(dateA);
                });

                setReports(customerReports);

                if (customerReports.length > 0) {
                    setCustomerName(customerReports[0].訪問先名 || '名称不明');
                }

                processDesignRequests(customerReports);
                setLoading(false);
            }).catch(err => {
                console.error(err);
                setLoading(false);
            });
        }
    }, [customerCode]);

    const processDesignRequests = (data: Report[]) => {
        const designMap = new Map<number, DesignRequest>();

        data.forEach(report => {
            const designNo = report['システム確認用デザインNo.'];
            if (designNo && !isNaN(Number(designNo))) {
                const numDesignNo = Number(designNo);

                if (!designMap.has(numDesignNo)) {
                    designMap.set(numDesignNo, {
                        designNo: numDesignNo,
                        designProposal: String(report['デザイン提案有無'] || ''),
                        designType: String(report['デザイン種別'] || ''),
                        designName: String(report['デザイン名'] || ''),
                        designProgress: String(report['デザイン進捗状況'] || ''),
                        requests: [],
                        lastUpdate: ''
                    });
                }

                designMap.get(numDesignNo)!.requests.push(report);
            }
        });

        const requests = Array.from(designMap.values()).map(req => {
            req.requests.sort((a, b) => {
                const dateA = String(a.日付 || '');
                const dateB = String(b.日付 || '');
                return dateB.localeCompare(dateA);
            });
            req.lastUpdate = req.requests[0]?.日付 || '';
            return req;
        });

        requests.sort((a, b) => b.lastUpdate.localeCompare(a.lastUpdate));
        setDesignRequests(requests);
    };

    const getProgressBadge = (progress: string) => {
        const colorMap: Record<string, string> = {
            '完了': 'bg-green-100 text-green-800',
            '進行中': 'bg-blue-100 text-blue-800',
            '保留': 'bg-yellow-100 text-yellow-800',
            '未着手': 'bg-gray-100 text-gray-800',
        };
        const color = colorMap[progress] || 'bg-gray-100 text-gray-800';
        return (
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
                {progress || '未設定'}
            </span>
        );
    };

    const getActionIcon = (action: string) => {
        if (action.includes('電話')) return <Phone size={16} className="text-blue-500" />;
        if (action.includes('訪問')) return <User size={16} className="text-green-500" />;
        return <FileText size={16} className="text-gray-500" />;
    };

    if (loading) {
        return <div className="p-8 text-center text-sf-text-weak">読み込み中...</div>;
    }

    if (reports.length === 0) {
        return (
            <div className="space-y-6">
                <Link href="/customers" className="inline-flex items-center text-sf-light-blue hover:underline mb-4">
                    <ArrowLeft size={16} className="mr-1" />
                    得意先一覧に戻る
                </Link>
                <div className="bg-white p-8 rounded border border-sf-border text-center">
                    <p className="text-sf-text-weak">指定された得意先のデータが見つかりません。</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* ヘッダーエリア */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-6">
                <div className="flex items-center gap-2 text-sf-text-weak text-sm mb-2">
                    <Link href="/customers" className="hover:text-sf-light-blue hover:underline">
                        得意先一覧
                    </Link>
                    <span>/</span>
                    <span>{customerName}</span>
                </div>

                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-sf-text flex items-center gap-3">
                            {customerName}
                            <span className="text-base font-normal text-sf-text-weak bg-gray-100 px-2 py-1 rounded">
                                CD: {customerCode}
                            </span>
                            {reports.length > 0 && reports[0].重点顧客 && reports[0].重点顧客 !== '-' && reports[0].重点顧客 !== '' && (
                                <span className="inline-flex items-center px-2.5 py-1 rounded text-sm font-medium bg-yellow-100 text-yellow-800">
                                    ★ 重点顧客
                                </span>
                            )}
                        </h1>
                        {reports.length > 0 && (
                            <div className="flex items-center gap-4 mt-2 text-sm text-sf-text-weak">
                                {reports[0].ランク && (
                                    <div className="flex items-center gap-1">
                                        <TrendingUp size={14} />
                                        <span>ランク: {reports[0].ランク}</span>
                                    </div>
                                )}
                                {reports[0].エリア && (
                                    <div className="flex items-center gap-1">
                                        <MapPin size={14} />
                                        <span>エリア: {reports[0].エリア}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* 統計情報グリッド */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="text-center px-4 py-3 bg-gray-50 rounded border border-sf-border">
                        <p className="text-xs text-sf-text-weak mb-1">総活動数</p>
                        <p className="text-2xl font-semibold text-sf-text">{reports.length}</p>
                    </div>
                    <div className="text-center px-4 py-3 bg-green-50 rounded border border-green-200">
                        <p className="text-xs text-green-700 mb-1">訪問</p>
                        <p className="text-2xl font-semibold text-green-600">
                            {reports.filter(r => r.行動内容 && r.行動内容.includes('訪問')).length}
                        </p>
                    </div>
                    <div className="text-center px-4 py-3 bg-blue-50 rounded border border-blue-200">
                        <p className="text-xs text-blue-700 mb-1">電話</p>
                        <p className="text-2xl font-semibold text-blue-600">
                            {reports.filter(r => r.行動内容 && r.行動内容.includes('電話')).length}
                        </p>
                    </div>
                    <div className="text-center px-4 py-3 bg-purple-50 rounded border border-purple-200">
                        <p className="text-xs text-purple-700 mb-1">デザイン案件</p>
                        <p className="text-2xl font-semibold text-purple-600">{designRequests.length}</p>
                    </div>
                    <div className="text-center px-4 py-3 bg-orange-50 rounded border border-orange-200">
                        <p className="text-xs text-orange-700 mb-1">提案物</p>
                        <p className="text-2xl font-semibold text-orange-600">
                            {reports.filter(r => r.提案物 && r.提案物.trim() !== '').length}
                        </p>
                    </div>
                    <div className="text-center px-4 py-3 bg-gray-50 rounded border border-sf-border">
                        <p className="text-xs text-sf-text-weak mb-1">最終活動</p>
                        <p className="text-sm font-semibold text-sf-text">
                            {reports.length > 0 ? reports[0].日付 : '-'}
                        </p>
                    </div>
                </div>
            </div>

            {/* タブナビゲーション */}
            <div className="border-b border-sf-border">
                <nav className="-mb-px flex space-x-8">
                    <button
                        onClick={() => setActiveTab('timeline')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'timeline'
                                ? 'border-sf-light-blue text-sf-light-blue'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
                    >
                        <Clock size={18} />
                        活動履歴（タイムライン）
                    </button>
                    <button
                        onClick={() => setActiveTab('designs')}
                        className={`
              whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2
              ${activeTab === 'designs'
                                ? 'border-sf-light-blue text-sf-light-blue'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
            `}
                    >
                        <Package size={18} />
                        デザイン案件
                        <span className="bg-gray-100 text-gray-600 py-0.5 px-2 rounded-full text-xs ml-1">
                            {designRequests.length}
                        </span>
                    </button>
                </nav>
            </div>

            {/* コンテンツエリア */}
            <div className="min-h-[400px]">
                {activeTab === 'timeline' && (
                    <div className="space-y-4">
                        {reports.map((report, idx) => (
                            <div key={idx} className="bg-white p-4 rounded border border-sf-border shadow-sm hover:shadow-md transition-shadow relative pl-12">
                                <div className="absolute left-4 top-4 flex flex-col items-center h-full">
                                    <div className="bg-gray-100 p-1.5 rounded-full border border-sf-border z-10">
                                        {getActionIcon(report.行動内容)}
                                    </div>
                                    {idx !== reports.length - 1 && (
                                        <div className="w-px bg-gray-200 h-full absolute top-8"></div>
                                    )}
                                </div>

                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <span className="font-semibold text-sf-text mr-2">{report.日付}</span>
                                        <span className="text-sm text-sf-text-weak bg-gray-100 px-2 py-0.5 rounded">
                                            {report.行動内容}
                                        </span>
                                    </div>
                                    {report.面談者 && (
                                        <div className="flex items-center text-sm text-sf-text-weak">
                                            <User size={14} className="mr-1" />
                                            {report.面談者}
                                        </div>
                                    )}
                                </div>

                                <div className="text-sf-text text-sm leading-relaxed whitespace-pre-wrap">
                                    {report.商談内容 || <span className="text-gray-400 italic">商談内容の記録なし</span>}
                                </div>

                                {(report.提案物 || report.次回プラン) && (
                                    <div className="mt-3 pt-3 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {report.提案物 && (
                                            <div className="text-xs">
                                                <span className="font-medium text-sf-text-weak block mb-1">提案物</span>
                                                <span className="text-sf-text">{report.提案物}</span>
                                            </div>
                                        )}
                                        {report.次回プラン && (
                                            <div className="text-xs">
                                                <span className="font-medium text-sf-text-weak block mb-1">次回プラン</span>
                                                <span className="text-sf-text">{report.次回プラン}</span>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {report['システム確認用デザインNo.'] && (
                                    <div className="mt-3">
                                        <span className="inline-flex items-center gap-1 text-xs font-medium text-sf-light-blue bg-blue-50 px-2 py-1 rounded border border-blue-100">
                                            <Package size={12} />
                                            デザインNo. {report['システム確認用デザインNo.']}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}

                {activeTab === 'designs' && (
                    <div className="grid grid-cols-1 gap-6">
                        {designRequests.length === 0 ? (
                            <div className="text-center py-12 text-sf-text-weak bg-white rounded border border-sf-border">
                                デザイン案件はありません
                            </div>
                        ) : (
                            designRequests.map((req) => (
                                <div key={req.designNo} className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
                                    <div className="p-4 border-b border-sf-border bg-gray-50 flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <span className="font-bold text-lg text-sf-light-blue">#{req.designNo}</span>
                                            <h3 className="font-semibold text-sf-text">{req.designName || '名称未設定'}</h3>
                                        </div>
                                        {getProgressBadge(req.designProgress)}
                                    </div>

                                    <div className="p-4">
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            <div className="flex items-start gap-2">
                                                <Layers size={16} className="text-purple-600 mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-sf-text-weak">種別</p>
                                                    <p className="text-sm font-medium text-sf-text">{req.designType || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <TrendingUp size={16} className="text-green-600 mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-sf-text-weak">提案有無</p>
                                                    <p className="text-sm font-medium text-sf-text">{req.designProposal || '-'}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-start gap-2">
                                                <Calendar size={16} className="text-orange-500 mt-0.5" />
                                                <div>
                                                    <p className="text-xs text-sf-text-weak">最終更新</p>
                                                    <p className="text-sm font-medium text-sf-text">{req.lastUpdate}</p>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="space-y-3">
                                            <h4 className="text-xs font-semibold text-sf-text-weak uppercase tracking-wider border-b border-gray-100 pb-1">
                                                関連する活動履歴 ({req.requests.length}件)
                                            </h4>
                                            {req.requests.map((report, idx) => (
                                                <div key={idx} className="text-sm border-l-2 border-gray-200 pl-3 py-1 hover:border-sf-light-blue transition-colors">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="text-xs font-medium text-sf-text">{report.日付}</span>
                                                        <span className="text-xs text-sf-text-weak bg-gray-100 px-1.5 rounded">{report.行動内容}</span>
                                                    </div>
                                                    <p className="text-sf-text line-clamp-2">{report.商談内容}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
