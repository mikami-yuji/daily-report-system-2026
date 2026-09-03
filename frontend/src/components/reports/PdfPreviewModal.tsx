'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, FileText, Loader2, Layers, Calendar } from 'lucide-react';

export type PdfItem = {
    title: string;
    url: string;
    requestId?: string;
    requestDate?: string;
    designContent?: string;
    status?: string;
};

type PdfPreviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl?: string;
    title?: string;
    items?: PdfItem[];
    initialIndex?: number;
};

/**
 * 企画課ビューワーから取得したPDF仕様書を埋め込みiframeでプレビューするモーダル
 * 複数の依頼書PDF（枝番履歴）が存在する場合、上部タブで過去〜最新の仕様書をワンクリックで切り替え閲覧可能
 */
export default function PdfPreviewModal({ 
    isOpen, 
    onClose, 
    pdfUrl, 
    title = 'PDF仕様書プレビュー',
    items,
    initialIndex = 0
}: PdfPreviewModalProps): React.JSX.Element | null {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [prevInitialIndex, setPrevInitialIndex] = useState<number>(initialIndex);
    const [selectedIndex, setSelectedIndex] = useState<number>(initialIndex);

    // リストの正規化（itemsが渡された場合はそれを使用、なければpdfUrlから1件作成）
    const allPdfList = useMemo((): PdfItem[] => {
        if (items && items.length > 0) {
            return items;
        }
        if (pdfUrl) {
            return [{ title, url: pdfUrl }];
        }
        return [];
    }, [items, pdfUrl, title]);

    // initialIndexが変わった場合の追跡更新 (React公式パターン: Storing information from previous renders)
    if (prevInitialIndex !== initialIndex) {
        setPrevInitialIndex(initialIndex);
        setSelectedIndex(initialIndex < allPdfList.length ? initialIndex : 0);
    }

    useEffect((): (() => void) => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            requestAnimationFrame((): void => {
                setIsLoading(true);
                setHasError(false);
            });
        } else {
            document.body.style.overflow = '';
        }
        return (): void => {
            document.body.style.overflow = '';
        };
    }, [isOpen]);

    // 接続タイムアウト監視 (8秒以上読み込まれない場合はフォールバックへのリンクを表示)
    useEffect((): (() => void) => {
        let timer: NodeJS.Timeout;
        if (isOpen && isLoading) {
            timer = setTimeout((): void => {
                setHasError(true);
                setIsLoading(false);
            }, 8000);
        }
        return (): void => {
            if (timer) clearTimeout(timer);
        };
    }, [isOpen, isLoading, selectedIndex]);

    if (!isOpen || allPdfList.length === 0) return null;

    const currentItem = allPdfList[selectedIndex] || allPdfList[0];
    const currentPdfUrl = currentItem.url;
    const currentTitle = currentItem.title || title;

    // パス正規化（完全なURL化）
    const fullUrl = currentPdfUrl.startsWith('http') ? currentPdfUrl : `http://192.168.1.5:8888${currentPdfUrl}`;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden">
                {/* ヘッダー */}
                <div className="px-6 py-3.5 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-2.5 min-w-0 pr-4">
                        <div className="p-1.5 bg-red-100 rounded-lg text-red-600 flex-shrink-0">
                            <FileText size={18} />
                        </div>
                        <div className="min-w-0">
                            <h3 className="font-bold text-sm text-sf-text truncate" title={currentTitle}>
                                {currentTitle}
                            </h3>
                            {currentItem.designContent && (
                                <p className="text-[11px] text-gray-500 truncate" title={currentItem.designContent}>
                                    {currentItem.designContent}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                        <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-gray-100 text-gray-700 text-xs font-semibold rounded-lg transition-colors border border-gray-300 shadow-sm cursor-pointer"
                        >
                            <ExternalLink size={14} /> 別タブで開く
                        </a>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 bg-gray-200/60 hover:bg-gray-200 rounded-full p-2 transition-colors cursor-pointer focus:outline-none"
                            aria-label="閉じる"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* 複数PDFが存在する場合の履歴切り替えバー */}
                {allPdfList.length > 1 && (
                    <div className="flex items-center gap-2 px-6 py-2.5 bg-slate-100 border-b border-slate-200 overflow-x-auto text-xs flex-shrink-0">
                        <span className="font-black text-slate-600 whitespace-nowrap flex items-center gap-1 pr-1">
                            <Layers size={14} className="text-red-500" />
                            依頼書履歴 ({allPdfList.length}件):
                        </span>
                        <div className="flex items-center gap-2">
                            {allPdfList.map((item: PdfItem, idx: number) => {
                                const isSelected = idx === selectedIndex;
                                return (
                                    <button
                                        key={item.url || idx}
                                        onClick={(): void => {
                                            if (idx !== selectedIndex) {
                                                setSelectedIndex(idx);
                                                setIsLoading(true);
                                                setHasError(false);
                                            }
                                        }}
                                        className={`px-3 py-1.5 rounded-lg font-bold transition-all flex items-center gap-1.5 whitespace-nowrap cursor-pointer shadow-xs ${
                                            isSelected
                                                ? 'bg-red-500 text-white shadow-sm ring-2 ring-red-300'
                                                : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-300 hover:border-gray-400'
                                        }`}
                                    >
                                        <FileText size={12} className={isSelected ? 'text-white' : 'text-red-500'} />
                                        <span>{item.requestId || `第${idx + 1}版`}</span>
                                        {item.requestDate && (
                                            <span className={`text-[10px] flex items-center gap-0.5 ${isSelected ? 'text-red-100' : 'text-gray-400'}`}>
                                                <Calendar size={10} />
                                                {item.requestDate}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* メインプレビューエリア */}
                <div className="flex-1 bg-gray-100 relative min-h-[300px] flex items-center justify-center">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                            <Loader2 size={36} className="animate-spin text-sf-light-blue mb-2" />
                            <p className="text-xs text-sf-text-weak font-medium">
                                PDF仕様書を読み込み中... ({currentItem.requestId || '最新'})
                            </p>
                        </div>
                    )}

                    {!hasError && (
                        <iframe
                            key={fullUrl}
                            src={fullUrl}
                            title={currentTitle}
                            className="w-full h-full border-none"
                            onLoad={(): void => setIsLoading(false)}
                            onError={(): void => {
                                setIsLoading(false);
                                setHasError(true);
                            }}
                        />
                    )}

                    {hasError && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white p-8 z-20 text-center animate-fadeIn">
                            <FileText size={64} className="text-red-500 mb-3" />
                            <h4 className="font-bold text-sf-text mb-1">PDFプレビューをロードできませんでした</h4>
                            <p className="text-xs text-sf-text-weak mb-4 max-w-md mx-auto leading-relaxed">
                                社内ネットワーク（VPN）に接続されていないか、企画課ビューアサーバー（192.168.1.5:8888）が停止している可能性があります。
                            </p>
                            <a
                                href={fullUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white text-xs font-bold rounded-lg shadow-sm transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                <ExternalLink size={14} /> 直接PDFを表示する
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}

