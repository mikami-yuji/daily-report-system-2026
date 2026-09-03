'use client';

import { useEffect, useState, useMemo } from 'react';
import { useFiles, useReports, useViewerDesignRequests } from '@/hooks/useQueryHooks';
import { Report } from '@/lib/api';
import { Search, Calendar, FileText, TrendingUp, Package, Image as ImageIcon, ExternalLink, Key, Loader2, Layers } from 'lucide-react';
import PdfPreviewModal, { PdfItem } from '@/components/reports/PdfPreviewModal';
import { ViewerDesignRequest } from '@/types/report';
import { isSalesPersonMatch, extractSalesPersonName } from '@/lib/reportUtils';

export default function DesignProgressPage() {
    // React Queryでファイル一覧取得
    const { data: filesData } = useFiles();
    const files = filesData?.files || [];
    const defaultFile = filesData?.default || '';

    const [selectedFile, setSelectedFile] = useState<string>('');

    // デフォルトファイルが読み込まれたら設定
    useEffect(() => {
        if (defaultFile && !selectedFile) {
            Promise.resolve().then(() => {
                setSelectedFile(defaultFile);
            });
        }
    }, [defaultFile, selectedFile]);

    // React Queryでレポート取得
    const { data: reports = [], isLoading } = useReports(selectedFile || undefined);

    // 企画課ビューワーからデザインデータ取得
    const { data: viewerData, isLoading: isLoadingViewer } = useViewerDesignRequests();

    // PDFプレビュー用ステート (全版対応)
    const [isPdfModalOpen, setIsPdfModalOpen] = useState<boolean>(false);
    const [previewPdfItems, setPreviewPdfItems] = useState<PdfItem[]>([]);
    const [previewPdfTitle, setPreviewPdfTitle] = useState<string>('');
    const [previewPdfInitialIndex, setPreviewPdfInitialIndex] = useState<number>(0);

    const [selectedCustomer, setSelectedCustomer] = useState<string>('');
    const [selectedDesignNo, setSelectedDesignNo] = useState<string>('');
    const [prevSelectedDesignNo, setPrevSelectedDesignNo] = useState<string>(selectedDesignNo);
    const [selectedDocIndex, setSelectedDocIndex] = useState<number>(0);

    // デザイン番号が変わったら版インデックスを0にリセット (React公式推奨パターン)
    if (prevSelectedDesignNo !== selectedDesignNo) {
        setPrevSelectedDesignNo(selectedDesignNo);
        setSelectedDocIndex(0);
    }

    const activeSalesPerson = useMemo((): string => extractSalesPersonName(selectedFile), [selectedFile]);

    // 自分の営業案件のビューワーデータマップを作成 (キー: 短縮されたrequestId, 値: 全件配列)
    const viewerMap = useMemo((): Map<string, ViewerDesignRequest[]> => {
        const map = new Map<string, ViewerDesignRequest[]>();
        if (!viewerData || !viewerData.documents || !selectedFile) return map;

        viewerData.documents.forEach((doc: ViewerDesignRequest): void => {
            if (!doc.salesPerson) return;
            
            if (isSalesPersonMatch(doc.salesPerson, selectedFile)) {
                // requestIdは "120451-01" 等。ハイフン前を取り出す
                const shortId = doc.requestId.split('-')[0].trim();
                if (!map.has(shortId)) {
                    map.set(shortId, []);
                }
                map.get(shortId)!.push(doc);
            }
        });

        // 最新順（枝番降順・日付降順）にソート
        map.forEach((docs) => {
            docs.sort((a, b) => {
                const dateA = a.requestDate || a.requestedAt || '';
                const dateB = b.requestDate || b.requestedAt || '';
                const dateCmp = dateB.localeCompare(dateA);
                if (dateCmp !== 0) return dateCmp;
                return b.requestId.localeCompare(a.requestId, undefined, { numeric: true });
            });
        });

        return map;
    }, [viewerData, selectedFile]);

    // 選択されたデザインNo.に対応するビューワー側データ全件
    const currentViewerDesigns = useMemo((): ViewerDesignRequest[] => {
        if (!selectedDesignNo) return [];
        return viewerMap.get(selectedDesignNo) || [];
    }, [selectedDesignNo, viewerMap]);

    // 現在選択中の版データ（デフォルトは最新版）
    const currentViewerDesign = currentViewerDesigns[selectedDocIndex] || currentViewerDesigns[0] || null;
    // デザイン依頼があるカスタマー一覧を抽出
    const customers = useMemo((): string[] => {
        const customerSet = new Set<string>();
        reports.forEach((r: Report): void => {
            const custId = r.得意先CD ? String(r.得意先CD) : '';
            const designNo = r['デザイン依頼No.'];
            if (custId && custId !== '-' && designNo && designNo !== '-') {
                customerSet.add(custId);
            }
        });
        return Array.from(customerSet).sort();
    }, [reports]);

    // 選択されたカスタマーのデザイン番号を抽出
    const designNumbers = useMemo((): string[] => {
        if (!selectedCustomer) return [];
        const designSet = new Set<string>();
        reports.forEach((r: Report): void => {
            if (String(r.得意先CD) === selectedCustomer) {
                const designNo = r['デザイン依頼No.'];
                if (designNo && designNo !== '-') {
                    designSet.add(String(designNo));
                }
            }
        });
        return Array.from(designSet).sort();
    }, [selectedCustomer, reports]);

    // When a design number is selected, build progress history
    const progressHistory = useMemo((): Report[] => {
        if (selectedCustomer && selectedDesignNo) {
            return reports
                .filter((r: Report): boolean =>
                    String(r.得意先CD) === selectedCustomer &&
                    String(r['デザイン依頼No.']) === selectedDesignNo
                )
                .sort((a: Report, b: Report): number => {
                    const dateA = new Date(a.日付 || '').getTime();
                    const dateB = new Date(b.日付 || '').getTime();
                    return dateB - dateA;
                });
        }
        return [];
    }, [selectedDesignNo, selectedCustomer, reports]);

    const getCustomerName = (customerCD: string): string => {
        const report = reports.find((r: Report): boolean => String(r.得意先CD) === customerCD);
        return report?.訪問先名 || customerCD;
    };

    return (
        <div className="space-y-4 h-[calc(100vh-8rem)] flex flex-col">
            {/* Header */}
            <div className="flex justify-between items-center bg-white p-4 rounded border border-sf-border shadow-sm">
                <div className="flex items-center gap-3">
                    <div className="bg-sf-light-blue p-2 rounded text-white shadow-sm">
                        <Package size={20} />
                    </div>
                    <div>
                        <p className="text-xs text-sf-text-weak font-medium">オブジェクト</p>
                        <h1 className="text-xl font-bold text-sf-text">デザイン進捗管理</h1>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={selectedFile}
                        onChange={e => setSelectedFile(e.target.value)}
                        className="text-sm text-sf-text bg-white border border-sf-border rounded px-3 py-2"
                    >
                        {files.map(file => (
                            <option key={file.name} value={file.name}>
                                {file.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white p-4 rounded border border-sf-border shadow-sm">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-2">
                            <Search size={16} className="inline mr-1" />
                            得意先CD
                        </label>
                        <select
                            value={selectedCustomer}
                            onChange={e => {
                                setSelectedCustomer(e.target.value);
                                setSelectedDesignNo('');
                            }}
                            className="w-full border border-sf-border rounded px-3 py-2 text-sf-text"
                        >
                            <option value="">-- 得意先を選択 --</option>
                            {customers.map(cd => (
                                <option key={cd} value={cd}>
                                    {cd} - {getCustomerName(cd)}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-sf-text mb-2">
                            <FileText size={16} className="inline mr-1" />
                            デザイン依頼No.
                        </label>
                        <select
                            value={selectedDesignNo}
                            onChange={e => setSelectedDesignNo(e.target.value)}
                            className="w-full border border-sf-border rounded px-3 py-2 text-sf-text"
                            disabled={!selectedCustomer}
                        >
                            <option value="">-- デザイン依頼Noを選択 --</option>
                            {designNumbers.map(no => (
                                <option key={no} value={no}>
                                    {no}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>
                {selectedCustomer && designNumbers.length === 0 && (
                    <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-800">
                        この得意先にはデザイン依頼がありません
                    </div>
                )}
            </div>

            {/* Progress History */}
            <div className="bg-white border border-sf-border shadow-sm flex-1 overflow-auto rounded">
                {!selectedDesignNo ? (
                    <div className="p-10 text-center text-sf-text-weak">
                        <Package size={48} className="mx-auto mb-4 opacity-30" />
                        <p>得意先CDとデザイン依頼Noを選択してください</p>
                    </div>
                ) : progressHistory.length === 0 ? (
                    <div className="p-10 text-center text-sf-text-weak">進捗履歴が見つかりません</div>
                ) : (
                    <div className="p-6">
                        {/* Summary */}
                        <div className="mb-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 左カラム: 日報登録データ */}
                            <div className="p-5 bg-gray-50 rounded-xl border border-sf-border shadow-sm flex flex-col justify-between">
                                <h4 className="font-semibold text-xs text-sf-text-weak uppercase tracking-wider mb-4 pb-2 border-b border-sf-border flex items-center gap-1.5">
                                    <FileText size={14} className="text-sf-light-blue" />
                                    日報登録データサマリー
                                </h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-xs text-sf-text-weak mb-0.5">得意先CD</p>
                                        <p className="font-bold text-sm text-sf-text">{selectedCustomer}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-sf-text-weak mb-0.5">得意先名</p>
                                        <p className="font-bold text-sm text-sf-text truncate" title={getCustomerName(selectedCustomer)}>{getCustomerName(selectedCustomer)}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-sf-text-weak mb-0.5">デザイン依頼No.</p>
                                        <p className="font-bold text-sm text-sf-text">{selectedDesignNo}</p>
                                    </div>
                                    <div>
                                        <p className="text-xs text-sf-text-weak mb-0.5">最新進捗状況</p>
                                        <p className="font-bold text-sm text-sf-text">
                                            {progressHistory.length > 0 ? progressHistory[0].デザイン進捗状況 : '-'}
                                        </p>
                                    </div>
                                    <div className="col-span-2">
                                        <p className="text-xs text-sf-text-weak mb-0.5">累計活動回数</p>
                                        <p className="font-extrabold text-sf-light-blue text-2xl">{progressHistory.length} <span className="text-xs font-normal text-sf-text-weak">件の日報履歴</span></p>
                                    </div>
                                </div>
                            </div>

                            {/* 右カラム: 企画課ビューワー情報 (リアルタイム) */}
                            <div className="p-5 bg-amber-50/20 rounded-xl border border-amber-200/60 shadow-sm flex flex-col justify-between">
                                <h4 className="font-semibold text-xs text-amber-700/80 uppercase tracking-wider mb-4 pb-2 border-b border-amber-200/50 flex items-center justify-between">
                                    <span className="flex items-center gap-1.5">
                                        <ImageIcon size={14} className="text-amber-500" />
                                        企画課ビューワー連携 (リアルタイム)
                                    </span>
                                    {isLoadingViewer && <Loader2 size={12} className="animate-spin text-amber-600" />}
                                </h4>

                                {(() => {
                                    const hasPasscode = typeof window !== 'undefined' ? !!localStorage.getItem('viewer_passcode') : false;
                                    if (!hasPasscode) {
                                        return (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                                                <Key size={32} className="text-amber-500/60 mb-2 animate-bounce" />
                                                <p className="text-xs text-amber-800 font-bold mb-1">連携用パスコードが未設定です</p>
                                                <p className="text-[10px] text-gray-500 mb-3">設定画面からパスコードを入力すると、企画課側のリアルタイム進捗と仕様書PDFを確認できます。</p>
                                                <a href="/settings" className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-[11px] font-bold shadow-sm transition-colors cursor-pointer">
                                                    設定画面へ行く
                                                </a>
                                            </div>
                                        );
                                    }

                                    if (isLoadingViewer) {
                                        return (
                                            <div className="flex-1 flex items-center justify-center p-8 text-sf-text-weak text-xs">
                                                <Loader2 size={18} className="animate-spin mr-2" /> 企画課から最新データを読み込み中...
                                            </div>
                                        );
                                    }

                                    if (!currentViewerDesign) {
                                        return (
                                            <div className="flex-1 flex flex-col items-center justify-center text-center p-4">
                                                <Package size={32} className="text-gray-300 mb-2" />
                                                <p className="text-xs text-gray-500 font-medium">企画課ビューワー側に該当案件が見つかりません</p>
                                                <p className="text-[10px] text-gray-400 mt-1 max-w-[280px]">日報のデザインNo.「{selectedDesignNo}」に一致するビューワーのRequestIdがありません。または、担当営業者名（{activeSalesPerson}）が一致していない可能性があります。</p>
                                            </div>
                                        );
                                    }

                                    // ステータスの日本語表示マップ
                                    const statusLabelMap: Record<string, { label: string, color: string }> = {
                                        inProgress: { label: 'デザイン作成中', color: 'bg-blue-50 text-blue-700 border-blue-200' },
                                        completed: { label: 'カンプアップ完了', color: 'bg-green-50 text-green-700 border-green-200' },
                                        rejected: { label: '却下', color: 'bg-red-50 text-red-700 border-red-200' },
                                        inSubmission: { label: '入稿手配中', color: 'bg-purple-50 text-purple-700 border-purple-200' }
                                    };
                                    const statusInfo = statusLabelMap[currentViewerDesign.status] || { label: currentViewerDesign.status, color: 'bg-gray-50 text-gray-700 border-gray-200' };

                                    return (
                                        <div className="flex flex-col flex-1 justify-between">
                                            {/* 複数版が存在する場合の切り替えタブ */}
                                            {currentViewerDesigns.length > 1 && (
                                                <div className="flex items-center gap-1.5 mb-3 pb-2.5 border-b border-amber-200/50 overflow-x-auto text-[11px]">
                                                    <span className="font-bold text-amber-900 whitespace-nowrap flex items-center gap-1">
                                                        <Layers size={12} className="text-amber-600" /> 依頼履歴 ({currentViewerDesigns.length}件):
                                                    </span>
                                                    {currentViewerDesigns.map((doc, idx) => (
                                                        <button
                                                            key={doc.requestId || idx}
                                                            onClick={() => setSelectedDocIndex(idx)}
                                                            className={`px-2 py-1 rounded font-bold transition-all whitespace-nowrap cursor-pointer ${
                                                                idx === selectedDocIndex
                                                                    ? 'bg-amber-600 text-white shadow-xs'
                                                                    : 'bg-white text-amber-900 hover:bg-amber-100 border border-amber-300/80'
                                                            }`}
                                                        >
                                                            {doc.requestId}
                                                            {doc.requestDate && ` (${doc.requestDate})`}
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1">
                                                {/* テキスト情報 */}
                                                <div className="space-y-3 flex flex-col justify-between text-xs text-sf-text">
                                                    <div>
                                                        <p className="text-xs text-sf-text-weak mb-0.5">企画課ステータス</p>
                                                        <span className={`inline-block px-2.5 py-1 text-xs font-bold rounded-md border ${statusInfo.color}`}>
                                                            {statusInfo.label}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-sf-text-weak mb-0.5">担当デザイナー (プランナー)</p>
                                                        <p className="font-bold">{currentViewerDesign.planner || '-'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-xs text-sf-text-weak mb-0.5">納品予定日 (納期)</p>
                                                        <p className="font-bold text-amber-700">{currentViewerDesign.deliveryDate || '-'}</p>
                                                    </div>
                                                    {currentViewerDesign.pdfUrl && (
                                                        <div className="pt-1">
                                                            <button
                                                                onClick={(): void => {
                                                                    const allPdfItems: PdfItem[] = currentViewerDesigns.filter(d => !!d.pdfUrl).map(d => ({
                                                                        title: `仕様書: ${d.requestId} - ${d.designContent || ''}`,
                                                                        url: d.pdfUrl!,
                                                                        requestId: d.requestId,
                                                                        requestDate: d.requestDate,
                                                                        designContent: d.designContent,
                                                                        status: d.status
                                                                    }));
                                                                    const targetIdx = allPdfItems.findIndex(item => item.requestId === currentViewerDesign.requestId);
                                                                    setPreviewPdfItems(allPdfItems);
                                                                    setPreviewPdfTitle(`仕様書: ${currentViewerDesign.requestId} - ${currentViewerDesign.designContent || ''}`);
                                                                    setPreviewPdfInitialIndex(targetIdx >= 0 ? targetIdx : 0);
                                                                    setIsPdfModalOpen(true);
                                                                }}
                                                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 rounded-lg font-bold text-xs transition-colors cursor-pointer shadow-xs"
                                                            >
                                                                <FileText size={14} />
                                                                仕様書PDFをプレビュー {currentViewerDesigns.filter(d => !!d.pdfUrl).length > 1 && `(全${currentViewerDesigns.filter(d => !!d.pdfUrl).length}件)`}
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* カンプ画像サムネイル */}
                                                <div className="flex flex-col justify-center items-center bg-white border border-sf-border rounded-lg p-2 relative h-32 md:h-full min-h-[100px]">
                                                    {currentViewerDesign.compUrl ? (
                                                        <>
                                                            <a
                                                                href={`http://192.168.1.5:8888${currentViewerDesign.compUrl}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="relative w-full h-full flex items-center justify-center group overflow-hidden"
                                                                title="カンプ画像を別タブで開く"
                                                            >
                                                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                                                <img
                                                                    src={`http://192.168.1.5:8888${currentViewerDesign.compUrl}`}
                                                                    alt="最新カンプ画像"
                                                                    className="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform duration-300"
                                                                />
                                                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white text-[10px] font-bold gap-1 rounded">
                                                                    <ExternalLink size={12} /> 開く
                                                                </div>
                                                            </a>
                                                            <p className="text-[9px] text-sf-text-weak mt-1">
                                                                カンプ画像 ({currentViewerDesign.requestId})
                                                            </p>
                                                        </>
                                                    ) : (
                                                        <div className="flex flex-col items-center text-sf-text-weak text-[10px]">
                                                            <ImageIcon size={24} className="opacity-30 mb-1" />
                                                            <span>カンプ画像未登録</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>
                        {/* Timeline */}
                        <div className="space-y-4">
                            <h3 className="font-semibold text-sf-text flex items-center gap-2">
                                <TrendingUp size={20} className="text-sf-light-blue" />
                                進捗履歴
                            </h3>
                            <div className="relative border-l-2 border-sf-light-blue ml-4 pl-6 space-y-6">
                                {progressHistory.map((report, i) => (
                                    <div key={i} className="relative">
                                        <div className="absolute -left-[1.6rem] top-2 w-4 h-4 bg-sf-light-blue rounded-full border-4 border-white shadow" />
                                        <div className="bg-white border border-sf-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-2">
                                                    <Calendar size={16} className="text-sf-text-weak" />
                                                    <span className="font-semibold text-sf-text">{report.日付}</span>
                                                </div>
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs font-medium ${report.デザイン進捗状況 === '完了'
                                                        ? 'bg-green-100 text-green-700'
                                                        : report.デザイン進捗状況 === '進行中'
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : report.デザイン進捗状況 === '保留'
                                                                ? 'bg-yellow-100 text-yellow-700'
                                                                : 'bg-gray-100 text-gray-700'
                                                        }`}
                                                >
                                                    {report.デザイン進捗状況 || '未設定'}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">行動内容</p>
                                                    <p className="text-sf-text">{report.行動内容 || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">面談者</p>
                                                    <p className="text-sf-text">{report.面談者 || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">デザイン種別</p>
                                                    <p className="text-sf-text">{report.デザイン種別 || '-'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-xs text-sf-text-weak mb-1">デザイン名</p>
                                                    <p className="text-sf-text">{report.デザイン名 || '-'}</p>
                                                </div>
                                            </div>
                                            {report.商談内容 && (
                                                <div className="mt-3 pt-3 border-t border-sf-border">
                                                    <p className="text-xs text-sf-text-weak mb-1">商談内容</p>
                                                    <p className="text-sm text-sf-text">{report.商談内容}</p>
                                                </div>
                                            )}
                                            {report.次回プラン && (
                                                <div className="mt-2">
                                                    <p className="text-xs text-sf-text-weak mb-1">次回プラン</p>
                                                    <p className="text-sm text-sf-text bg-blue-50 p-2 rounded">{report.次回プラン}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {selectedDesignNo && (
                <div className="p-2 bg-white border border-sf-border rounded text-xs text-sf-text-weak">
                    {progressHistory.length} 件の進捗記録
                </div>
            )}

            {/* PDF仕様書プレビューモーダル */}
            <PdfPreviewModal
                isOpen={isPdfModalOpen}
                onClose={(): void => setIsPdfModalOpen(false)}
                items={previewPdfItems}
                title={previewPdfTitle}
                initialIndex={previewPdfInitialIndex}
            />
        </div>
    );
}
