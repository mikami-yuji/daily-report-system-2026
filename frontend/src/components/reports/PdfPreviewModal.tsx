'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, ExternalLink, FileText, Loader2 } from 'lucide-react';

type PdfPreviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    pdfUrl: string;
    title?: string;
};

/**
 * 企画課ビューワーから取得したPDF仕様書を埋め込みiframeでプレビューするモーダル
 * 遅延ロード（モーダル開口時のみマウント）および閉じられた際のマウント解除を実装
 */
export default function PdfPreviewModal({ isOpen, onClose, pdfUrl, title = 'PDF仕様書プレビュー' }: PdfPreviewModalProps): React.JSX.Element | null {
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);

    useEffect((): (() => void) => {
        if (isOpen) {
            document.body.style.overflow = 'hidden';
            setIsLoading(true);
            setHasError(false);
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
    }, [isOpen, isLoading]);

    if (!isOpen) return null;

    // パス正規化（完全なURL化）
    const fullUrl = pdfUrl.startsWith('http') ? pdfUrl : `http://192.168.1.5:8888${pdfUrl}`;

    return createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4 backdrop-blur-sm animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden">
                {/* ヘッダー */}
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
                    <div className="flex items-center gap-2">
                        <FileText size={20} className="text-red-500" />
                        <h3 className="font-bold text-sm text-sf-text truncate max-w-lg" title={title}>
                            {title}
                        </h3>
                    </div>
                    <div className="flex items-center gap-3">
                        <a
                            href={fullUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-lg transition-colors border border-gray-200/50 cursor-pointer"
                        >
                            <ExternalLink size={14} /> 別タブで開く
                        </a>
                        <button
                            onClick={onClose}
                            className="text-gray-400 hover:text-gray-600 bg-gray-200/50 hover:bg-gray-200 rounded-full p-2 transition-colors cursor-pointer focus:outline-none"
                            aria-label="閉じる"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* メインプレビューエリア */}
                <div className="flex-1 bg-gray-100 relative min-h-[300px] flex items-center justify-center">
                    {isLoading && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 z-10">
                            <Loader2 size={36} className="animate-spin text-sf-light-blue mb-2" />
                            <p className="text-xs text-sf-text-weak font-medium">PDF仕様書を読み込み中...</p>
                        </div>
                    )}

                    {!hasError && (
                        <iframe
                            src={fullUrl}
                            title={title}
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
