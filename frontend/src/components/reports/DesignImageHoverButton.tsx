import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, Loader2 } from 'lucide-react';
import { searchDesignImages, DesignImage, getImageUrl } from '@/lib/api';

// グローバルなメモリキャッシュ（同一デザインNoの重複検索を抑止）
const imageHoverCache = new Map<string, DesignImage[]>();

type DesignImageHoverButtonProps = {
    designNo: string | number;
    selectedFile?: string;
    onOpenModal?: (images: DesignImage[], targetDesignNo: string) => void;
    size?: 'sm' | 'md';
    className?: string;
};

export default function DesignImageHoverButton({
    designNo,
    selectedFile,
    onOpenModal,
    size = 'sm',
    className = '',
}: DesignImageHoverButtonProps) {
    const cleanNo = String(designNo || '').trim();
    const [isHovered, setIsHovered] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [images, setImages] = useState<DesignImage[] | null>(null);
    const [hasLoaded, setHasLoaded] = useState(false);
    const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; placeAbove: boolean; arrowLeft: number } | null>(null);

    const buttonRef = useRef<HTMLButtonElement | null>(null);
    const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);
    const leaveTimerRef = useRef<NodeJS.Timeout | null>(null);

    // ポップオーバーの位置計算（画面外やヘッダーによる見切れをスマートに防止）
    const updatePosition = useCallback(() => {
        if (!buttonRef.current) return;
        const rect = buttonRef.current.getBoundingClientRect();
        const popoverWidth = 224; // 幅224px
        const popoverHeight = 196; // 推定高さ

        // 画面上部（ヘッダー含む）に十分なスペースがあるか？
        const spaceAbove = rect.top;
        const placeAbove = spaceAbove > popoverHeight + 20;

        const top = placeAbove 
            ? rect.top - popoverHeight - 8 
            : rect.bottom + 8;

        // 水平方向（ボタンの中央に合わせつつ画面内に収める）
        const buttonCenterX = rect.left + rect.width / 2;
        let left = buttonCenterX - popoverWidth / 2;
        left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, left));

        // 矢印の位置（ボタン中央との相対位置）
        const arrowLeft = Math.max(16, Math.min(popoverWidth - 16, buttonCenterX - left));

        setPopoverPos({ top, left, placeAbove, arrowLeft });
    }, []);

    // ホバー時の取得処理
    const handleMouseEnter = () => {
        if (leaveTimerRef.current) {
            clearTimeout(leaveTimerRef.current);
            leaveTimerRef.current = null;
        }

        hoverTimerRef.current = setTimeout(async () => {
            updatePosition();
            setIsHovered(true);
            if (!cleanNo) return;

            // キャッシュ確認
            if (imageHoverCache.has(cleanNo)) {
                setImages(imageHoverCache.get(cleanNo) || []);
                setHasLoaded(true);
                return;
            }

            if (!hasLoaded) {
                setIsLoading(true);
                try {
                    const res = await searchDesignImages(cleanNo, selectedFile);
                    const found = res?.images || [];
                    imageHoverCache.set(cleanNo, found);
                    setImages(found);
                } catch (e) {
                    console.error('Failed to pre-fetch image:', e);
                    setImages([]);
                } finally {
                    setIsLoading(false);
                    setHasLoaded(true);
                }
            }
        }, 180);
    };

    const handleMouseLeave = () => {
        if (hoverTimerRef.current) {
            clearTimeout(hoverTimerRef.current);
            hoverTimerRef.current = null;
        }
        leaveTimerRef.current = setTimeout(() => {
            setIsHovered(false);
        }, 140);
    };

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsHovered(false);
        if (onOpenModal && cleanNo) {
            const cached = imageHoverCache.get(cleanNo);
            onOpenModal(cached || (images ? images : []), cleanNo);
        }
    };

    // スクロールやリサイズ時は閉じる
    useEffect(() => {
        if (!isHovered) return;

        const handleScrollOrResize = () => {
            setIsHovered(false);
        };

        window.addEventListener('scroll', handleScrollOrResize, true);
        window.addEventListener('resize', handleScrollOrResize);

        return () => {
            window.removeEventListener('scroll', handleScrollOrResize, true);
            window.removeEventListener('resize', handleScrollOrResize);
        };
    }, [isHovered]);

    useEffect(() => {
        return () => {
            if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
            if (leaveTimerRef.current) clearTimeout(leaveTimerRef.current);
        };
    }, []);

    if (!cleanNo) return null;

    const firstImage = images && images.length > 0 ? images[0] : null;

    return (
        <div 
            className="relative inline-flex items-center"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button
                ref={buttonRef}
                type="button"
                onClick={handleClick}
                className={`inline-flex items-center gap-1 font-bold rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-xs transition-all hover:scale-105 active:scale-95 cursor-pointer select-none ${
                    size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[11px]'
                } ${className}`}
                title="クリックで拡大プレビュー（マウスを乗せるとサムネイル表示）"
            >
                <ImageIcon size={size === 'md' ? 14 : 12} className="text-white shrink-0" />
                <span>画像</span>
                {images && images.length > 1 && (
                    <span className="bg-blue-800/80 text-[10px] px-1 py-0.2 rounded-full font-mono">
                        {images.length}
                    </span>
                )}
            </button>

            {/* ホバー時のクイックピーク・ポップオーバー（Portalでbody直下に描画し、overflowやヘッダーによる見切れを完全防止） */}
            {isHovered && popoverPos && typeof document !== 'undefined' && createPortal(
                <div 
                    style={{
                        position: 'fixed',
                        top: `${popoverPos.top}px`,
                        left: `${popoverPos.left}px`,
                        width: '224px',
                        zIndex: 99999,
                    }}
                    className="bg-white rounded-xl shadow-2xl border border-blue-200 p-2.5 pointer-events-auto transition-all animate-in fade-in zoom-in-95 duration-150 select-none"
                    onMouseEnter={() => {
                        if (leaveTimerRef.current) {
                            clearTimeout(leaveTimerRef.current);
                            leaveTimerRef.current = null;
                        }
                    }}
                    onMouseLeave={handleMouseLeave}
                    onClick={handleClick}
                >
                    {/* 吹き出しの矢印 */}
                    <div 
                        style={{ left: `${popoverPos.arrowLeft}px` }}
                        className={`absolute w-3 h-3 bg-white border-blue-200 rotate-45 pointer-events-none ${
                            popoverPos.placeAbove 
                                ? 'bottom-[-6px] border-b border-r' 
                                : 'top-[-6px] border-t border-l'
                        }`}
                    />

                    {/* 上部ヘッダー */}
                    <div className="relative z-10 flex items-center justify-between gap-1 pb-1 mb-1.5 border-b border-gray-100 text-[10px] text-gray-500 font-medium">
                        <div className="flex items-center gap-1.5 truncate">
                            <span className="truncate font-bold text-gray-800">No.{cleanNo}</span>
                            {firstImage?.isViewerImage && (
                                <span className="bg-emerald-50 text-emerald-700 font-bold px-1 py-0.2 rounded text-[9px] border border-emerald-200 shrink-0">
                                    企画課Web
                                </span>
                            )}
                        </div>
                        {images && images.length > 0 && (
                            <span className="bg-blue-50 text-blue-700 font-bold px-1.5 py-0.5 rounded text-[10px] shrink-0">
                                全{images.length}枚
                            </span>
                        )}
                    </div>

                    {/* コンテンツエリア */}
                    {isLoading ? (
                        <div className="relative z-10 h-32 flex flex-col items-center justify-center gap-1.5 text-gray-400">
                            <Loader2 size={18} className="animate-spin text-blue-600" />
                            <span className="text-[11px]">画像読込中...</span>
                        </div>
                    ) : firstImage ? (
                        <div className="relative z-10 group cursor-pointer">
                            <div className="w-full h-32 bg-gray-50 rounded-lg overflow-hidden flex items-center justify-center border border-gray-100 relative">
                                <img
                                    src={getImageUrl(firstImage.path || '')}
                                    alt={firstImage.name || 'デザイン画像'}
                                    className="w-full h-full object-contain p-1"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors flex items-center justify-center">
                                    <span className="opacity-0 group-hover:opacity-100 bg-slate-900/80 text-white text-[10px] font-medium px-2 py-1 rounded-md transition-opacity shadow">
                                        クリックで拡大
                                    </span>
                                </div>
                            </div>
                            <div className="mt-1 text-[10px] text-gray-600 truncate font-mono text-center">
                                {firstImage.name}
                            </div>
                            {firstImage.folder && (
                                <div className="text-[9px] text-gray-400 truncate text-center">
                                    {firstImage.folder}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="relative z-10 h-24 flex flex-col items-center justify-center text-gray-400 text-center text-xs gap-1">
                            <ImageIcon size={20} className="text-gray-300 stroke-[1.5]" />
                            <span>画像が見つかりません</span>
                            <span className="text-[10px] text-gray-400">（クリックで検索）</span>
                        </div>
                    )}
                </div>,
                document.body
            )}
        </div>
    );
}
