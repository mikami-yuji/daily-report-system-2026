'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Building2, Palette, FileText, Calendar, ArrowRight, X, Sparkles } from 'lucide-react';
import { useCustomers, useReports } from '@/hooks/useQueryHooks';
import { useFile } from '@/context/FileContext';
import { normalizeSearchText } from '@/lib/reportUtils';

type GlobalSearchModalProps = {
    isOpen: boolean;
    onClose: () => void;
};

type SearchResultItem = {
    id: string;
    type: 'customer' | 'design' | 'page';
    title: string;
    subtitle?: string;
    url: string;
    badge?: string;
};

// 共通画面リンク
const NAV_PAGES = [
    { title: '営業日報一覧', subtitle: '日報の閲覧・検索・承認', url: '/reports', badge: '日報' },
    { title: '日報新規作成', subtitle: '日報の一括登録・新規追加', url: '/reports/batch', badge: '作成' },
    { title: 'デザイン検索', subtitle: 'デザイン依頼書・意匠画像・進捗一覧', url: '/design-search', badge: 'デザイン' },
    { title: '得意先一覧', subtitle: '顧客マスタ・活動履歴・ご無沙汰分析', url: '/customers', badge: '得意先' },
    { title: '活動カレンダー', subtitle: '月間訪問予定・実績スケジュール', url: '/calendar', badge: 'カレンダー' },
    { title: '競合他社情報', subtitle: '競合動向・社名別タイムライン', url: '/competitor-info', badge: '競合' },
    { title: 'クレーム対応履歴', subtitle: '不具合・トラブル・対応履歴一覧', url: '/complaints', badge: 'クレーム' },
    { title: '量販店調査検索', subtitle: 'スーパー各社・店頭売り場調査', url: '/mass-retailer-survey', badge: '量販店' },
    { title: '営業実績ダッシュボード', subtitle: '個人・チームの実績分析', url: '/', badge: 'ホーム' },
    { title: '設定', subtitle: 'ファイル設定・マスター管理', url: '/settings', badge: '設定' },
];

