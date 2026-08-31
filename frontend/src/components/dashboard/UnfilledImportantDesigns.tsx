'use client';

import React, { useMemo } from 'react';
import { AlertTriangle, PenSquare, Calendar, User } from 'lucide-react';
import { Report, ViewerDesignRequest } from '@/types/report';
import { InitialDesignData } from '@/components/reports/NewReportModal';
import { isSalesPersonMatch } from '@/lib/reportUtils';

type UnfilledImportantDesignsProps = {
    reports: Report[];
    viewerData: { documents?: ViewerDesignRequest[] } | undefined;
    selectedFile: string;
    onWriteReport: (data: InitialDesignData) => void;
};

/**
 * 企画課ビューワーから取得した重要デザイン（ＳＰ（ロール印刷）／フルオーダー）で、
 * 日報への登録がまだされていない案件をホーム画面で検知し、ワンクリックで作成を促すコンポーネント
 */
export default function UnfilledImportantDesigns({
    reports,
    viewerData,
    selectedFile,
    onWriteReport,
}: UnfilledImportantDesignsProps): React.JSX.Element | null {
    // 未記入の重要デザインを抽出
    const unfilledDesigns = useMemo((): ViewerDesignRequest[] => {
        if (!viewerData || !viewerData.documents || !selectedFile) return [];

        // 既存の日報に登録されているデザイン依頼No.のSetを作成 (比較高速化のため)
        const filledDesignNos = new Set<string>();
        reports.forEach((r: Report): void => {
            const designNo = r['デザイン依頼No.'];
            if (designNo && designNo !== '-') {
                filledDesignNos.add(String(designNo).trim());
            }
        });

        // shortId (デザイン依頼No.) ごとに1件にまとめるためのMap
        const uniqueMap = new Map<string, ViewerDesignRequest>();

        viewerData.documents.forEach((doc: ViewerDesignRequest): void => {
            if (!doc.salesPerson || !doc.requestId) return;

            // 1. 担当営業の一致チェック (同姓の別人混在を完全に防止)
            if (!isSalesPersonMatch(doc.salesPerson, selectedFile)) return;

            // 2. 重要種別のチェック (SPロール印刷は頭が「新版」のもののみ、フルオーダーはすべて)
            const type = doc.designType || '';
            const isSP = type.includes('ＳＰ（ロール印刷）') || type.includes('SP（ロール印刷）') || type.includes('ロール印刷');
            const isFullOrder = type.includes('フルオーダー') || type.includes('フルオータ');

            if (isSP) {
                // SP（ロール印刷）はタイトル（デザイン名）の頭が「新版」のもののみ対象
                const content = (doc.designContent || '').trim();
                const isNewEdition = /^(新版|[【\[（\(]新版)/.test(content);
                if (!isNewEdition) return;
            } else if (!isFullOrder) {
                return;
            }

            // 3. 日報に一度も登録されていないか
            const shortId = doc.requestId.split('-')[0].trim();
            if (filledDesignNos.has(shortId)) return;

            // 同じデザイン依頼No.が複数ある場合は最新日付のものを1つに統合
            if (uniqueMap.has(shortId)) {
                const existing = uniqueMap.get(shortId)!;
                const dateExisting = existing.deliveryDate || existing.requestedAt || '';
                const dateCurrent = doc.deliveryDate || doc.requestedAt || '';
                if (dateCurrent > dateExisting) {
                    uniqueMap.set(shortId, doc);
                }
            } else {
                uniqueMap.set(shortId, doc);
            }
        });

        return Array.from(uniqueMap.values());
    }, [reports, viewerData, selectedFile]);

    // 未入力案件がなければ何も表示しない
    if (unfilledDesigns.length === 0) return null;

    return (
        <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-4 shadow-sm animate-fadeIn space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <div className="flex items-center gap-2 text-amber-800 font-bold text-sm">
                    <AlertTriangle className="text-amber-600 shrink-0 animate-pulse" size={18} />
                    <span>未入力の重要デザイン依頼があります ({unfilledDesigns.length}件)</span>
                </div>
                <span className="text-[10px] text-gray-500">
                    ※「ＳＰ（ロール印刷・新版）」「フルオーダー」は日報への起票が必要です。
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto pr-1">
                {unfilledDesigns.map((doc: ViewerDesignRequest): React.JSX.Element => {
                    const shortId = doc.requestId.split('-')[0].trim();
                    return (
                        <div
                            key={doc.requestId}
                            className="bg-white rounded-lg border border-amber-200/60 p-3 flex justify-between items-center hover:shadow-md transition-shadow gap-4"
                        >
                            <div className="min-w-0 space-y-1.5 flex-1">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800">
                                        {doc.designType}
                                    </span>
                                    <span className="text-xs font-semibold text-sf-light-blue">
                                        No. {shortId}
                                    </span>
                                </div>
                                <h5 className="text-xs font-bold text-sf-text truncate" title={doc.customer}>
                                    {doc.customer}
                                </h5>
                                <p className="text-[11px] text-sf-text-weak truncate" title={doc.designContent}>
                                    {doc.designContent}
                                </p>
                                <div className="flex items-center gap-3 text-[10px] text-gray-400">
                                    {doc.deliveryDate && (
                                        <span className="shrink-0">納期: {doc.deliveryDate}</span>
                                    )}
                                    {doc.planner && (
                                        <span className="truncate">企画: {doc.planner}</span>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={(): void => {
                                    const type = doc.designType || '';
                                    const isRoll = type.includes('ロール印刷') || type.includes('ＳＰ');
                                    onWriteReport({
                                        得意先CD: '', 
                                        得意先名: doc.customer,
                                        デザイン依頼No: shortId,
                                        デザイン名: doc.designContent,
                                        デザイン種別: isRoll ? 'SP（新版）' : 'その他',
                                        デザイン進捗状況: '新規',
                                        designMode: 'new',
                                    });
                                }}
                                className="flex items-center gap-1 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs shadow-sm transition-colors cursor-pointer shrink-0 focus:outline-none"
                            >
                                <PenSquare size={13} />
                                日報作成
                            </button>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
