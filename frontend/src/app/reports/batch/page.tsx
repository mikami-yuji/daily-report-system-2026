'use client';

import { useState, useEffect, useMemo } from 'react';
import { useFile } from '@/context/FileContext';
import { Customer, Design, getCustomers, getInterviewers, getDesigns, addReport } from '@/lib/api';
import { queryKeys, useReports } from '@/hooks/useQueryHooks';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Calendar, Building2, Clock, MessageSquare, ChevronDown, ChevronUp, Search } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// 訪問ブロックのデータ型
type VisitEntry = {
    id: string;
    得意先CD: string;
    訪問先名: string;
    直送先CD: string;
    直送先名: string;
    行動内容: string;
    面談者: string;
    滞在時間: string;
    商談内容: string;
    提案物: string;
    次回プラン: string;
    競合他社情報: string;
    エリア: string;
    ランク: string;
    重点顧客: string;
    デザイン提案有無: string;
    デザイン種別: string;
    デザイン名: string;
    デザイン進捗状況: string;
    'デザイン依頼No.': string;
    designMode: 'none' | 'new' | 'existing';  // デザインモード
    designs: Design[];  // 得意先ごとのデザイン案件リスト
    isExpanded: boolean;
};

// 空の訪問ブロックを作成
const createEmptyVisit = (): VisitEntry => ({
    id: crypto.randomUUID(),
    得意先CD: '',
    訪問先名: '',
    直送先CD: '',
    直送先名: '',
    行動内容: '',
    面談者: '',
    滞在時間: '',
    商談内容: '',
    提案物: '',
    次回プラン: '',
    競合他社情報: '',
    エリア: '',
    ランク: '',
    重点顧客: '',
    デザイン提案有無: '',
    デザイン種別: '',
    デザイン名: '',
    デザイン進捗状況: '',
    'デザイン依頼No.': '',
    designMode: 'none',
    designs: [],
    isExpanded: true,
});

