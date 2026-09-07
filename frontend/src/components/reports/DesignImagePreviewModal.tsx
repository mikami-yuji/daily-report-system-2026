import React, { useState, useEffect, useMemo } from 'react';
import { DesignImage, getImageUrl } from '@/lib/api';
import { X, ChevronLeft, ChevronRight, Download, FileText, Image as ImageIcon, Search, Layers, Sparkles } from 'lucide-react';

type DesignImagePreviewModalProps = {
    isOpen: boolean;
    onClose: () => void;
    images: DesignImage[];
    targetDesignNo?: string;
};

interface ParsedImageInfo {
    designNo: string;
    capacity?: string;
    isMain: boolean;
}

interface DesignGroup {
    designNo: string;
    count: number;
    isMain: boolean;
    capacities: string[];
    images: DesignImage[];
}

// ファイル名からデザイン番号および規格・容量を抽出するヘルパー
const parseImageInfo = (filename: string, targetDesignNo?: string): ParsedImageInfo => {
    // 5桁〜8桁の連続した数字をデザイン番号として抽出
    const matchNo = filename.match(/\d{5,8}/);
    const designNo = matchNo ? matchNo[0] : 'その他';

    // 容量・サイズ（例: 5kg, 10kg, 2kg, 1.4kg, 300g, 150g等）
    const matchCap = filename.match(/(\d+(?:\.\d+)?(?:kg|k|g|K|G))/i);
    const capacity = matchCap ? matchCap[1].toLowerCase() : undefined;

    const cleanTarget = targetDesignNo ? String(targetDesignNo).replace('.0', '').trim() : '';
    const isMain = cleanTarget ? designNo === cleanTarget : false;

    return {
        designNo,
        capacity,
        isMain,
    };
};

