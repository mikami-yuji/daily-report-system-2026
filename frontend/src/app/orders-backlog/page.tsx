'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import Link from 'next/link';
import {
    Truck,
    Search,
    Filter,
    Calendar,
    ArrowUpDown,
    Download,
    FileSpreadsheet,
    Clock,
    AlertTriangle,
    CheckCircle2,
    Layers,
    Eye,
    RefreshCw,
    Building2,
    Tag,
    ChevronDown,
    X,
    Sparkles,
    UserCheck,
    HelpCircle,
    ShoppingBag
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import {
    getBacklogOrders,
    BacklogOrder,
    BacklogSummary,
    searchDesignImages,
    getImageUrl,
    DesignImage
} from '@/lib/api';
import { useFile } from '@/context/FileContext';

export default function OrdersBacklogPage() {
    return (
        <Suspense fallback={
            <div className="p-6 flex items-center justify-center min-h-[400px]">
                <RefreshCw className="animate-spin text-blue-500" size={32} />
            </div>
        }>
            <OrdersBacklogContent />
        </Suspense>
    );
}

function OrdersBacklogContent() {
    const { selectedFile } = useFile();

    // 担当営業名（選択中の日報ファイルから抽出）
    const repName = useMemo(() => {
        if (!selectedFile) return '';
        const match = selectedFile.match(/【(.*?)】/);
        return match ? match[1] : '';
    }, [selectedFile]);

    const [loading, setLoading] = useState<boolean>(true);
    const [orders, setOrders] = useState<BacklogOrder[]>([]);
    const [summary, setSummary] = useState<BacklogSummary>({
        total_count: 0,
        confirmed_count: 0,
        asap_count: 0,
        provisional_count: 0,
        delayed_count: 0,
        total_amount: 0
    });
    const [repsList, setRepsList] = useState<string[]>([]);

    // フィルター状態
    const [selectedRep, setSelectedRep] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<string>('all'); // all, confirmed, asap, provisional, delayed
    const [selectedDirectDest, setSelectedDirectDest] = useState<string>('all');
    const [directDestSearchText, setDirectDestSearchText] = useState<string>('');
    const [showDestDropdown, setShowDestDropdown] = useState<boolean>(false);
    const [directDestsList, setDirectDestsList] = useState<string[]>([]);
    const [searchKeyword, setSearchKeyword] = useState<string>('');
    const [datePreset, setDatePreset] = useState<string>('all'); // all, today, this_week, this_month

    // 画像モーダル
    const [showImageModal, setShowImageModal] = useState<boolean>(false);
    const [selectedOrderForImage, setSelectedOrderForImage] = useState<BacklogOrder | null>(null);
    const [imageVariants, setImageVariants] = useState<DesignImage[]>([]);
    const [activeImageIdx, setActiveImageIdx] = useState<number>(0);
    const [loadingImage, setLoadingImage] = useState<boolean>(false);

    // 担当営業の初期値設定
    useEffect(() => {
        if (repName && selectedRep === 'all') {
            setSelectedRep(repName);
        }
    }, [repName]);

    // 直送先テキスト入力のデバウンス反映
    useEffect(() => {
        const timer = setTimeout(() => {
            if (directDestSearchText.trim()) {
                setSelectedDirectDest(directDestSearchText.trim());
            } else {
                setSelectedDirectDest('all');
            }
        }, 300);
        return () => clearTimeout(timer);
    }, [directDestSearchText]);

    // データ読み込み
    const fetchBacklogData = async () => {
        setLoading(true);
        try {
            const today = new Date();
            let start_date: string | undefined;
            let end_date: string | undefined;

            if (datePreset === 'today') {
                start_date = today.toISOString().slice(0, 10);
                end_date = start_date;
            } else if (datePreset === 'this_week') {
                const dayOfWeek = today.getDay();
                const start = new Date(today);
                start.setDate(today.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
                const end = new Date(start);
                end.setDate(start.getDate() + 6);
                start_date = start.toISOString().slice(0, 10);
                end_date = end.toISOString().slice(0, 10);
            } else if (datePreset === 'this_month') {
                const year = today.getFullYear();
                const month = today.getMonth() + 1;
                start_date = `${year}-${String(month).padStart(2, '0')}-01`;
                const lastDay = new Date(year, month, 0).getDate();
                end_date = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            }

            const res = await getBacklogOrders({
                sales_rep: selectedRep !== 'all' ? selectedRep : undefined,
                direct_dest: selectedDirectDest !== 'all' ? selectedDirectDest : undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                keyword: searchKeyword ? searchKeyword : undefined,
                start_date,
                end_date,
                limit: 500
            });

            setOrders(res.orders || []);
            setSummary(res.summary || {
                total_count: 0,
                confirmed_count: 0,
                asap_count: 0,
                provisional_count: 0,
                delayed_count: 0,
                total_amount: 0
            });
            if (res.reps && res.reps.length > 0) {
                setRepsList(res.reps);
            }
            if (res.direct_dests) {
                setDirectDestsList(res.direct_dests);
            }
        } catch (error) {
            console.error('Failed to load backlog orders:', error);
            toast.error('受注残データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBacklogData();
    }, [selectedRep, selectedDirectDest, statusFilter, datePreset]);

    // キーワード検索デバウンス
    useEffect(() => {
        const timer = setTimeout(() => {
            fetchBacklogData();
        }, 300);
        return () => clearTimeout(timer);
    }, [searchKeyword]);

    // 画像検索ハンドラー
    const handleOpenImage = async (order: BacklogOrder, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedOrderForImage(order);
        setShowImageModal(true);
        setLoadingImage(true);
        setImageVariants([]);
        setActiveImageIdx(0);

        try {
            const query = order.order_no ? String(order.order_no) : order.product_code;
            const res = await searchDesignImages(query, selectedFile || undefined);
            if (res.images && res.images.length > 0) {
                setImageVariants(res.images);
            } else if (order.product_code) {
                const res2 = await searchDesignImages(order.product_code, selectedFile || undefined);
                setImageVariants(res2.images || []);
            }
        } catch (err) {
            console.error('Image search failed:', err);
        } finally {
            setLoadingImage(false);
        }
    };

    // Excel出力 (.xlsx)
    const exportBacklogToExcel = async () => {
        if (orders.length === 0) {
            toast.error('エクスポート対象の受注残データがありません');
            return;
        }

        try {
            const today = new Date();
            const dateStr = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月${String(today.getDate()).padStart(2, '0')}日`;
            const fileDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
            const repLabel = selectedRep !== 'all' ? selectedRep : '全社';

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ASAHIPACK Daily Report System';
            workbook.lastModifiedBy = repName || '営業部';
            workbook.created = today;

            const ws = workbook.addWorksheet('受注残・納期管理', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
            });

            // 列定義
            ws.columns = [
                { header: 'No.', key: 'no', width: 6 },
                { header: 'ステータス', key: 'status', width: 14 },
                { header: '納期日', key: 'delivery_date', width: 13 },
                { header: '入荷予定', key: 'arrival_date', width: 12 },
                { header: '受注№', key: 'order_no', width: 14 },
                { header: '受注日', key: 'order_date', width: 12 },
                { header: '得意先名', key: 'customer', width: 32 },
                { header: '直送先名', key: 'direct', width: 28 },
                { header: '商品コード', key: 'code', width: 13 },
                { header: '品名', key: 'name', width: 36 },
                { header: '銘柄', key: 'brand', width: 18 },
                { header: '材質', key: 'material', width: 16 },
                { header: '色数', key: 'colors', width: 14 },
                { header: '量目', key: 'capacity', width: 11 },
                { header: '形状', key: 'shape', width: 10 },
                { header: '単位', key: 'unit', width: 7 },
                { header: '受注数量', key: 'order_qty', width: 13 },
                { header: '引当数量', key: 'alloc_qty', width: 13 },
                { header: '実効単価', key: 'unit_price', width: 13 },
                { header: '受注金額', key: 'amount', width: 15 },
                { header: '出荷備考・運送指示', key: 'shipping_note', width: 42 },
                { header: '担当営業', key: 'rep', width: 12 }
            ];

            // 1行目: タイトル
            ws.mergeCells('A1:V1');
            const titleCell = ws.getCell('A1');
            titleCell.value = `【${repLabel}】 受注残・納期管理一覧（材質・色数・量目明細付き）`;
            titleCell.font = { name: 'Meiryo', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E3A8A' }
            };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(1).height = 36;

            // 2行目: メタデータサマリー
            ws.mergeCells('A2:V2');
            const metaCell = ws.getCell('A2');
            metaCell.value = `出力日: ${dateStr}  |  対象件数: ${orders.length}件  |  受注残合計: ¥${Math.round(summary.total_amount).toLocaleString()}  |  確定: ${summary.confirmed_count}件 / 早出: ${summary.asap_count}件 / 仮納期: ${summary.provisional_count}件 / 超過: ${summary.delayed_count}件`;
            metaCell.font = { name: 'Meiryo', size: 10, color: { argb: 'FF334155' } };
            metaCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFF1F5F9' }
            };
            metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(2).height = 22;

            // 3行目: 空行
            ws.getRow(3).height = 8;

            // 4行目: ヘッダー
            const headerRow = ws.getRow(4);
            headerRow.values = [
                'No.',
                'ステータス',
                '納期日',
                '入荷予定',
                '受注№',
                '受注日',
                '得意先名',
                '直送先名',
                '商品コード',
                '品名',
                '銘柄',
                '材質',
                '色数',
                '量目',
                '形状',
                '単位',
                '受注数量',
                '引当数量',
                '実効単価',
                '受注金額',
                '出荷備考・運送指示',
                '担当営業'
            ];
            headerRow.height = 28;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF2563EB' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    bottom: { style: 'medium', color: { argb: 'FF1E293B' } },
                    left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                    right: { style: 'thin', color: { argb: 'FF94A3B8' } }
                };
            });

            const thinBorder: Partial<ExcelJS.Borders> = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            orders.forEach((o, idx) => {
                const rowIdx = 5 + idx;
                const row = ws.getRow(rowIdx);
                const isEven = idx % 2 === 1;
                const baseBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

                const formatD = (dStr?: string | null) => dStr ? dStr.replace(/-/g, '/') : '';

                row.values = [
                    idx + 1,
                    o.delivery_status_label,
                    formatD(o.delivery_date),
                    formatD(o.arrival_date),
                    o.order_no_display,
                    formatD(o.order_date),
                    o.customer_name,
                    o.direct_customer_name || '',
                    o.product_code,
                    o.product_name,
                    o.brand_name || '',
                    o.material_name || o.material_short || '',
                    o.color_display || '',
                    o.capacity_display || '',
                    o.shape_type || '',
                    o.unit || '枚',
                    o.order_quantity || 0,
                    o.allocated_quantity || 0,
                    o.unit_price || 0,
                    o.amount || 0,
                    o.shipping_note || '',
                    o.sales_rep
                ];

                row.height = 24;
                row.font = { name: 'Meiryo', size: 9.5 };

                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = thinBorder;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: baseBg }
                    };

                    if ([1, 3, 4, 5, 6, 9, 13, 14, 15, 16, 22].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if ([7, 8, 10, 11, 12, 21].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                    } else if (colNumber === 2) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        if (o.delivery_status === 'delayed') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                            cell.font = { name: 'Meiryo', size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
                        } else if (o.delivery_status === 'confirmed') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDCFCE7' } };
                            cell.font = { name: 'Meiryo', size: 9.5, bold: true, color: { argb: 'FF166534' } };
                        } else if (o.delivery_status === 'asap') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                            cell.font = { name: 'Meiryo', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
                        } else if (o.delivery_status === 'provisional') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };
                            cell.font = { name: 'Meiryo', size: 9.5, color: { argb: 'FF6B21A8' } };
                        }
                    } else if (colNumber === 17 || colNumber === 18) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '#,##0';
                    } else if (colNumber === 19) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;"-"';
                    } else if (colNumber === 20) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0;[Red]-¥#,##0;"-"';
                        cell.font = { name: 'Meiryo', size: 9.5, bold: true };
                    }
                });
            });

            // 合計行
            const totalRowIdx = 5 + orders.length;
            const totalRow = ws.getRow(totalRowIdx);
            ws.mergeCells(`A${totalRowIdx}:S${totalRowIdx}`);
            const totalLabel = ws.getCell(`A${totalRowIdx}`);
            totalLabel.value = '合計受注残金額';
            totalLabel.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FF1E293B' } };
            totalLabel.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
            totalLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
            totalLabel.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'double', color: { argb: 'FF1E293B' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };

            const totalVal = ws.getCell(`T${totalRowIdx}`);
            totalVal.value = { formula: `SUM(T5:T${totalRowIdx - 1})`, result: summary.total_amount };
            totalVal.font = { name: 'Meiryo', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
            totalVal.numFmt = '¥#,##0;[Red]-¥#,##0;"-"';
            totalVal.alignment = { vertical: 'middle', horizontal: 'right' };
            totalVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFF6FF' } };
            totalVal.border = {
                top: { style: 'thin', color: { argb: 'FF94A3B8' } },
                bottom: { style: 'double', color: { argb: 'FF1E293B' } },
                left: { style: 'thin', color: { argb: 'FF94A3B8' } },
                right: { style: 'thin', color: { argb: 'FF94A3B8' } }
            };

            totalRow.height = 28;

            ws.autoFilter = {
                from: { row: 4, column: 1 },
                to: { row: 4 + orders.length, column: 22 }
            };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `${repLabel}_受注残・納期一覧_${fileDateStr}.xlsx`);
            toast.success(`「${repLabel}」の受注残Excelを出力しました`);
        } catch (err) {
            console.error('Backlog Excel export error:', err);
            toast.error('Excelファイルの出力に失敗しました');
        }
    };

    return (
        <div className="p-4 sm:p-6 max-w-[1600px] mx-auto space-y-5">
            {/* Header Title */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-sf-border shadow-sm">
                <div>
                    <div className="flex items-center gap-2.5">
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-xl border border-blue-100 shadow-sm">
                            <Truck size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl sm:text-2xl font-black text-sf-text tracking-tight flex items-center gap-2">
                                <span>受注残・納期管理</span>
                                <span className="text-xs px-2.5 py-0.5 bg-blue-100 text-blue-800 font-semibold rounded-full font-mono">
                                    AS/400 基幹同期
                                </span>
                            </h1>
                            <p className="text-xs text-sf-text-weak mt-0.5">
                                現在進行中の全社受注残・指定納期・入荷予定・運送便指示をリアルタイムに一元管理
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Excel Export Button */}
                    <button
                        onClick={exportBacklogToExcel}
                        className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-2 shadow-sm transition-all"
                        title="現在の絞り込み条件でExcel帳票（.xlsx）を出力します"
                    >
                        <FileSpreadsheet size={16} />
                        <span>Excel出力 (.xlsx)</span>
                    </button>

                    {/* Refresh Button */}
                    <button
                        onClick={fetchBacklogData}
                        className="p-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl transition-colors border border-gray-200"
                        title="最新データに再読み込み"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin text-blue-600' : ''} />
                    </button>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {/* 1. All Backlog */}
                <button
                    onClick={() => setStatusFilter('all')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                        statusFilter === 'all'
                            ? 'bg-blue-50/70 border-blue-400 ring-2 ring-blue-400/20 shadow-sm'
                            : 'bg-white border-sf-border hover:border-gray-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-500 mb-1.5">
                        <span className="text-xs font-semibold">受注残 総計</span>
                        <Layers size={16} className="text-blue-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-sf-text font-mono">
                        {summary.total_count.toLocaleString()}
                        <span className="text-xs font-normal text-gray-500 ml-1">件</span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-1 font-mono truncate">
                        ¥{Math.round(summary.total_amount).toLocaleString()}
                    </div>
                </button>

                {/* 2. Confirmed */}
                <button
                    onClick={() => setStatusFilter('confirmed')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                        statusFilter === 'confirmed'
                            ? 'bg-emerald-50/70 border-emerald-400 ring-2 ring-emerald-400/20 shadow-sm'
                            : 'bg-white border-sf-border hover:border-gray-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-500 mb-1.5">
                        <span className="text-xs font-semibold text-emerald-700">🟢 確定納期</span>
                        <CheckCircle2 size={16} className="text-emerald-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-emerald-800 font-mono">
                        {summary.confirmed_count.toLocaleString()}
                        <span className="text-xs font-normal text-gray-500 ml-1">件</span>
                    </div>
                    <div className="text-[11px] text-emerald-600 mt-1 font-medium">
                        着日・運送便確定
                    </div>
                </button>

                {/* 3. ASAP */}
                <button
                    onClick={() => setStatusFilter('asap')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                        statusFilter === 'asap'
                            ? 'bg-amber-50/70 border-amber-400 ring-2 ring-amber-400/20 shadow-sm'
                            : 'bg-white border-sf-border hover:border-gray-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-500 mb-1.5">
                        <span className="text-xs font-semibold text-amber-700">🟡 早出可・仕上次第</span>
                        <Clock size={16} className="text-amber-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-amber-800 font-mono">
                        {summary.asap_count.toLocaleString()}
                        <span className="text-xs font-normal text-gray-500 ml-1">件</span>
                    </div>
                    <div className="text-[11px] text-amber-600 mt-1 font-medium">
                        出来次第出荷OK
                    </div>
                </button>

                {/* 4. Provisional */}
                <button
                    onClick={() => setStatusFilter('provisional')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                        statusFilter === 'provisional'
                            ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-400/20 shadow-sm'
                            : 'bg-white border-sf-border hover:border-gray-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-500 mb-1.5">
                        <span className="text-xs font-semibold text-purple-700">🟣 仮納期・預かり</span>
                        <HelpCircle size={16} className="text-purple-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-purple-800 font-mono">
                        {summary.provisional_count.toLocaleString()}
                        <span className="text-xs font-normal text-gray-500 ml-1">件</span>
                    </div>
                    <div className="text-[11px] text-purple-600 mt-1 font-medium">
                        2030年・出荷指示待ち
                    </div>
                </button>

                {/* 5. Delayed */}
                <button
                    onClick={() => setStatusFilter('delayed')}
                    className={`p-4 rounded-xl border text-left transition-all ${
                        statusFilter === 'delayed'
                            ? 'bg-rose-50/70 border-rose-400 ring-2 ring-rose-400/20 shadow-sm'
                            : 'bg-white border-sf-border hover:border-gray-300'
                    }`}
                >
                    <div className="flex items-center justify-between text-gray-500 mb-1.5">
                        <span className="text-xs font-semibold text-rose-700">🔴 納期超過</span>
                        <AlertTriangle size={16} className="text-rose-500" />
                    </div>
                    <div className="text-xl sm:text-2xl font-black text-rose-800 font-mono">
                        {summary.delayed_count.toLocaleString()}
                        <span className="text-xs font-normal text-gray-500 ml-1">件</span>
                    </div>
                    <div className="text-[11px] text-rose-600 mt-1 font-medium">
                        要確認・過去指定
                    </div>
                </button>
            </div>

            {/* Filters Bar */}
            <div className="bg-white p-4 rounded-2xl border border-sf-border shadow-sm space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    {/* Rep Selector */}
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-gray-500 flex items-center gap-1">
                            <UserCheck size={14} className="text-blue-600" />
                            担当営業:
                        </span>
                        {repName && (
                            <button
                                onClick={() => setSelectedRep(repName)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                                    selectedRep === repName
                                        ? 'bg-blue-600 text-white shadow-sm'
                                        : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                                }`}
                            >
                                <span>★ {repName} (マイ担当)</span>
                            </button>
                        )}
                        <button
                            onClick={() => setSelectedRep('all')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                selectedRep === 'all'
                                    ? 'bg-slate-800 text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                            }`}
                        >
                            全社 (全員)
                        </button>

                        {/* Other reps dropdown */}
                        <div className="relative">
                            <select
                                value={selectedRep}
                                onChange={(e) => setSelectedRep(e.target.value)}
                                className="appearance-none pl-3 pr-8 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-medium text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                            >
                                <option value="all">その他 担当者を選択...</option>
                                {repsList.map((r, i) => (
                                    <option key={i} value={r}>{r}</option>
                                ))}
                            </select>
                            <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>
                    </div>

                    {/* Date Presets */}
                    <div className="flex items-center gap-1.5 bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setDatePreset('all')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                datePreset === 'all' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            全期間
                        </button>
                        <button
                            onClick={() => setDatePreset('today')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                datePreset === 'today' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            本日
                        </button>
                        <button
                            onClick={() => setDatePreset('this_week')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                datePreset === 'this_week' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            今週
                        </button>
                        <button
                            onClick={() => setDatePreset('this_month')}
                            className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-all ${
                                datePreset === 'this_month' ? 'bg-white text-blue-600 shadow-sm font-bold' : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            今月
                        </button>
                    </div>
                </div>

                {/* Direct Dest and Keyword Search Row */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
                    {/* Direct Destination Search Box with Autocomplete */}
                    <div className="md:col-span-5 relative">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-gray-500 flex items-center gap-1 shrink-0">
                                <Building2 size={14} className="text-indigo-600" />
                                直送先検索:
                            </span>
                            <div className="relative flex-1">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    value={directDestSearchText}
                                    onChange={(e) => {
                                        setDirectDestSearchText(e.target.value);
                                        setShowDestDropdown(true);
                                    }}
                                    onFocus={() => setShowDestDropdown(true)}
                                    placeholder={directDestsList.length > 0 ? `直送先名で絞り込み (${directDestsList.length}件)...` : "直送先名で絞り込み..."}
                                    className={`w-full pl-8 pr-7 py-2 border rounded-xl text-xs font-medium transition-all ${
                                        directDestSearchText.trim()
                                            ? 'bg-indigo-50/90 border-indigo-300 text-indigo-950 font-bold ring-2 ring-indigo-500/20'
                                            : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100 focus:bg-white focus:border-indigo-500'
                                    }`}
                                />
                                {directDestSearchText ? (
                                    <button
                                        onClick={() => {
                                            setDirectDestSearchText('');
                                            setSelectedDirectDest('all');
                                            setShowDestDropdown(false);
                                        }}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                        title="クリア"
                                    >
                                        <X size={13} />
                                    </button>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => setShowDestDropdown(!showDestDropdown)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-0.5"
                                    >
                                        <ChevronDown size={13} />
                                    </button>
                                )}

                                {/* Suggestions Dropdown */}
                                {showDestDropdown && (
                                    <>
                                        <div
                                            className="fixed inset-0 z-20"
                                            onClick={() => setShowDestDropdown(false)}
                                        />
                                        <div className="absolute left-0 right-0 top-full mt-1 bg-white rounded-xl border border-gray-200 shadow-xl z-30 max-h-60 overflow-y-auto divide-y divide-gray-50">
                                            <div
                                                onClick={() => {
                                                    setDirectDestSearchText('');
                                                    setSelectedDirectDest('all');
                                                    setShowDestDropdown(false);
                                                }}
                                                className="px-3 py-2 text-xs font-semibold text-gray-600 hover:bg-indigo-50 cursor-pointer flex items-center justify-between"
                                            >
                                                <span>すべての直送先（全納品先）</span>
                                                <span className="text-[10px] text-gray-400">{directDestsList.length}件</span>
                                            </div>
                                            {directDestsList
                                                .filter(d => !directDestSearchText.trim() || d.toLowerCase().includes(directDestSearchText.toLowerCase()))
                                                .slice(0, 30)
                                                .map((d, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={() => {
                                                            setDirectDestSearchText(d);
                                                            setSelectedDirectDest(d);
                                                            setShowDestDropdown(false);
                                                        }}
                                                        className="px-3 py-2 text-xs text-gray-800 hover:bg-indigo-50 hover:text-indigo-900 cursor-pointer flex items-center justify-between transition-colors"
                                                    >
                                                        <span className="font-medium truncate">{d}</span>
                                                    </div>
                                                ))}
                                        </div>
                                    </>
                                )}
                            </div>
                            {directDestSearchText && (
                                <button
                                    onClick={() => {
                                        setDirectDestSearchText('');
                                        setSelectedDirectDest('all');
                                        setShowDestDropdown(false);
                                    }}
                                    className="p-1.5 text-xs text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg flex items-center gap-0.5 shrink-0"
                                    title="直送先フィルターを解除"
                                >
                                    <X size={13} />
                                    <span>解除</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="md:col-span-7 relative">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={searchKeyword}
                            onChange={(e) => setSearchKeyword(e.target.value)}
                            placeholder="商品名、銘柄、得意先名、受注No（例: 1276358）、運送便（ヤマト、福通...）等..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs text-sf-text placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                        />
                        {searchKeyword && (
                            <button
                                onClick={() => setSearchKeyword('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={14} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Main Orders Table */}
            {loading ? (
                <div className="py-24 text-center text-gray-400 bg-white rounded-2xl border border-sf-border shadow-sm">
                    <RefreshCw className="animate-spin mx-auto mb-3 text-blue-500" size={32} />
                    <p className="font-semibold text-sm">受注残データを取得しています...</p>
                </div>
            ) : orders.length === 0 ? (
                <div className="py-24 text-center text-gray-400 bg-white rounded-2xl border border-sf-border shadow-sm">
                    <Truck className="mx-auto mb-3 text-gray-300" size={48} />
                    <p className="font-bold text-base text-gray-600">該当する受注残データが見つかりませんでした</p>
                    <p className="text-xs text-gray-400 mt-1">検索条件または担当営業のフィルターを変更してください</p>
                </div>
            ) : (
                <div className="bg-white rounded-2xl border border-sf-border shadow-sm overflow-hidden">
                    <div className="p-3.5 bg-slate-50 border-b border-gray-200 flex justify-between items-center text-xs font-semibold text-gray-600">
                        <span className="flex items-center gap-1.5">
                            <span>表示件数:</span>
                            <strong className="text-blue-600 font-mono">{orders.length}</strong> 件
                        </span>
                        <span className="text-gray-400 text-[11px]">
                            ※ 表ヘッダーで整列・画像アイコンで絵柄プレビュー
                        </span>
                    </div>

                    <div className="overflow-x-auto max-h-[720px]">
                        <table className="w-full text-left text-xs border-collapse">
                            <thead className="bg-gray-100 text-sf-text-weak sticky top-0 z-10 border-b border-sf-border shadow-sm">
                                <tr>
                                    <th className="py-3 px-2.5 font-bold text-center w-12">画像</th>
                                    <th className="py-3 px-3 font-bold text-center">ステータス</th>
                                    <th className="py-3 px-3 font-bold">納期日 (指定日)</th>
                                    <th className="py-3 px-3 font-bold">入荷予定</th>
                                    <th className="py-3 px-3 font-bold">受注№</th>
                                    <th className="py-3 px-3 font-bold">受注日</th>
                                    <th className="py-3 px-3 font-bold">得意先名称 / 直送先</th>
                                    <th className="py-3 px-3 font-bold">商品名称 / 銘柄</th>
                                    <th className="py-3 px-3 font-bold">材質</th>
                                    <th className="py-3 px-3 font-bold">色数</th>
                                    <th className="py-3 px-3 font-bold">量目</th>
                                    <th className="py-3 px-2.5 font-bold text-center">形状</th>
                                    <th className="py-3 px-3 font-bold text-right">受注数</th>
                                    <th className="py-3 px-3 font-bold text-right">実効単価</th>
                                    <th className="py-3 px-3 font-bold text-right">受注金額</th>
                                    <th className="py-3 px-3 font-bold">出荷備考 (運送便・着日指示)</th>
                                    <th className="py-3 px-3 font-bold text-center">担当</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.map((o, idx) => {
                                    const formatD = (dStr?: string | null) => dStr ? dStr.replace(/-/g, '/') : '-';
                                    return (
                                        <tr key={idx} className="hover:bg-blue-50/40 transition-colors group">
                                            {/* Image Action */}
                                            <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                                <button
                                                    onClick={(e) => handleOpenImage(o, e)}
                                                    className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 border border-transparent hover:border-blue-200 transition-all"
                                                    title="商品画像・意匠をプレビュー"
                                                >
                                                    <Eye size={15} />
                                                </button>
                                            </td>

                                            {/* Status Badge */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                {o.delivery_status === 'delayed' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded-md text-[11px] border border-rose-200">
                                                        <AlertTriangle size={11} />
                                                        納期超過
                                                    </span>
                                                )}
                                                {o.delivery_status === 'confirmed' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 font-bold rounded-md text-[11px] border border-emerald-200">
                                                        <CheckCircle2 size={11} />
                                                        確定納期
                                                    </span>
                                                )}
                                                {o.delivery_status === 'asap' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded-md text-[11px] border border-amber-200">
                                                        <Clock size={11} />
                                                        早出可
                                                    </span>
                                                )}
                                                {o.delivery_status === 'provisional' && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-purple-100 text-purple-800 font-medium rounded-md text-[11px] border border-purple-200">
                                                        <HelpCircle size={11} />
                                                        仮・預かり
                                                    </span>
                                                )}
                                            </td>

                                            {/* Delivery Date */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-gray-900">
                                                {formatD(o.delivery_date)}
                                            </td>

                                            {/* Arrival Date */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-gray-500">
                                                {formatD(o.arrival_date)}
                                            </td>

                                            {/* Order No */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono font-bold text-blue-700">
                                                {o.order_no_display}
                                            </td>

                                            {/* Order Date */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-gray-500">
                                                {formatD(o.order_date)}
                                            </td>

                                            {/* Customer & Direct */}
                                            <td className="py-2.5 px-3 max-w-[240px]">
                                                <div className="font-bold text-gray-900 truncate">
                                                    {o.customer_name}
                                                </div>
                                                {o.direct_customer_name && (
                                                    <div className="text-[11px] text-gray-500 flex items-center gap-1 truncate mt-0.5">
                                                        <span className="px-1 py-0.2 bg-gray-100 text-gray-600 rounded text-[9px] font-semibold flex-shrink-0">
                                                             直送
                                                        </span>
                                                        <span className="truncate">{o.direct_customer_name}</span>
                                                    </div>
                                                )}
                                            </td>

                                            {/* Product Name & Brand */}
                                            <td className="py-2.5 px-3 max-w-[280px]">
                                                <div className="font-bold text-sf-text group-hover:text-blue-600 transition-colors line-clamp-2 leading-snug">
                                                    {o.product_name}
                                                </div>
                                                <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-400 font-mono truncate">
                                                    <span>CD: {o.product_code}</span>
                                                    {o.brand_name && (
                                                        <>
                                                            <span>•</span>
                                                            <span className="text-blue-600 font-sans truncate">{o.brand_name}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </td>

                                            {/* Material */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className="text-gray-700 font-medium">
                                                    {o.material_name || o.material_short || '-'}
                                                </span>
                                            </td>

                                            {/* Colors */}
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <span className="text-indigo-700 font-medium">
                                                    {o.color_display || '-'}
                                                </span>
                                            </td>

                                            {/* Capacity */}
                                            <td className="py-2.5 px-3 whitespace-nowrap font-mono text-amber-800 font-semibold">
                                                {o.capacity_display || '-'}
                                            </td>

                                            {/* Shape */}
                                            <td className="py-2.5 px-2.5 text-center whitespace-nowrap">
                                                <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                                    o.shape_type?.includes('ロール')
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}>
                                                    {o.shape_type || (o.unit === 'ｍ' ? 'ロール' : '単袋')}
                                                </span>
                                            </td>

                                            {/* Quantity */}
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-gray-900">
                                                {o.order_quantity.toLocaleString()}
                                                <span className="text-[11px] font-normal text-gray-500 ml-1">{o.unit}</span>
                                            </td>

                                            {/* Unit Price */}
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono text-gray-600">
                                                {o.unit_price.toLocaleString()}
                                                <span className="text-[11px] text-gray-400 ml-0.5">円</span>
                                            </td>

                                            {/* Total Amount */}
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono font-bold text-sf-text">
                                                {Math.round(o.amount).toLocaleString()}
                                                <span className="text-[11px] font-normal text-gray-500 ml-1">円</span>
                                            </td>

                                            {/* Shipping Note (Highlighted) */}
                                            <td className="py-2.5 px-3 max-w-[300px]">
                                                {o.shipping_note ? (
                                                    <div className="text-[11px] text-gray-700 bg-amber-50/60 p-1.5 rounded border border-amber-200/60 line-clamp-2">
                                                        {o.shipping_note}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>

                                            {/* Sales Rep */}
                                            <td className="py-2.5 px-3 text-center whitespace-nowrap font-medium text-gray-700">
                                                {o.sales_rep || '-'}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Design Image Modal */}
            {showImageModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
                        <div className="p-4 px-6 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
                            <div className="flex items-center gap-2.5 truncate">
                                <Eye size={20} className="text-blue-400 flex-shrink-0" />
                                <div className="truncate">
                                    <h3 className="font-bold text-sm truncate">{selectedOrderForImage?.product_name}</h3>
                                    <p className="text-[11px] text-gray-400 font-mono">
                                        受注No: {selectedOrderForImage?.order_no_display || '-'} | CD: {selectedOrderForImage?.product_code}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setShowImageModal(false)}
                                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-white/10 transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col items-center justify-center min-h-[350px]">
                            {loadingImage ? (
                                <div className="text-center text-gray-400">
                                    <RefreshCw size={28} className="animate-spin mx-auto mb-2 text-blue-500" />
                                    <p className="text-xs">\\Asahipack01\\画像 から絵柄を照合中...</p>
                                </div>
                            ) : imageVariants.length === 0 ? (
                                <div className="text-center text-gray-400 py-10">
                                    <ShoppingBag size={48} className="mx-auto mb-2 text-gray-300" />
                                    <p className="text-sm font-semibold text-gray-600">画像が見つかりませんでした</p>
                                    <p className="text-xs text-gray-400 mt-1">サーバー共有フォルダに該当コードの画像が登録されていない可能性があります</p>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col items-center space-y-4">
                                    <div className="relative max-h-[480px] max-w-full flex items-center justify-center rounded-xl bg-white p-2 border border-gray-200 shadow-sm overflow-hidden">
                                        <img
                                            src={getImageUrl(imageVariants[activeImageIdx]?.path)}
                                            alt="商品プレビュー"
                                            className="max-h-[440px] max-w-full object-contain rounded-lg shadow-sm"
                                        />
                                    </div>

                                    {/* Variant Thumbnails */}
                                    {imageVariants.length > 1 && (
                                        <div className="flex items-center gap-2 overflow-x-auto p-1 max-w-full">
                                            {imageVariants.map((v, vIdx) => (
                                                <button
                                                    key={vIdx}
                                                    onClick={() => setActiveImageIdx(vIdx)}
                                                    className={`relative rounded-lg overflow-hidden border-2 transition-all flex-shrink-0 w-16 h-16 bg-white ${
                                                        activeImageIdx === vIdx ? 'border-blue-500 shadow-md scale-105' : 'border-gray-200 opacity-70 hover:opacity-100'
                                                    }`}
                                                >
                                                    <img
                                                        src={getImageUrl(v.path)}
                                                        alt={v.name}
                                                        className="w-full h-full object-contain p-0.5"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="p-3.5 px-6 border-t border-gray-100 bg-white flex justify-between items-center text-xs">
                            <span className="text-gray-500 font-mono">
                                得意先: {selectedOrderForImage?.customer_name}
                            </span>
                            <button
                                onClick={() => setShowImageModal(false)}
                                className="px-4 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg transition-colors"
                            >
                                閉じる
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
