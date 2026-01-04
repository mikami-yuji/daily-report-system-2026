'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useFile } from '@/context/FileContext';
import { Customer, Design, getCustomers, getInterviewers, getDesigns, addReport } from '@/lib/api';
import { queryKeys, useReports } from '@/hooks/useQueryHooks';
import { useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Save, Calendar, Building2, Clock, MessageSquare, ChevronDown, ChevronUp, Search, Loader2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

// バリデーションエラーの型
type ValidationErrors = {
    [visitId: string]: {
        得意先CD?: string;
        行動内容?: string;
        外出時間?: string;
    };
};

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
    // 外出時間用
    outingStartTime?: string;
    outingEndTime?: string;
    interviewers: string[]; // 得意先ごとの面談者リスト
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
    outingStartTime: '',
    outingEndTime: '',
    interviewers: [],
});

export default function BatchReportPage() {
    const { selectedFile } = useFile();
    const queryClient = useQueryClient();

    // 時間オプションの生成 (08:00 - 22:00, 30分刻み)
    const timeOptions = useMemo(() => {
        const options: string[] = [];
        for (let h = 8; h <= 22; h++) {
            for (let m = 0; m < 60; m += 30) {
                if (h === 22 && m > 0) break;
                const hour = h.toString().padStart(2, '0');
                const minute = m.toString().padStart(2, '0');
                options.push(`${hour}:${minute}`);
            }
        }
        return options;
    }, []);

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

    // バリデーションエラー状態
    const [validationErrors, setValidationErrors] = useState<ValidationErrors>({});
    const [showErrors, setShowErrors] = useState(false); // エラー表示フラグ

    // 検索用state
    const [searchTerms, setSearchTerms] = useState<{ [key: string]: string }>({});
    const [showSuggestions, setShowSuggestions] = useState<{ [key: string]: boolean }>({});

    // 得意先リスト取得
    useEffect(() => {
        if (selectedFile) {
            getCustomers(selectedFile).then(setCustomers).catch(console.error);
        }
    }, [selectedFile]);

    // 行動内容オプション（NewReportModalと同じ）
    const actionOptions = [
        '-',
        '訪問（アポあり）',
        '訪問（アポなし）',
        '訪問（新規）',
        '訪問（クレーム）',
        '電話商談',
        '電話アポ取り',
        'メール商談',
        '量販店調査',
        '社内（半日）',
        '社内（１日）',
        '外出時間',
        'その他'
    ];

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
            (c.得意先CD && String(c.得意先CD).toLowerCase().includes(lowerTerm)) ||
            (c.得意先名 && String(c.得意先名).toLowerCase().includes(lowerTerm)) ||
            (c.フリガナ && String(c.フリガナ).toLowerCase().includes(lowerTerm)) ||
            (c.直送先名 && String(c.直送先名).toLowerCase().includes(lowerTerm))
        ).slice(0, 10);
    };

    // 得意先選択
    const selectCustomer = (visitId: string, customer: Customer): void => {
        // 表示名を作成（直送先があれば「得意先名　直送先名」形式）
        const displayName = customer.直送先名
            ? `${customer.得意先名}　${customer.直送先名}`
            : customer.得意先名 || '';

        setVisits(prev => prev.map(v => {
            if (v.id === visitId) {
                return {
                    ...v,
                    得意先CD: customer.得意先CD || '',
                    訪問先名: displayName,
                    直送先CD: customer.直送先CD || '',
                    直送先名: customer.直送先名 || '',
                    エリア: customer.エリア || '',
                    ランク: customer.ランク || '',
                    重点顧客: customer.重点顧客 || '',
                    designs: [], // 初期化
                };
            }
            return v;
        }));
        setShowSuggestions({ ...showSuggestions, [visitId]: false });
        setSearchTerms({ ...searchTerms, [visitId]: '' });

        // デザイン案件を取得
        if (customer.得意先CD) {
            // デザイン案件を取得
            getDesigns(customer.得意先CD, selectedFile, customer.直送先名 || undefined)
                .then(designs => {
                    setVisits(prev => prev.map(v =>
                        v.id === visitId ? { ...v, designs } : v
                    ));
                })
                .catch(err => {
                    console.error('Failed to fetch designs:', err);
                });

            // 面談者リストを取得
            getInterviewers(customer.得意先CD, selectedFile, customer.得意先名, customer.直送先名)
                .then(interviewers => {
                    setVisits(prev => prev.map(v =>
                        v.id === visitId ? { ...v, interviewers } : v
                    ));
                })
                .catch(err => {
                    console.error('Failed to fetch interviewers:', err);
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

    // バリデーション関数
    const validateVisits = useCallback((): { isValid: boolean; errors: ValidationErrors } => {
        const errors: ValidationErrors = {};
        let hasError = false;

        visits.forEach(visit => {
            const visitErrors: ValidationErrors[string] = {};

            // 得意先CDチェック（行動内容が社内・量販店調査以外の場合は必須）
            const isInternalAction = ['社内（半日）', '社内（１日）', '量販店調査'].includes(visit.行動内容);
            if (!isInternalAction && !visit.得意先CD) {
                visitErrors.得意先CD = '得意先を選択してください';
                hasError = true;
            }

            // 行動内容チェック（必須）
            if (!visit.行動内容 || visit.行動内容 === '-') {
                visitErrors.行動内容 = '行動内容を選択してください';
                hasError = true;
            }

            // 外出時間の場合、開始・終了時刻チェック
            if (visit.行動内容 === '外出時間') {
                if (!visit.outingStartTime || !visit.outingEndTime) {
                    visitErrors.外出時間 = '外出時間の開始・終了時刻を入力してください';
                    hasError = true;
                }
            }

            if (Object.keys(visitErrors).length > 0) {
                errors[visit.id] = visitErrors;
            }
        });

        return { isValid: !hasError, errors };
    }, [visits]);

    // 一括保存
    const handleSubmit = async (): Promise<void> => {
        // バリデーション実行
        const { isValid, errors } = validateVisits();
        setValidationErrors(errors);
        setShowErrors(true);

        if (!isValid) {
            // エラーがある訪問の数をカウント
            const errorCount = Object.keys(errors).length;
            toast.error(
                <div className="flex items-center gap-2">
                    <AlertCircle size={18} />
                    <span>{errorCount}件の入力エラーがあります。赤枠の項目を確認してください</span>
                </div>,
                { duration: 4000 }
            );
            return;
        }

        // 有効なデータのみ抽出（社内・量販店調査は得意先不要）
        const validVisits = visits.filter(v => {
            const isInternalAction = ['社内（半日）', '社内（１日）', '量販店調査'].includes(v.行動内容);
            return (isInternalAction || v.得意先CD) && v.行動内容 && v.行動内容 !== '-';
        });

        if (validVisits.length === 0) {
            toast.error('保存するデータがありません');
            return;
        }

        setSubmitting(true);
        let successCount = 0;
        let errorCount = 0;

        for (const visit of validVisits) {
            // 商談内容の構築（外出時間の場合）
            let finalCommercialContent = visit.商談内容 || '';
            let finalRank = visit.ランク;

            if (visit.行動内容 === '外出時間') {
                let timeString = '';
                if (visit.outingStartTime && visit.outingEndTime) {
                    timeString += `【外出時間】${visit.outingStartTime}〜${visit.outingEndTime}\n`;
                }
                if (visit.ランク) {
                    timeString += `【満足度】${visit.ランク}\n`;
                }
                finalCommercialContent = timeString + finalCommercialContent;
                // ランクは保存しない（ユーザー要望により、商談内容に含めるのみとする場合）
                finalRank = '';
            }

            const reportData = {
                日付: date,
                得意先CD: visit.得意先CD,
                訪問先名: visit.訪問先名,
                直送先CD: visit.直送先CD,
                直送先名: visit.直送先名,
                行動内容: visit.行動内容,
                面談者: visit.面談者,
                滞在時間: visit.滞在時間,
                商談内容: finalCommercialContent,
                提案物: visit.提案物,
                次回プラン: visit.次回プラン,
                競合他社情報: visit.競合他社情報,
                エリア: visit.エリア,
                ランク: finalRank,
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
                                                    onClick={() => {
                                                        updateVisit(visit.id, '得意先CD', '');
                                                        // エラーをクリア
                                                        if (validationErrors[visit.id]?.得意先CD) {
                                                            setValidationErrors(prev => {
                                                                const newErrors = { ...prev };
                                                                if (newErrors[visit.id]) {
                                                                    delete newErrors[visit.id].得意先CD;
                                                                    if (Object.keys(newErrors[visit.id]).length === 0) {
                                                                        delete newErrors[visit.id];
                                                                    }
                                                                }
                                                                return newErrors;
                                                            });
                                                        }
                                                    }}
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
                                                        className={`w-full pl-9 pr-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent ${showErrors && validationErrors[visit.id]?.得意先CD
                                                            ? 'border-red-500 bg-red-50'
                                                            : 'border-sf-border'
                                                            }`}
                                                    />
                                                </div>
                                                {showErrors && validationErrors[visit.id]?.得意先CD && (
                                                    <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                                                        <AlertCircle size={12} />
                                                        <span>{validationErrors[visit.id].得意先CD}</span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                        {showSuggestions[visit.id] && searchTerms[visit.id] && (
                                            <div className="absolute z-10 w-full mt-1 bg-white border border-sf-border rounded shadow-lg max-h-48 overflow-y-auto">
                                                {filterCustomers(searchTerms[visit.id]).map(c => (
                                                    <div
                                                        key={`${c.得意先CD}-${c.直送先CD || 'main'}`}
                                                        className="px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm"
                                                        onClick={() => selectCustomer(visit.id, c)}
                                                    >
                                                        <span className="font-mono text-xs text-gray-500 mr-2">{c.得意先CD}</span>
                                                        {c.直送先名 ? `${c.得意先名}　${c.直送先名}` : c.得意先名}
                                                    </div>
                                                ))}
                                                {filterCustomers(searchTerms[visit.id]).length === 0 && (
                                                    <div className="px-3 py-2 text-sm text-gray-400">
                                                        該当する得意先がありません
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">
                                            行動内容 <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={visit.行動内容}
                                            onChange={(e) => {
                                                updateVisit(visit.id, '行動内容', e.target.value);
                                                // エラーをクリア
                                                if (validationErrors[visit.id]?.行動内容) {
                                                    setValidationErrors(prev => {
                                                        const newErrors = { ...prev };
                                                        if (newErrors[visit.id]) {
                                                            delete newErrors[visit.id].行動内容;
                                                            if (Object.keys(newErrors[visit.id]).length === 0) {
                                                                delete newErrors[visit.id];
                                                            }
                                                        }
                                                        return newErrors;
                                                    });
                                                }
                                            }}
                                            className={`w-full px-3 py-2 border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent ${showErrors && validationErrors[visit.id]?.行動内容
                                                    ? 'border-red-500 bg-red-50'
                                                    : 'border-sf-border'
                                                }`}
                                        >
                                            <option value="">選択してください</option>
                                            {actionOptions
                                                .filter(action => {
                                                    // 得意先や訪問先が入力されている場合は、社内業務や外出時間を除外
                                                    if (visit.得意先CD || visit.訪問先名) {
                                                        return !['社内（半日）', '社内（１日）', '外出時間'].includes(action);
                                                    }
                                                    return true;
                                                })
                                                .map(action => (
                                                    <option key={action} value={action}>{action}</option>
                                                ))
                                            }
                                        </select>
                                        {showErrors && validationErrors[visit.id]?.行動内容 && (
                                            <div className="flex items-center gap-1 mt-1 text-red-500 text-xs">
                                                <AlertCircle size={12} />
                                                <span>{validationErrors[visit.id].行動内容}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* 面談者・滞在時間（社内・量販店調査・外出時間以外のみ表示） */}
                                {!["社内（１日）", "社内（半日）", "量販店調査", "外出時間"].includes(visit.行動内容) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-sf-text-weak mb-1">面談者</label>
                                            <input
                                                type="text"
                                                value={visit.面談者}
                                                onChange={(e) => updateVisit(visit.id, '面談者', e.target.value)}
                                                list={`interviewers-${visit.id}`}
                                                placeholder="氏名を入力または選択"
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                            />
                                            <datalist id={`interviewers-${visit.id}`}>
                                                {visit.interviewers.map((name, index) => (
                                                    <option key={index} value={name} />
                                                ))}
                                            </datalist>
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
                                )}

                                {/* 外出時間用フィールド */}
                                {visit.行動内容 === '外出時間' && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-medium text-sf-text-weak mb-1">外出活動時間</label>
                                            <div className="flex items-center gap-2">
                                                <select
                                                    value={visit.outingStartTime || ''}
                                                    onChange={(e) => updateVisit(visit.id, 'outingStartTime' as keyof VisitEntry, e.target.value)}
                                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                                >
                                                    <option value="">開始時間</option>
                                                    {timeOptions.map(time => (
                                                        <option key={`start-${time}`} value={time}>{time}</option>
                                                    ))}
                                                </select>
                                                <span className="text-gray-400">～</span>
                                                <select
                                                    value={visit.outingEndTime || ''}
                                                    onChange={(e) => updateVisit(visit.id, 'outingEndTime' as keyof VisitEntry, e.target.value)}
                                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                                >
                                                    <option value="">終了時間</option>
                                                    {timeOptions
                                                        .filter(time => !visit.outingStartTime || time > visit.outingStartTime)
                                                        .map(time => (
                                                            <option key={`end-${time}`} value={time}>{time}</option>
                                                        ))
                                                    }
                                                </select>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-sf-text-weak mb-1">満足度（達成率）</label>
                                            <select
                                                value={visit.ランク}
                                                onChange={(e) => updateVisit(visit.id, 'ランク', e.target.value)}
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent"
                                            >
                                                <option value="">選択してください</option>
                                                <option value="0%">0%</option>
                                                <option value="25%">25%</option>
                                                <option value="50%">50%</option>
                                                <option value="75%">75%</option>
                                                <option value="100%">100%</option>
                                            </select>
                                        </div>
                                    </div>
                                )}

                                {/* デザイン提案セクション（社内・量販店調査・外出時間以外のみ表示） */}
                                {!["社内（１日）", "社内（半日）", "量販店調査", "外出時間"].includes(visit.行動内容) && (
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
                                                            readOnly={visit.designMode === 'existing'}
                                                            className={`w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent ${visit.designMode === 'existing' ? 'bg-gray-100' : ''}`}
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-sf-text-weak mb-1">デザイン種別</label>
                                                        {visit.designMode === 'existing' ? (
                                                            <input
                                                                type="text"
                                                                value={visit.デザイン種別}
                                                                readOnly
                                                                className="w-full px-3 py-2 border border-sf-border rounded bg-gray-100"
                                                            />
                                                        ) : (
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
                                                        )}
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-sf-text-weak mb-1">デザイン名</label>
                                                    <input
                                                        type="text"
                                                        value={visit.デザイン名}
                                                        onChange={(e) => updateVisit(visit.id, 'デザイン名', e.target.value)}
                                                        placeholder="デザイン名を入力"
                                                        readOnly={visit.designMode === 'existing'}
                                                        className={`w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent ${visit.designMode === 'existing' ? 'bg-gray-100' : ''}`}
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

                                        {/* 商談内容 */}
                                        <div>
                                            <label className="block text-xs font-medium text-sf-text-weak mb-1">商談内容</label>
                                            <textarea
                                                value={visit.商談内容}
                                                onChange={(e) => updateVisit(visit.id, '商談内容', e.target.value)}
                                                rows={2}
                                                onFocus={(e) => e.currentTarget.rows = 6}
                                                onBlur={(e) => e.currentTarget.rows = 2}
                                                placeholder="商談の内容を入力..."
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent resize-none transition-all"
                                            />
                                        </div>

                                        {/* 提案物・次回プラン */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-medium text-sf-text-weak mb-1">提案物</label>
                                                <textarea
                                                    value={visit.提案物}
                                                    onChange={(e) => updateVisit(visit.id, '提案物', e.target.value)}
                                                    rows={1}
                                                    onFocus={(e) => e.currentTarget.rows = 4}
                                                    onBlur={(e) => e.currentTarget.rows = 1}
                                                    placeholder="カタログ、サンプルなど"
                                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent resize-none transition-all"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-sf-text-weak mb-1">次回プラン</label>
                                                <textarea
                                                    value={visit.次回プラン}
                                                    onChange={(e) => updateVisit(visit.id, '次回プラン', e.target.value)}
                                                    rows={1}
                                                    onFocus={(e) => e.currentTarget.rows = 4}
                                                    onBlur={(e) => e.currentTarget.rows = 1}
                                                    placeholder="次回訪問予定など"
                                                    className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent resize-none transition-all"
                                                />
                                            </div>
                                        </div>

                                        {/* 競合他社情報 */}
                                        <div>
                                            <label className="block text-xs font-medium text-sf-text-weak mb-1">競合他社情報</label>
                                            <textarea
                                                value={visit.競合他社情報}
                                                onChange={(e) => updateVisit(visit.id, '競合他社情報', e.target.value)}
                                                rows={1}
                                                onFocus={(e) => e.currentTarget.rows = 4}
                                                onBlur={(e) => e.currentTarget.rows = 1}
                                                placeholder="競合他社の動向など"
                                                className="w-full px-3 py-2 border border-sf-border rounded focus:outline-none focus:ring-2 focus:ring-sf-light-blue focus:border-transparent resize-none transition-all"
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* 訪問追加ボタン */}
            < button
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
        </div >
    );
}