export default function GlobalSearchModal({ isOpen, onClose }: GlobalSearchModalProps) {
    const router = useRouter();
    const { selectedFile } = useFile();
    const { data: customerMaster = [] } = useCustomers(selectedFile || undefined);
    const { data: reports = [] } = useReports(selectedFile || undefined);

    const [keyword, setKeyword] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // モーダルが開いたときに入力欄にフォーカス
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => {
                setKeyword('');
                setSelectedIndex(0);
                inputRef.current?.focus();
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    // デザイン番号マップを作成（ユニーク化）
    const designItems = useMemo(() => {
        const map = new Map<string, { no: string; name: string; customer: string }>();
        reports.forEach(r => {
            const no = String(r['デザイン依頼No.'] || r['システム確認用デザインNo.'] || '').trim();
            if (no && no !== '-' && !map.has(no)) {
                map.set(no, {
                    no,
                    name: String(r['デザイン名'] || '').trim(),
                    customer: String(r['訪問先名'] || '').trim(),
                });
            }
        });
        return Array.from(map.values());
    }, [reports]);

    // 検索結果の算出
    const searchResults = useMemo((): SearchResultItem[] => {
        if (!keyword.trim()) {
            // 入力がない時は画面ナビゲーション上位を表示
            return NAV_PAGES.slice(0, 6).map(p => ({
                id: `page-${p.url}`,
                type: 'page',
                title: p.title,
                subtitle: p.subtitle,
                url: p.url,
                badge: p.badge
            }));
        }

        const terms = keyword.trim().split(/\s+/).filter(Boolean).map(normalizeSearchText);
        const results: SearchResultItem[] = [];

        // 1. 画面ページ検索
        NAV_PAGES.forEach(p => {
            const text = normalizeSearchText(`${p.title} ${p.subtitle || ''}`);
            if (terms.every(term => text.includes(term))) {
                results.push({
                    id: `page-${p.url}`,
                    type: 'page',
                    title: p.title,
                    subtitle: p.subtitle,
                    url: p.url,
                    badge: p.badge
                });
            }
        });

        // 2. 得意先検索（最大5件）
        let custCount = 0;
        for (const c of customerMaster) {
            if (custCount >= 6) break;
            const text = normalizeSearchText(`${c.得意先CD || ''} ${c.得意先名 || ''} ${c.得意先名カナ || ''}`);
            if (terms.every(term => text.includes(term))) {
                results.push({
                    id: `cust-${c.得意先CD}`,
                    type: 'customer',
                    title: c.得意先名,
                    subtitle: `CD: ${c.得意先CD} ${c.エリア ? `| ${c.エリア}` : ''}`,
                    url: `/customers/detail?code=${c.得意先CD}`,
                    badge: '得意先'
                });
                custCount++;
            }
        }

        // 3. デザイン検索（最大5件）
        let designCount = 0;
        for (const d of designItems) {
            if (designCount >= 6) break;
            const text = normalizeSearchText(`no.${d.no} ${d.no} ${d.name} ${d.customer}`);
            if (terms.every(term => text.includes(term))) {
                results.push({
                    id: `design-${d.no}`,
                    type: 'design',
                    title: `No.${d.no} ${d.name ? `| ${d.name}` : ''}`,
                    subtitle: d.customer ? `得意先: ${d.customer}` : undefined,
                    url: `/design-search`,
                    badge: 'デザイン'
                });
                designCount++;
            }
        }

        return results;
    }, [keyword, customerMaster, designItems]);

    // キーボード操作（上下キー選択 & Enter遷移 & Esc閉じる）
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % Math.max(1, searchResults.length));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + searchResults.length) % Math.max(1, searchResults.length));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            const selected = searchResults[selectedIndex];
            if (selected) {
                router.push(selected.url);
                onClose();
            }
        } else if (e.key === 'Escape') {
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 flex items-start justify-center pt-20 bg-black/40 backdrop-blur-xs animate-fadeIn"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl border border-sf-border w-full max-w-xl overflow-hidden animate-scaleUp"
                onClick={(e) => e.stopPropagation()}
            >
                {/* 検索入力ヘッダー */}
                <div className="relative flex items-center px-4 py-3 border-b border-sf-border">
                    <Search className="text-sf-light-blue shrink-0 mr-3" size={20} />
                    <input
                        ref={inputRef}
                        type="text"
                        value={keyword}
                        onChange={(e) => {
                            setKeyword(e.target.value);
                            setSelectedIndex(0);
                        }}
                        onKeyDown={handleKeyDown}
                        placeholder="画面名、得意先名・CD、デザインNo.で素早くジャンプ..."
                        className="w-full text-sm font-medium text-sf-text placeholder-gray-400 bg-transparent focus:outline-none"
                    />
                    <div className="flex items-center gap-1.5 ml-2">
                        <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono font-semibold text-gray-500 bg-gray-100 border border-gray-300 rounded shadow-2xs">
                            ESC
                        </kbd>
                        <button 
                            type="button" 
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* 検索結果リスト */}
                <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-gray-50">
                    {searchResults.length === 0 ? (
                        <div className="p-8 text-center text-sf-text-weak space-y-1">
                            <p className="text-sm font-medium text-gray-600">一致する候補が見つかりませんでした</p>
                            <p className="text-xs text-gray-400">キーワードを変えてお試しください</p>
                        </div>
                    ) : (
                        searchResults.map((item, idx) => {
                            const isSelected = idx === selectedIndex;
                            return (
                                <div
                                    key={item.id}
                                    onClick={() => {
                                        router.push(item.url);
                                        onClose();
                                    }}
                                    onMouseEnter={() => setSelectedIndex(idx)}
                                    className={`flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer transition-colors ${
                                        isSelected ? 'bg-blue-50/80 text-sf-text' : 'hover:bg-gray-50 text-gray-700'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`p-1.5 rounded-md shrink-0 ${
                                            item.type === 'customer' 
                                                ? 'bg-amber-100 text-amber-700' 
                                                : item.type === 'design' 
                                                ? 'bg-purple-100 text-purple-700' 
                                                : 'bg-blue-100 text-blue-700'
                                        }`}>
                                            {item.type === 'customer' ? (
                                                <Building2 size={16} />
                                            ) : item.type === 'design' ? (
                                                <Palette size={16} />
                                            ) : (
                                                <Sparkles size={16} />
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className={`text-xs font-semibold truncate ${isSelected ? 'text-blue-900' : 'text-gray-800'}`}>
                                                {item.title}
                                            </p>
                                            {item.subtitle && (
                                                <p className="text-[11px] text-gray-500 truncate">
                                                    {item.subtitle}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0 ml-2">
                                        {item.badge && (
                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200">
                                                {item.badge}
                                            </span>
                                        )}
                                        {isSelected && (
                                            <ArrowRight size={14} className="text-sf-light-blue" />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* フッターヒント */}
                <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 flex justify-between items-center text-[11px] text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <kbd className="px-1 py-0.2 bg-white border border-gray-300 rounded shadow-2xs font-mono">↑</kbd>
                        <kbd className="px-1 py-0.2 bg-white border border-gray-300 rounded shadow-2xs font-mono">↓</kbd>
                        <span>選択</span>
                        <kbd className="px-1 py-0.2 bg-white border border-gray-300 rounded shadow-2xs font-mono ml-2">Enter</kbd>
                        <span>移動</span>
                    </span>
                    <span>クイックコマンド</span>
                </div>
            </div>
        </div>
    );
}