export default function BatchReportPage() {
    const { selectedFile } = useFile();
    const queryClient = useQueryClient();

    // 日付の初期値 (今日の日付をYY/MM/DD形式)
    const today = new Date().toISOString().split('T')[0].replace(/-/g, '/').slice(2);
    const [date, setDate] = useState(today);

    // 訪問リスト（クライアント側でのみ初期化）
    const [visits, setVisits] = useState<VisitEntry[]>([]);
    const [isLoaded, setIsLoaded] = useState(false);

    // クライアント側でのみ初期訪問ブロックを作成(hydration mismatch回避）
    useEffect(() => {
        if (!isLoaded) {
            setVisits([createEmptyVisit()]);
            setIsLoaded(true);
        }
    }, [isLoaded]);

    // 得意先・面談者リスト
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [interviewers, setInterviewers] = useState<string[]>([]);

    // 送信中フラグ
    const [submitting, setSubmitting] = useState(false);

    // 検索用state
    const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({});
    const [showSuggestions, setShowSuggestions] = useState<{ [key: string]: boolean }>({});

    // 得意先リスト取得
    useEffect(() => {
        if (selectedFile) {
            getCustomers(selectedFile).then(setCustomers).catch(console.error);
        }
    }, [selectedFile]);

    // 行動内容オプション
    const actionOptions = ['訪問', '電話', '外出時間', 'クレーム対応'];

    // 訪問追加
    const addVisit = (): void => {
        setVisits([...visits, createEmptyVisit()]);
    };

    // 訪問削除
    const removeVisit = (id: string): void => {
        if (visits.length <= 1) {
            toast.error('最低1件の訪問が必要です');
            return;
        }
        setVisits(visits.filter(v => v.id !== id));
    };

    // 訪問データ更新
    const updateVisit = (id: string, field: keyof VisitEntry, value: string | boolean): void => {
        setVisits(prev => prev.map(v =>
            v.id === id ? { ...v, [field]: value } : v
        ));
    };

    // デザインモード変更（複数フィールドを一括更新）
    const handleDesignModeChange = (id: string, mode: 'none' | 'new' | 'existing'): void => {
        setVisits(prev => prev.map(v => {
            if (v.id !== id) return v;

            if (mode === 'none') {
                return {
                    ...v,
                    designMode: 'none',
                    デザイン提案有無: '',
                    デザイン種別: '',
                    デザイン名: '',
                    デザイン進捗状況: '',
                    'デザイン依頼No.': '',
                };
            } else if (mode === 'new') {
                return {
                    ...v,
                    designMode: 'new',
                    デザイン提案有無: 'あり',
                    デザイン進捗状況: '新規',
                };
            } else {
                return {
                    ...v,
                    designMode: 'existing',
                    デザイン提案有無: 'あり',
                };
            }
        }));
    };

    // 得意先検索
    const filterCustomers = (term: string): Customer[] => {
        if (!term.trim()) return [];
        const lowerTerm = term.toLowerCase();
        return customers.filter(c =>
            (c.code && c.code.toLowerCase().includes(lowerTerm)) ||
            (c.name && c.name.toLowerCase().includes(lowerTerm)) ||
            (c.kana && c.kana.toLowerCase().includes(lowerTerm))
        ).slice(0, 10);
    };

    // 得意先選択
    const selectCustomer = (visitId: string, customer: Customer): void => {
        setVisits(prev => prev.map(v => {
            if (v.id === visitId) {
                return {
                    ...v,
                    得意先CD: customer.code,
                    訪問先名: customer.name,
                    直送先CD: customer.ddCode || '',
                    直送先名: customer.ddName || '',
                    エリア: customer.area || '',
                    ランク: customer.rank || '',
                    重点顧客: customer.priority || '',
                    designs: [], // 初期化
                };
            }
            return v;
        }));
        setShowSuggestions({ ...showSuggestions, [visitId]: false });
        setSearchTerms({ ...searchTerms, [visitId]: '' });

        // デザイン案件を取得
        if (customer.code) {
            getDesigns(customer.code, selectedFile, customer.ddName || undefined)
                .then(designs => {
                    setVisits(prev => prev.map(v =>
                        v.id === visitId ? { ...v, designs } : v
                    ));
                })
                .catch(err => {
                    console.error('Failed to fetch designs:', err);
                });
        }
    };

    // デザイン選択（既存デザインを選んだ時）
    const handleDesignSelect = (visitId: string, designNo: string): void => {
        setVisits(prev => prev.map(v => {
            if (v.id !== visitId) return v;

            const design = v.designs.find(d => String(d.デザイン依頼No) === designNo);
            if (!design) return v;

            return {
                ...v,
                'デザイン依頼No.': String(design.デザイン依頼No),
                デザイン種別: design.デザイン種別 || '',
                デザイン名: design.デザイン名 || '',
                デザイン進捗状況: design.デザイン進捗状況 || '',
            };
        }));
    };

    // 展開/折りたたみ切り替え
    const toggleExpand = (id: string): void => {
        setVisits(visits.map(v =>
            v.id === id ? { ...v, isExpanded: !v.isExpanded } : v
        ));
    };

    // 一括保存
    const handleSubmit = async (): Promise<void> => {
        // バリデーション
        const validVisits = visits.filter(v => v.得意先CD && v.行動内容);

        if (validVisits.length === 0) {
            toast.error('得意先CDと行動内容を入力してください');
            return;
        }

        setSubmitting(true);
        let successCount = 0;
        let errorCount = 0;

        for (const visit of validVisits) {
            const reportData = {
                日付: date,
                得意先CD: visit.得意先CD,
                訪問先名: visit.訪問先名,
                直送先CD: visit.直送先CD,
                直送先名: visit.直送先名,
                行動内容: visit.行動内容,
                面談者: visit.面談者,
                滞在時間: visit.滞在時間,
                商談内容: visit.商談内容,
                提案物: visit.提案物,
                次回プラン: visit.次回プラン,
                競合他社情報: visit.競合他社情報,
                エリア: visit.エリア,
                ランク: visit.ランク,
                重点顧客: visit.重点顧客,
                デザイン提案有無: visit.デザイン提案有無,
                デザイン種別: visit.デザイン種別,
                デザイン名: visit.デザイン名,
                デザイン進捗状況: visit.デザイン進捗状況,
                'デザイン依頼No.': visit['デザイン依頼No.'],
            };

            try {
                await addReport(reportData as any, selectedFile);
                successCount++;
            } catch (error) {
                console.error('Failed to create report:', error);
                errorCount++;
            }
        }

        setSubmitting(false);

        if (successCount > 0) {
            toast.success(`${successCount}件の日報を保存しました`);
            queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
            // 入力をリセット
            setVisits([createEmptyVisit()]);
        }

        if (errorCount > 0) {
            toast.error(`${errorCount}件の保存に失敗しました`);
        }
    };

    // 有効な訪問数
    const validCount = visits.filter(v => v.得意先CD && v.行動内容).length;

    return (
        <div className="space-y-6">
            {/* ヘッダー */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-semibold text-sf-text">日報一括入力</h1>
                    <p className="text-sm text-sf-text-weak mt-1">複数の訪問先を一度に入力できます</p>
                </div>
                <Link
                    href="/reports"
                    className="text-sm text-sf-light-blue hover:underline"
                >
                    ← 日報一覧に戻る
                </Link>
            </div>

            {/* 日付設定 */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4">
                <div className="flex items-center gap-4">
                    <Calendar size={20} className="text-gray-400" />
                    <label className="text-sm font-medium text-sf-text">日付</label>
                    <input
                        type="text"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        placeholder="YY/MM/DD"
                        className="px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent w-40"
                    />
                    <span className="text-xs text-sf-text-weak">※全ての訪問に適用されます</span>
                </div>
            </div>

            {/* 訪問ブロック一覧 */}
            <div className="space-y-4">
                {visits.map((visit, index) => (
                    <div
                        key={visit.id}
                        className="bg-white rounded border border-sf-border shadow-sm overflow-hidden"
                    >
                        {/* 訪問ヘッダー */}
                        <div
                            className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-sf-border cursor-pointer"
                            onClick={() => toggleExpand(visit.id)}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-sf-text">
                                    訪問 #{index + 1}
                                </span>
                                {visit.訪問先名 && (
                                    <span className="text-sm text-sf-text-weak">
                                        - {visit.訪問先名}
                                    </span>
                                )}
                                {visit.行動内容 && (
                                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                                        {visit.行動内容}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                {visits.length > 1 && (
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            removeVisit(visit.id);
                                        }}
                                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )}
                                {visit.isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                            </div>
                        </div>

                        {/* 訪問詳細フォーム */}
                        {visit.isExpanded && (
                            <div className="p-4 space-y-4">
                                {/* 得意先検索 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="relative">
                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">
                                            得意先CD / 訪問先名 <span className="text-red-500">*</span>
                                        </label>
                                        {visit.得意先CD ? (
                                            <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-sf-border rounded">
                                                <Building2 size={16} className="text-gray-400" />
                                                <span className="font-mono text-sm">{visit.得意先CD}</span>
                                                <span className="text-sm text-sf-text">{visit.訪問先名}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => updateVisit(visit.id, '得意先CD', '')}
                                                    className="ml-auto text-gray-400 hover:text-red-500"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                                    <input
                                                        type="text"
                                                        value={searchTerms[visit.id] || ''}
                                                        onChange={(e) => {
                                                            setSearchTerms({ ...searchTerms, [visit.id]: e.target.value });
                                                            setShowSuggestions({ ...showSuggestions, [visit.id]: true });
                                                        }}
                                                        onFocus={() => setShowSuggestions({ ...showSuggestions, [visit.id]: true })}
                                                        placeholder="得意先CD、名前、カナで検索..."
                                                        className="w-full pl-9 pr-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                                    />
                                                </div>
                                                {showSuggestions[visit.id] && searchTerms[visit.id] && (
                                                    <div className="absolute z-10 w-full mt-1 bg-white border border-sf-border rounded shadow-lg max-h-48 overflow-y-auto">
                                                        {filterCustomers(searchTerms[visit.id]).map(c => (
                                                            <div
                                                                key={c.code}
                                                                className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                                                                onClick={() => selectCustomer(visit.id, c)}
                                                            >
                                                                <span className="font-mono text-xs text-gray-500 mr-2">{c.code}</span>
                                                                {c.name}
                                                            </div>
                                                        ))}
                                                        {filterCustomers(searchTerms[visit.id]).length === 0 && (
                                                            <div className="px-3 py-2 text-sm text-gray-400">
                                                                該当する得意先がありません
                                                            </div>
                                                        )}
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">
                                            行動内容 <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={visit.行動内容}
                                            onChange={(e) => updateVisit(visit.id, '行動内容', e.target.value)}
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                        >
                                            <option value="">選択してください</option>
                                            {actionOptions.map(action => (
                                                <option key={action} value={action}>{action}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {/* 面談者・滞在時間 */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">面談者</label>
                                        <select
                                            value={visit.面談者}
                                            onChange={(e) => updateVisit(visit.id, '面談者', e.target.value)}
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                        >
                                            <option value="">選択してください</option>
                                            {interviewers.map(name => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">滞在時間</label>
                                        <select
                                            value={visit.滞在時間}
                                            onChange={(e) => updateVisit(visit.id, '滞在時間', e.target.value)}
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                        >
                                            <option value="">選択してください</option>
                                            <option value="-">-</option>
                                            <option value="10分未満">10分未満</option>
                                            <option value="30分未満">30分未満</option>
                                            <option value="60分未満">60分未満</option>
                                            <option value="60分以上">60分以上</option>
                                        </select>
                                    </div>
                                </div>

                                {/* デザイン提案セクション */}
                                <div className="border-t border-gray-200 pt-4 mt-4">
                                    <h4 className="text-sm font-medium text-sf-text mb-3">デザイン情報</h4>
                                    <div className="flex gap-4 mb-4">
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name={`designMode-${visit.id}`}
                                                checked={visit.designMode === 'none'}
                                                onChange={() => handleDesignModeChange(visit.id, 'none')}
                                                className="text-sf-light-blue focus:ring-sf-light-blue"
                                            />
                                            <span>なし</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name={`designMode-${visit.id}`}
                                                checked={visit.designMode === 'new'}
                                                onChange={() => handleDesignModeChange(visit.id, 'new')}
                                                className="text-sf-light-blue focus:ring-sf-light-blue"
                                            />
                                            <span>新規</span>
                                        </label>
                                        <label className="flex items-center gap-2">
                                            <input
                                                type="radio"
                                                name={`designMode-${visit.id}`}
                                                checked={visit.designMode === 'existing'}
                                                onChange={() => handleDesignModeChange(visit.id, 'existing')}
                                                className="text-sf-light-blue focus:ring-sf-light-blue"
                                            />
                                            <span>既存</span>
                                        </label>
                                    </div>

                                    {/* 既存デザイン選択プルダウン */}
                                    {visit.designMode === 'existing' && (
                                        <div className="mb-4">
                                            <label className="block text-xs font-medium text-sf-text-weak mb-1">過去のデザイン案件</label>
                                            <select
                                                value={visit['デザイン依頼No.']}
                                                onChange={(e) => handleDesignSelect(visit.id, e.target.value)}
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                            >
                                                <option value="">選択してください</option>
                                                {visit.designs.map((design) => (
                                                    <option key={String(design.デザイン依頼No)} value={String(design.デザイン依頼No)}>
                                                        {design.デザイン依頼No} - {design.デザイン名} ({design.デザイン進捗状況})
                                                    </option>
                                                ))}
                                            </select>
                                            {visit.designs.length === 0 && visit.得意先CD && (
                                                <p className="text-xs text-gray-500 mt-1">この得意先のデザイン案件はありません</p>
                                            )}
                                        </div>
                                    )}

                                    {(visit.designMode === 'new' || visit.designMode === 'existing') && (
                                        <div className="space-y-4">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-sf-text-weak mb-1">デザイン依頼No.</label>
                                                    <input
                                                        type="text"
                                                        value={visit['デザイン依頼No.']}
                                                        onChange={(e) => updateVisit(visit.id, 'デザイン依頼No.', e.target.value)}
                                                        placeholder="依頼番号"
                                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-sf-text-weak mb-1">デザイン種別</label>
                                                    <select
                                                        value={visit.デザイン種別}
                                                        onChange={(e) => updateVisit(visit.id, 'デザイン種別', e.target.value)}
                                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                                    >
                                                        <option value="">選択してください</option>
                                                        <option value="-">-</option>
                                                        <option value="別注（新版）">別注（新版）</option>
                                                        <option value="別注（改版）">別注（改版）</option>
                                                        <option value="別注（再版）">別注（再版）</option>
                                                        <option value="SP（新版）">SP（新版）</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-sf-text-weak mb-1">デザイン名</label>
                                                <input
                                                    type="text"
                                                    value={visit.デザイン名}
                                                    onChange={(e) => updateVisit(visit.id, 'デザイン名', e.target.value)}
                                                    placeholder="デザイン名を入力"
                                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                                />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-xs font-medium text-sf-text-weak mb-1">デザイン進捗状況</label>
                                                    <select
                                                        value={visit.デザイン進捗状況}
                                                        onChange={(e) => updateVisit(visit.id, 'デザイン進捗状況', e.target.value)}
                                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                                    >
                                                        <option value="">選択してください</option>
                                                        <option value="-">-</option>
                                                        <option value="新規">新規</option>
                                                        <option value="50％未満">50％未満</option>
                                                        <option value="80％未満">80％未満</option>
                                                        <option value="80％以上">80％以上</option>
                                                        <option value="出稿">出稿</option>
                                                        <option value="不採用（コンペ負け）">不採用（コンペ負け）</option>
                                                        <option value="不採用（企画倒れ）">不採用（企画倒れ）</option>
                                                        <option value="保留">保留</option>
                                                    </select>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* 商談内容 */}
                                <div>
                                    <label className="block text-xs font-medium text-sf-text-weak mb-1">商談内容</label>
                                    <textarea
                                        value={visit.商談内容}
                                        onChange={(e) => updateVisit(visit.id, '商談内容', e.target.value)}
                                        rows={3}
                                        placeholder="商談の内容を入力..."
                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent resize-none"
                                    />
                                </div>

                                {/* 提案物・次回プラン */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">提案物</label>
                                        <input
                                            type="text"
                                            value={visit.提案物}
                                            onChange={(e) => updateVisit(visit.id, '提案物', e.target.value)}
                                            placeholder="カタログ、サンプルなど"
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">次回プラン</label>
                                        <input
                                            type="text"
                                            value={visit.次回プラン}
                                            onChange={(e) => updateVisit(visit.id, '次回プラン', e.target.value)}
                                            placeholder="次回訪問予定など"
                                            className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                        />
                                    </div>
                                </div>

                                {/* 競合他社情報 */}
                                <div>
                                    <label className="block text-xs font-medium text-sf-text-weak mb-1">競合他社情報</label>
                                    <textarea
                                        value={visit.競合他社情報}
                                        onChange={(e) => updateVisit(visit.id, '競合他社情報', e.target.value)}
                                        rows={2}
                                        placeholder="競合他社の動向など"
                                        className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent resize-none"
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 訪問追加ボタン */}
            <button
                type="button"
                onClick={addVisit}
                className="w-full py-3 border-2 border-dashed border-gray-300 rounded-lg text-sf-text-weak hover:border-sf-light-blue hover:text-sf-light-blue transition-colors flex items-center justify-center gap-2"
            >
                <Plus size={20} />
                訪問を追加
            </button>

            {/* フッター */}
            <div className="bg-white rounded border border-sf-border shadow-sm p-4 flex items-center justify-between">
                <div className="text-sm text-sf-text-weak">
                    入力済み: <span className="font-semibold text-sf-text">{validCount}</span> 件
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/reports"
                        className="px-4 py-2 text-sf-text-weak hover:text-sf-text border border-sf-border rounded"
                    >
                        キャンセル
                    </Link>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={submitting || validCount === 0}
                        className="px-6 py-2 bg-sf-light-blue text-white rounded hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        <Save size={18} />
                        {submitting ? '保存中...' : `一括保存 (${validCount}件)`}
                    </button>
                </div>
            </div>
        </div>
    );
}
