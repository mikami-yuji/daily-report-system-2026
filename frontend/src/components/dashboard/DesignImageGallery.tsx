'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Image as ImageIcon, ChevronLeft, ChevronRight, Download, X, FileText } from 'lucide-react';
import { getImageUrl, DesignImage, getLatestDesignRequests, ViewerDesignRequest } from '@/lib/api';
import { useDesignImages } from '@/hooks/useQueryHooks';

type ExtendedDesignImage = DesignImage & {
  url?: string;
  isViewerImage?: boolean;
};

type DesignImageGalleryProps = {
  selectedFile: string;
};

export default function DesignImageGallery({ selectedFile }: DesignImageGalleryProps): React.JSX.Element {
  const { data, isLoading } = useDesignImages(selectedFile);
  const [selectedImageIndex, setSelectedImageIndex] = useState<number | null>(null);
  const [activePreviewImage, setActivePreviewImage] = useState<ExtendedDesignImage | null>(null);
  
  // 企画課ビューアから取得したカンプ画像用のステート
  const [viewerImages, setViewerImages] = useState<ExtendedDesignImage[]>([]);

  useEffect(() => {
    // ファイル名から担当営業名（名字）を抽出するヘルパー
    const extractName = (filename: string): string => {
      const base = filename.replace(/\.xlsm$/, '');
      const match = base.match(/【(.*?)】/);
      let name = match ? match[1] : base;
      name = name.replace(/^日報_/, '');
      name = name.replace(/(MGR|Mgr|次長|課長|部長|係長|主任|担当|顧問|専務|常務|社長)$/i, '');
      name = name.replace(/[\(（].*?[\)）]/, '');
      return name.trim();
    };

    const activeRep = extractName(selectedFile || '');
    if (!activeRep) return;

    getLatestDesignRequests()
      .then(data => {
        if (data && data.documents) {
          // 担当営業が一致し、進行中で、かつカンプ画像(compUrl)がある案件のみ抽出
          const list = data.documents.filter(doc => {
            if (doc.status === 'completed' || doc.status === 'rejected') return false;
            if (!doc.compUrl || !doc.salesPerson) return false;
            
            const viewerRep = doc.salesPerson.toLowerCase().trim();
            const rep = activeRep.toLowerCase().trim();
            return viewerRep.includes(rep) || rep.includes(viewerRep);
          }).map(doc => ({
            name: `[企画課最新カンプ] ${doc.requestId.split('-')[0]} - ${doc.designContent}`,
            path: doc.compUrl!,
            folder: '企画課デザインビューア',
            mtime: doc.requestedAt ? new Date(doc.requestedAt).getTime() / 1000 : 0,
            url: `http://192.168.1.5:8888${doc.compUrl}`,
            isViewerImage: true
          }));
          setViewerImages(list);
        }
      })
      .catch(err => {
        console.error('Failed to load viewer images for gallery:', err);
      });
  }, [selectedFile]);

  const imageFolder = data?.folder || '';

  const allImages = useMemo((): ExtendedDesignImage[] => {
    const local = data?.images || [];
    return [...viewerImages, ...local];
  }, [data, viewerImages]);

  // デザイン依頼番号（5桁以上の数字）ごとにグループ化し、最新の1枚のみを抽出した画像リスト
  const images = useMemo((): ExtendedDesignImage[] => {
    const rawImages = allImages;
    const groupedMap = new Map<string, ExtendedDesignImage>();
    const nonGrouped: ExtendedDesignImage[] = [];

    rawImages.forEach((img: ExtendedDesignImage) => {
      const match = img.name.match(/\d{5,}/);
      if (match) {
        const designId = match[0];
        const existing = groupedMap.get(designId);
        if (!existing || (img.mtime || 0) > (existing.mtime || 0)) {
          groupedMap.set(designId, img);
        }
      } else {
        nonGrouped.push(img);
      }
    });

    const filteredImages = [...Array.from(groupedMap.values()), ...nonGrouped];
    filteredImages.sort((a: ExtendedDesignImage, b: ExtendedDesignImage) => (b.mtime || 0) - (a.mtime || 0));

    return filteredImages;
  }, [allImages]);

  // 同一デザインID（5桁以上の数字）の関連画像を抽出
  const relatedImages = useMemo((): ExtendedDesignImage[] => {
    if (selectedImageIndex === null || images.length === 0 || !images[selectedImageIndex]) {
      return [];
    }
    const currentImg = images[selectedImageIndex];
    const match = currentImg.name.match(/\d{5,}/);
    if (!match) {
      return [currentImg];
    }
    const designId = match[0];
    const list = allImages.filter((img: ExtendedDesignImage) => {
      const m = img.name.match(/\d{5,}/);
      return m && m[0] === designId;
    });
    return list.sort((a: ExtendedDesignImage, b: ExtendedDesignImage) => (b.mtime || 0) - (a.mtime || 0));
  }, [selectedImageIndex, images, allImages]);

  // 企画課ビューア側のカンプ画像URLまたは現行のFastAPI経由の画像URLを返す
  const getSrc = (img: ExtendedDesignImage): string => {
    return img.isViewerImage && img.url ? img.url : getImageUrl(img.path);
  };

  // 代表画像のインデックスが変更されたときにアクティブプレビューを初期化
  useEffect((): void => {
    if (selectedImageIndex !== null && images[selectedImageIndex]) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePreviewImage(images[selectedImageIndex]);
    } else {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setActivePreviewImage(null);
    }
  }, [selectedImageIndex, images]);

  // モーダル表示時に背後のスクロールをロックする
  useEffect((): (() => void) => {
    if (selectedImageIndex !== null) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return (): void => {
      document.body.style.overflow = '';
    };
  }, [selectedImageIndex]);

  return (
    <div className="bg-white rounded border border-sf-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-sf-border bg-gray-50 flex items-center gap-2">
        <ImageIcon size={20} className="text-pink-500" />
        <h2 className="font-semibold text-sm text-sf-text">デザインデータ一覧 ({isLoading ? '読み込み中...' : (imageFolder || 'フォルダ検索中...')})</h2>
      </div>
      <div className="p-6 bg-gray-50/30">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sf-light-blue"></div>
          </div>
        ) : images.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
            {images.map((img: ExtendedDesignImage, i: number) => (
              <button
                key={i}
                onClick={(): void => setSelectedImageIndex(i)}
                className="group flex flex-col bg-white rounded-xl overflow-hidden border border-gray-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 text-left focus:outline-none cursor-pointer"
              >
                <div className="w-full aspect-[3/4] bg-gray-50 flex items-center justify-center p-3 relative overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={getSrc(img)}
                    alt={img.name}
                    className="max-w-full max-h-full object-contain group-hover:scale-[1.03] transition-transform duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-3 border-t border-gray-100 bg-white w-full">
                  <p className="text-xs font-semibold text-sf-text truncate" title={img.name}>
                    {img.name}
                  </p>
                  <p className="text-[10px] text-sf-text-weak mt-1">
                    {img.mtime ? new Date(img.mtime * 1000).toLocaleDateString() : ''}
                  </p>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300 text-sf-text-weak">
            {imageFolder ? '画像が見つかりませんでした' : '関連するデザインデータフォルダが見つかりません'}
          </div>
        )}
      </div>

      {/* スプリットビュー・画像プレビューモーダル */}
      {selectedImageIndex !== null && activePreviewImage && createPortal(
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-6xl w-full h-[90vh] flex flex-col animate-fadeIn overflow-hidden">
            {/* モーダルヘッダー */}
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50 flex-shrink-0">
              <div className="flex items-center gap-2">
                <ImageIcon size={20} className="text-pink-500" />
                <h3 className="font-bold text-sm text-sf-text truncate max-w-lg" title={activePreviewImage.name}>
                  {activePreviewImage.name}
                </h3>
              </div>
              <button
                onClick={(): void => setSelectedImageIndex(null)}
                className="text-gray-400 hover:text-gray-600 bg-gray-200/50 hover:bg-gray-200 rounded-full p-2 transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* モーダルコンテンツ */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-gray-100">
              {/* 左側：メインプレビュー */}
              <div className="flex-1 md:w-2/3 p-6 flex flex-col items-center justify-center relative bg-black/5 min-h-[350px]">
                {selectedImageIndex > 0 && (
                  <button
                    onClick={(): void => setSelectedImageIndex(selectedImageIndex - 1)}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 shadow-md rounded-full p-2.5 transition-all z-10 cursor-pointer"
                    title="前の商品"
                  >
                    <ChevronLeft size={24} />
                  </button>
                )}
                
                {selectedImageIndex < images.length - 1 && (
                  <button
                    onClick={(): void => setSelectedImageIndex(selectedImageIndex + 1)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white text-gray-800 shadow-md rounded-full p-2.5 transition-all z-10 cursor-pointer"
                    title="次の商品"
                  >
                    <ChevronRight size={24} />
                  </button>
                )}

                <div className="w-full h-full max-h-[60vh] flex items-center justify-center p-2">
                  {activePreviewImage.name.toLowerCase().endsWith('.pdf') ? (
                    <div className="flex flex-col items-center justify-center text-red-500 bg-white p-8 rounded-xl shadow border border-gray-200">
                      <FileText size={80} />
                      <span className="text-sm font-bold mt-4 text-gray-600">PDFファイルを別タブで開く</span>
                      <a
                        href={getImageUrl(activePreviewImage.path)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-4 px-6 py-2.5 bg-red-500 hover:bg-red-600 text-white text-sm font-bold rounded-lg shadow-sm transition-colors"
                      >
                        PDFを表示
                      </a>
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={getSrc(activePreviewImage)}
                      alt={activePreviewImage.name}
                      className="max-w-full max-h-[55vh] object-contain drop-shadow-lg animate-fadeIn"
                    />
                  )}
                </div>

                <div className="absolute bottom-4 flex gap-3">
                  <a
                    href={getSrc(activePreviewImage)}
                    download={activePreviewImage.name}
                    className="flex items-center gap-1.5 px-4 py-2 bg-white/90 hover:bg-white hover:text-sf-light-blue shadow text-xs font-semibold rounded-lg text-gray-700 transition-colors border border-gray-200/50"
                  >
                    <Download size={14} /> ダウンロード
                  </a>
                </div>
              </div>

              {/* 右側：バリエーションリスト */}
              <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-gray-200 bg-white flex flex-col overflow-hidden max-h-[30vh] md:max-h-none flex-shrink-0">
                <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex justify-between items-center flex-shrink-0">
                  <span className="text-xs font-bold text-sf-text">バリエーション・履歴 ({relatedImages.length})</span>
                </div>
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {relatedImages.map((relImg: ExtendedDesignImage, idx: number) => {
                    const isActive = relImg.path === activePreviewImage.path;
                    return (
                      <button
                        key={idx}
                        onClick={(): void => setActivePreviewImage(relImg)}
                        className={`w-full flex items-center gap-3 p-2 rounded-xl text-left border transition-all cursor-pointer ${
                          isActive 
                            ? 'border-sf-light-blue bg-blue-50/50 ring-1 ring-sf-light-blue' 
                            : 'border-gray-200 hover:bg-gray-50'
                        }`}
                      >
                        <div className="w-12 h-16 bg-gray-50 rounded border border-gray-200 overflow-hidden flex-shrink-0 flex items-center justify-center p-1">
                          {relImg.name.toLowerCase().endsWith('.pdf') ? (
                            <FileText size={20} className="text-red-500" />
                          ) : (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={getSrc(relImg)}
                              alt={relImg.name}
                              className="max-w-full max-h-full object-contain"
                              loading="lazy"
                            />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-sf-text truncate" title={relImg.name}>
                            {relImg.name}
                          </p>
                          <p className="text-[10px] text-sf-text-weak mt-1">
                            {relImg.mtime ? new Date(relImg.mtime * 1000).toLocaleString() : ''}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
