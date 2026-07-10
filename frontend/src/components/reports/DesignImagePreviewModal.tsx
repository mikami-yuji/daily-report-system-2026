import React, { useState, useEffect, useMemo } from 'react';
import { DesignImage, getImageUrl } from '@/lib/api';
import { X, ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, Search } from 'lucide-react';

type DesignImagePreviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    images: DesignImage[];
};

export default function DesignImagePreviewModal({ isOpen, onClose, images }: DesignImagePreviewModalProps): React.ReactElement | null {
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [prevImages, setPrevImages] = useState<DesignImage[]>(images);

    // 画像データが切り替わったら選択インデックスを0（最新）にリセット
    if (images !== prevImages) {
        setSelectedIndex(0);
        setPrevImages(images);
    }

    // 画像リストを更新日時の新しい順にソートする
    const sortedImages = useMemo((): DesignImage[] => {
        return [...images].sort((a, b): number => {
            const timeA = a.mtime || 0;
            const timeB = b.mtime || 0;
            return timeB - timeA;
        });
    }, [images]);

    // キーボードの矢印キーとEscキーの操作サポート
    useEffect((): (() => void) | undefined => {
        if (!isOpen || sortedImages.length === 0) return;

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && selectedIndex > 0) {
                setSelectedIndex(selectedIndex - 1);
            } else if (e.key === 'ArrowRight' && selectedIndex < sortedImages.length - 1) {
                setSelectedIndex(selectedIndex + 1);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return (): void => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, sortedImages, onClose]);

    if (!isOpen || sortedImages.length === 0) return null;

    const currentImage = sortedImages[selectedIndex];
    const isPdf = currentImage.name.toLowerCase().endsWith('.pdf');

    // タイムスタンプをYYYY/M/D HH:mm:ss形式に変換する
    const formatDateTime = (timestamp?: number): string => {
        if (!timestamp) return '日時不明';
        const date = new Date(timestamp * 1000);
        const y = date.getFullYear();
        const m = date.getMonth() + 1;
        const d = date.getDate();
        const hr = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        const sec = String(date.getSeconds()).padStart(2, '0');
        return `${y}/${m}/${d} ${hr}:${min}:${sec}`;
    };

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 print:hidden" 
            onClick={(): void => onClose()}
        >
            <div 
                className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] flex flex-col md:flex-row overflow-hidden" 
                onClick={(e): void => e.stopPropagation()}
            >
                {/* 左側：メインプレビュー画面 */}
                <div className="flex-1 bg-gray-50 flex flex-col min-w-0 border-r border-gray-100">
                    {/* プレビュー上部ヘッダー */}
                    <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 bg-white">
                        <div className="flex items-center gap-2 text-sf-text min-w-0">
                            {isPdf ? (
                                <FileText size={18} className="text-red-500 flex-shrink-0" />
                            ) : (
                                <ImageIcon size={18} className="text-pink-500 flex-shrink-0" />
                            )}
                            <h3 className="font-bold text-sm truncate" title={currentImage.name}>
                                {currentImage.name}
                            </h3>
                        </div>
                        {/* 閉じるボタン（小画面用） */}
                        <button
                            onClick={(): void => onClose()}
                            className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors cursor-pointer md:hidden"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* メインプレビュー領域 */}
                    <div className="flex-1 flex items-center justify-center p-6 relative bg-gray-100/50 min-h-[350px]">
                        {/* 左右スライドショーボタン */}
                        {sortedImages.length > 1 && selectedIndex > 0 && (
                            <button
                                onClick={(): void => setSelectedIndex(selectedIndex - 1)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2.5 text-gray-700 shadow-md hover:scale-105 transition-all cursor-pointer z-10"
                                title="前の画像"
                            >
                                <ChevronLeft size={20} />
                            </button>
                        )}

                        {isPdf ? (
                            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-lg border border-gray-200 shadow-sm max-w-sm text-center">
                                <FileText size={64} className="text-red-500 mb-4 animate-pulse" />
                                <h4 className="font-bold text-gray-800 text-sm mb-2">{currentImage.name}</h4>
                                <p className="text-xs text-gray-400 mb-6">PDFファイルはブラウザのプレビュー機能で開いて確認できます。</p>
                                <a
                                    href={getImageUrl(currentImage.path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded text-sm transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                    <FileText size={16} />
                                    PDFを別タブで開く
                                </a>
                            </div>
                        ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                src={getImageUrl(currentImage.path)}
                                alt={currentImage.name}
                                className="max-w-full max-h-[50vh] md:max-h-[62vh] object-contain shadow-md bg-white rounded p-1.5 transition-all duration-300"
                            />
                        )}

                        {sortedImages.length > 1 && selectedIndex < sortedImages.length - 1 && (
                            <button
                                onClick={(): void => setSelectedIndex(selectedIndex + 1)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/90 hover:bg-white rounded-full p-2.5 text-gray-700 shadow-md hover:scale-105 transition-all cursor-pointer z-10"
                                title="次の画像"
                            >
                                <ChevronRight size={20} />
                            </button>
                        )}
                    </div>

                    {/* ダウンロードボタン領域 */}
                    <div className="px-6 py-4 border-t border-gray-100 bg-white flex justify-center">
                        <a
                            href={getImageUrl(currentImage.path)}
                            download={currentImage.name}
                            onClick={(e): void => {
                                if (isPdf) {
                                    // PDFの場合は別タブで開く挙動をトリガー
                                    e.preventDefault();
                                    window.open(getImageUrl(currentImage.path), '_blank');
                                }
                            }}
                            className="px-6 py-2.5 bg-white hover:bg-gray-50 border border-gray-200 rounded text-sm text-gray-700 font-semibold shadow-sm flex items-center gap-2 transition-colors cursor-pointer"
                        >
                            <Download size={16} className="text-gray-500" />
                            {isPdf ? 'PDFを閲覧' : 'ダウンロード'}
                        </a>
                    </div>
                </div>

                {/* 右側：バリエーション・履歴リスト */}
                <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-100 flex flex-col bg-white shrink-0 min-w-0">
                    <div className="px-5 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                        <h4 className="font-bold text-sm text-gray-700 flex items-center gap-1.5">
                            <Search size={16} className="text-blue-500" />
                            バリエーション・履歴 ({sortedImages.length})
                        </h4>
                        {/* 閉じるボタン（デスクトップ用） */}
                        <button
                            onClick={(): void => onClose()}
                            className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1 transition-colors cursor-pointer hidden md:block"
                            title="閉じる"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[30vh] md:max-h-none">
                        {sortedImages.map((img, i): React.ReactElement => {
                            const itemIsPdf = img.name.toLowerCase().endsWith('.pdf');
                            const isSelected = i === selectedIndex;

                            return (
                                <div
                                    key={i}
                                    onClick={(): void => setSelectedIndex(i)}
                                    className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                        isSelected
                                            ? 'border-blue-500 bg-blue-50/40 text-blue-900 ring-1 ring-blue-500/25 shadow-sm'
                                            : 'border-gray-200 hover:bg-gray-50/80 text-gray-800'
                                    }`}
                                >
                                    {/* サムネイル */}
                                    <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                        {itemIsPdf ? (
                                            <div className="flex flex-col items-center justify-center text-red-500">
                                                <FileText size={20} />
                                                <span className="text-[8px] font-bold mt-0.5">PDF</span>
                                            </div>
                                        ) : (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={getImageUrl(img.path)}
                                                alt={img.name}
                                                className="w-full h-full object-contain p-0.5"
                                                loading="lazy"
                                            />
                                        )}
                                    </div>
                                    {/* 情報 */}
                                    <div className="min-w-0 flex-1">
                                        <div 
                                            className="text-xs font-semibold break-all line-clamp-2 leading-snug"
                                            title={img.name}
                                        >
                                            {img.name}
                                        </div>
                                        <div className="text-[10px] text-gray-400 mt-1.5 flex items-center gap-1">
                                            <span>{formatDateTime(img.mtime)}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