export default function DesignImagePreviewModal({
    isOpen,
    onClose,
    images,
    targetDesignNo
}: DesignImagePreviewModalProps): React.ReactElement | null {
    const cleanTarget = useMemo(() => {
        return targetDesignNo ? String(targetDesignNo).replace('.0', '').trim() : '';
    }, [targetDesignNo]);

    // 画像リストを更新日時の新しい順にソート
    const sortedImages = useMemo((): DesignImage[] => {
        return [...images].sort((a, b): number => {
            const timeA = a.mtime || 0;
            const timeB = b.mtime || 0;
            return timeB - timeA;
        });
    }, [images]);

    // 画像をデザイン番号ごとにグループ化
    const { groups, hasMultipleGroups, mainGroupExists } = useMemo(() => {
        const map = new Map<string, { images: DesignImage[]; capacities: Set<string>; isMain: boolean }>();

        sortedImages.forEach(img => {
            const info = parseImageInfo(img.name, cleanTarget);
            if (!map.has(info.designNo)) {
                map.set(info.designNo, {
                    images: [],
                    capacities: new Set<string>(),
                    isMain: info.isMain
                });
            }
            const groupData = map.get(info.designNo)!;
            groupData.images.push(img);
            if (info.capacity) {
                groupData.capacities.add(info.capacity);
            }
            if (info.isMain) {
                groupData.isMain = true;
            }
        });

        const groupList: DesignGroup[] = Array.from(map.entries()).map(([no, data]) => ({
            designNo: no,
            count: data.images.length,
            isMain: data.isMain,
            capacities: Array.from(data.capacities),
            images: data.images
        }));

        // メイン番号を先頭に、それ以外はデザイン番号順にソート
        groupList.sort((a, b) => {
            if (a.isMain && !b.isMain) return -1;
            if (!a.isMain && b.isMain) return 1;
            return a.designNo.localeCompare(b.designNo, undefined, { numeric: true });
        });

        const isMainPresent = cleanTarget ? groupList.some(g => g.designNo === cleanTarget) : false;

        return {
            groups: groupList,
            hasMultipleGroups: groupList.length > 1,
            mainGroupExists: isMainPresent
        };
    }, [sortedImages, cleanTarget]);

    // 選択中タブ（'all' または 各デザイン番号）
    const [selectedTab, setSelectedTab] = useState<string>('all');
    const [selectedIndex, setSelectedIndex] = useState<number>(0);
    const [prevImages, setPrevImages] = useState<DesignImage[]>(images);

    // 画像リストが切り替わったら初期化
    if (images !== prevImages) {
        setPrevImages(images);
        const initialTab = mainGroupExists ? cleanTarget : 'all';
        setSelectedTab(initialTab);
        setSelectedIndex(0);
    }

    // 現在のタブに応じた表示画像リスト
    const displayedImages = useMemo((): DesignImage[] => {
        if (!hasMultipleGroups || selectedTab === 'all') {
            return sortedImages;
        }
        const foundGroup = groups.find(g => g.designNo === selectedTab);
        return foundGroup ? foundGroup.images : sortedImages;
    }, [hasMultipleGroups, selectedTab, sortedImages, groups]);

    // タブ切り替え時のハンドラ
    const handleTabChange = (tab: string): void => {
        setSelectedTab(tab);
        setSelectedIndex(0);
    };

    // キーボード操作（Esc, 矢印キー）
    useEffect((): (() => void) | undefined => {
        if (!isOpen || displayedImages.length === 0) return;

        const handleKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                onClose();
            } else if (e.key === 'ArrowLeft' && selectedIndex > 0) {
                setSelectedIndex(prev => Math.max(0, prev - 1));
            } else if (e.key === 'ArrowRight' && selectedIndex < displayedImages.length - 1) {
                setSelectedIndex(prev => Math.min(displayedImages.length - 1, prev + 1));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return (): void => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, selectedIndex, displayedImages, onClose]);

    if (!isOpen || sortedImages.length === 0) return null;

    // 安全に現在表示中の画像を取得
    const safeIndex = selectedIndex >= 0 && selectedIndex < displayedImages.length ? selectedIndex : 0;
    const currentImage = displayedImages[safeIndex] || sortedImages[0];
    const isPdf = currentImage.name.toLowerCase().endsWith('.pdf');
    const currentInfo = parseImageInfo(currentImage.name, cleanTarget);

    // 日時フォーマット
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
            className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-[70] p-4 print:hidden backdrop-blur-xs" 
            onClick={(): void => onClose()}
        >
            <div 
                className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[92vh] flex flex-col md:flex-row overflow-hidden border border-gray-200" 
                onClick={(e): void => e.stopPropagation()}
            >
                {/* 左側：メインプレビュー画面 */}
                <div className="flex-1 bg-gray-50 flex flex-col min-w-0 border-r border-gray-200">
                    {/* プレビュー上部ヘッダー */}
                    <div className="flex justify-between items-center px-6 py-3.5 border-b border-gray-200 bg-white">
                        <div className="flex items-center gap-2.5 text-sf-text min-w-0">
                            {isPdf ? (
                                <FileText size={18} className="text-red-500 flex-shrink-0" />
                            ) : (
                                <ImageIcon size={18} className="text-pink-500 flex-shrink-0" />
                            )}
                            <div className="min-w-0 flex items-center gap-2">
                                <h3 className="font-bold text-sm truncate text-gray-800" title={currentImage.name}>
                                    {currentImage.name}
                                </h3>
                                {currentInfo.designNo !== 'その他' && (
                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                                        currentInfo.isMain 
                                            ? 'bg-blue-100 text-blue-700 border border-blue-200' 
                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                    }`}>
                                        No.{currentInfo.designNo} {currentInfo.isMain ? '(対象)' : '(兄弟)'}
                                    </span>
                                )}
                                {currentInfo.capacity && (
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 border border-gray-200 flex-shrink-0">
                                        {currentInfo.capacity}
                                    </span>
                                )}
                            </div>
                        </div>
                        {/* 閉じるボタン（モバイル用） */}
                        <button
                            onClick={(): void => onClose()}
                            className="text-gray-400 hover:text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-full p-1.5 transition-colors cursor-pointer md:hidden"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* メインプレビュー領域 */}
                    <div className="flex-1 flex items-center justify-center p-6 relative bg-slate-900/5 min-h-[350px]">
                        {/* 左右スライドショーボタン */}
                        {displayedImages.length > 1 && safeIndex > 0 && (
                            <button
                                onClick={(): void => setSelectedIndex(safeIndex - 1)}
                                className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white rounded-full p-2.5 text-gray-700 shadow-md hover:scale-105 transition-all cursor-pointer z-10 border border-gray-200"
                                title="前の画像"
                            >
                                <ChevronLeft size={20} />
                            </button>
                        )}

                        {isPdf ? (
                            <div className="flex flex-col items-center justify-center p-8 bg-white rounded-xl border border-gray-200 shadow-sm max-w-sm text-center">
                                <FileText size={64} className="text-red-500 mb-4 animate-pulse" />
                                <h4 className="font-bold text-gray-800 text-sm mb-2">{currentImage.name}</h4>
                                <p className="text-xs text-gray-500 mb-6">PDFファイルはブラウザのプレビュー機能で開いて確認できます。</p>
                                <a
                                    href={getImageUrl(currentImage.path)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-5 py-2.5 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg text-sm transition-colors shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
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
                                className="max-w-full max-h-[50vh] md:max-h-[62vh] object-contain shadow-md bg-white rounded-lg p-2 transition-all duration-300 border border-gray-200"
                            />
                        )}

                        {displayedImages.length > 1 && safeIndex < displayedImages.length - 1 && (
                            <button
                                onClick={(): void => setSelectedIndex(safeIndex + 1)}
                                className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/95 hover:bg-white rounded-full p-2.5 text-gray-700 shadow-md hover:scale-105 transition-all cursor-pointer z-10 border border-gray-200"
                                title="次の画像"
                            >
                                <ChevronRight size={20} />
                            </button>
                        )}

                        {/* 現在の画像枚数インジケーター */}
                        {displayedImages.length > 1 && (
                            <div className="absolute bottom-3 right-4 bg-black/60 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-full shadow-sm">
                                {safeIndex + 1} / {displayedImages.length}
                            </div>
                        )}
                    </div>

                    {/* フッターダウンロードボタン領域 */}
                    <div className="px-6 py-3.5 border-t border-gray-200 bg-white flex justify-center items-center gap-3">
                        <a
                            href={getImageUrl(currentImage.path)}
                            download={currentImage.name}
                            onClick={(e): void => {
                                if (isPdf) {
                                    e.preventDefault();
                                    window.open(getImageUrl(currentImage.path), '_blank');
                                }
                            }}
                            className="px-5 py-2 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg text-xs text-gray-700 font-bold shadow-2xs flex items-center gap-2 transition-all cursor-pointer hover:border-gray-400"
                        >
                            <Download size={15} className="text-gray-500" />
                            {isPdf ? 'PDFを閲覧' : '画像をダウンロード'}
                        </a>
                    </div>
                </div>

                {/* 右側：バリエーション・履歴リスト（タブ管理付き） */}
                <div className="w-full md:w-96 border-t md:border-t-0 md:border-l border-gray-200 flex flex-col bg-white shrink-0 min-w-0">
                    {/* 右側ヘッダー */}
                    <div className="px-5 py-3.5 border-b border-gray-200 flex justify-between items-center bg-gray-50/70">
                        <h4 className="font-bold text-sm text-gray-800 flex items-center gap-1.5">
                            <Search size={16} className="text-blue-500" />
                            バリエーション・履歴
                            <span className="text-xs font-semibold text-gray-500 bg-gray-200/80 px-2 py-0.5 rounded-full">
                                {sortedImages.length}件
                            </span>
                        </h4>
                        {/* 閉じるボタン（デスクトップ用） */}
                        <button
                            onClick={(): void => onClose()}
                            className="text-gray-400 hover:text-gray-600 bg-gray-200/60 hover:bg-gray-200 rounded-full p-1.5 transition-colors cursor-pointer hidden md:block"
                            title="閉じる"
                        >
                            <X size={16} />
                        </button>
                    </div>

                    {/* 兄弟デザインが存在する場合の規格別タブバー（スライドバー廃止・折り返しで全表示） */}
                    {hasMultipleGroups && (
                        <div className="p-3 bg-slate-50 border-b border-gray-200">
                            <div className="text-[11px] font-bold text-gray-600 mb-2 flex items-center justify-between">
                                <span className="flex items-center gap-1.5">
                                    <Layers size={13} className="text-purple-600" />
                                    兄弟デザイン規格 ({groups.length}種類)
                                </span>
                                <span className="text-[10px] text-gray-400 font-normal">規格をクリックで切替</span>
                            </div>
                            {/* スライドバーを廃止し、flex-wrapで全タブを一度に一覧表示 */}
                            <div className="flex flex-wrap items-center gap-1.5">
                                {/* すべてタブ */}
                                <button
                                    onClick={(): void => handleTabChange('all')}
                                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs ${
                                        selectedTab === 'all'
                                            ? 'bg-blue-600 text-white shadow-sm ring-1 ring-blue-700'
                                            : 'bg-white text-gray-700 hover:bg-gray-100/80 border border-gray-300'
                                    }`}
                                >
                                    <span>すべて</span>
                                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                                        selectedTab === 'all' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {sortedImages.length}
                                    </span>
                                </button>

                                {/* 各デザイン番号タブ */}
                                {groups.map(group => {
                                    const isSelected = selectedTab === group.designNo;
                                    return (
                                        <button
                                            key={group.designNo}
                                            onClick={(): void => handleTabChange(group.designNo)}
                                            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs border ${
                                                isSelected
                                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm ring-1 ring-blue-700'
                                                    : group.isMain
                                                        ? 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100/80'
                                                        : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-100/80'
                                            }`}
                                        >
                                            {group.isMain && (
                                                <Sparkles size={11} className={isSelected ? 'text-amber-200' : 'text-blue-600'} />
                                            )}
                                            <span>{group.designNo}</span>
                                            {group.capacities.length > 0 && (
                                                <span className={`text-[9px] px-1 py-0.2 rounded font-semibold ${
                                                    isSelected 
                                                        ? 'bg-blue-700 text-blue-100' 
                                                        : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {group.capacities[0]}
                                                </span>
                                            )}
                                            <span className={`text-[10px] ${isSelected ? 'text-blue-100' : 'text-gray-400'}`}>
                                                ({group.count})
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* 画像一覧リスト */}
                    <div className="flex-1 overflow-y-auto p-3.5 space-y-3 max-h-[35vh] md:max-h-none">
                        {/* 「すべて」タブかつ複数グループがある場合はセクション区切りで表示 */}
                        {hasMultipleGroups && selectedTab === 'all' ? (
                            groups.map(group => (
                                <div key={group.designNo} className="space-y-2">
                                    {/* グループヘッダー */}
                                    <div className="flex items-center justify-between px-2 py-1.5 bg-gray-100/80 rounded-md border border-gray-200/80">
                                        <div className="flex items-center gap-1.5 min-w-0">
                                            <span className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                group.isMain ? 'bg-blue-600 ring-2 ring-blue-200' : 'bg-amber-500'
                                            }`} />
                                            <span className="text-xs font-black text-gray-800">
                                                No.{group.designNo}
                                            </span>
                                            {group.capacities.length > 0 && (
                                                <span className="text-[10px] font-bold text-gray-500 bg-white px-1.5 py-0.2 rounded border border-gray-200">
                                                    {group.capacities.join(', ')}
                                                </span>
                                            )}
                                            {group.isMain && (
                                                <span className="text-[9px] bg-blue-600 text-white px-1.5 py-0.2 rounded font-bold">
                                                    検索対象
                                                </span>
                                            )}
                                            {!group.isMain && (
                                                <span className="text-[9px] bg-amber-100 text-amber-800 px-1.5 py-0.2 rounded font-bold">
                                                    兄弟
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] font-bold text-gray-400">
                                            {group.count}件
                                        </span>
                                    </div>

                                    {/* グループ内の画像アイテム */}
                                    <div className="space-y-2 pl-1">
                                        {group.images.map((img) => {
                                            const itemIsPdf = img.name.toLowerCase().endsWith('.pdf');
                                            const isSelected = img.path === currentImage.path;
                                            const info = parseImageInfo(img.name, cleanTarget);

                                            return (
                                                <div
                                                    key={img.path}
                                                    onClick={(): void => {
                                                        const targetIdx = displayedImages.findIndex(di => di.path === img.path);
                                                        if (targetIdx >= 0) {
                                                            setSelectedIndex(targetIdx);
                                                        }
                                                    }}
                                                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                                                        isSelected
                                                            ? 'border-blue-500 bg-blue-50/60 text-blue-900 ring-2 ring-blue-400/40 shadow-xs'
                                                            : 'border-gray-200 hover:bg-gray-50/90 text-gray-800 bg-white'
                                                    }`}
                                                >
                                                    {/* サムネイル */}
                                                    <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                                        {itemIsPdf ? (
                                                            <div className="flex flex-col items-center justify-center text-red-500">
                                                                <FileText size={18} />
                                                                <span className="text-[8px] font-black mt-0.5">PDF</span>
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
                                                    {/* 詳細情報 */}
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-center gap-1.5 mb-1">
                                                            {info.capacity && (
                                                                <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                                                    {info.capacity}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400">
                                                                {formatDateTime(img.mtime)}
                                                            </span>
                                                        </div>
                                                        <div 
                                                            className="text-xs font-semibold break-all line-clamp-2 leading-snug"
                                                            title={img.name}
                                                        >
                                                            {img.name}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            /* 単一タブまたは個別グループ絞り込み表示 */
                            displayedImages.map((img, i): React.ReactElement => {
                                const itemIsPdf = img.name.toLowerCase().endsWith('.pdf');
                                const isSelected = i === safeIndex;
                                const info = parseImageInfo(img.name, cleanTarget);

                                return (
                                    <div
                                        key={img.path || i}
                                        onClick={(): void => setSelectedIndex(i)}
                                        className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50/60 text-blue-900 ring-2 ring-blue-400/40 shadow-xs'
                                                : 'border-gray-200 hover:bg-gray-50/90 text-gray-800 bg-white'
                                        }`}
                                    >
                                        {/* サムネイル */}
                                        <div className="w-12 h-12 bg-gray-50 border border-gray-200 rounded overflow-hidden flex items-center justify-center shrink-0 shadow-inner">
                                            {itemIsPdf ? (
                                                <div className="flex flex-col items-center justify-center text-red-500">
                                                    <FileText size={18} />
                                                    <span className="text-[8px] font-black mt-0.5">PDF</span>
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
                                            <div className="flex items-center gap-1.5 mb-1">
                                                {info.designNo !== 'その他' && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                                                        info.isMain 
                                                            ? 'bg-blue-100 text-blue-700' 
                                                            : 'bg-amber-100 text-amber-800'
                                                    }`}>
                                                        No.{info.designNo}
                                                    </span>
                                                )}
                                                {info.capacity && (
                                                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-gray-100 text-gray-700 border border-gray-200">
                                                        {info.capacity}
                                                    </span>
                                                )}
                                                <span className="text-[10px] text-gray-400 ml-auto">
                                                    {formatDateTime(img.mtime)}
                                                </span>
                                            </div>
                                            <div 
                                                className="text-xs font-semibold break-all line-clamp-2 leading-snug"
                                                title={img.name}
                                            >
                                                {img.name}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

