'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    ShinbanAnalysisResponse,
    ShinbanDetailOrder,
    getShinbanAnalysis
} from '@/lib/api';
import {
    Sparkles,
    RotateCcw,
    Download,
    ChevronDown,
    ChevronRight,
    TrendingUp,
    Layers,
    User,
    Calendar,
    ArrowUpDown,
    CheckCircle2,
    Search,
    BarChart3,
    ChevronUp,
    Trophy,
    Zap,
    ArrowDownUp
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function ShinbanRepeatAnalysis(): React.JSX.Element {
    // 指標切り替え: 'meters' (ｍベース) | 'amount' (金額ベース)
    const [metric, setMetric] = useState<'meters' | 'amount'>('meters');

    // 区分フィルター: 'all' | 'roll' (3Fロール印刷) | 'custom' (別注)
    const [categoryFilter, setCategoryFilter] = useState<'all' | 'roll' | 'custom'>('all');

    // 担当営業フィルター
    const [selectedRep, setSelectedRep] = useState<string>('all');

    // 詳細明細の検索フィルター
    const [detailSearch, setDetailSearch] = useState<string>('');

    // 担当営業別の表示モード: 'ranking' (通期サマリー＆明細) | 'monthly' (担当別月別推移マトリクス)
    const [repViewMode, setRepViewMode] = useState<'ranking' | 'monthly'>('ranking');

    // 月別マトリクスのサブ指標: 'total' (総合計) | 'shinban' (新版のみ) | 'repeat' (リピートのみ)
    const [matrixSubMetric, setMatrixSubMetric] = useState<'total' | 'shinban' | 'repeat'>('total');

    // アコーディオン展開状態（営業担当者名または新版オーダーNo）
    const [expandedRep, setExpandedRep] = useState<string | null>(null);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

    // データ取得
    const [data, setData] = useState<ShinbanAnalysisResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await getShinbanAnalysis({
                category: categoryFilter,
                sales_rep: selectedRep !== 'all' ? selectedRep : undefined
            });
            setData(res);
        } catch {
            toast.error('新版・リピート受注データの取得に失敗しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [categoryFilter, selectedRep]);

    // 対象月リストの算出
    const matrixMonths = useMemo(() => {
        if (data?.sales_rep_matrix?.months && data.sales_rep_matrix.months.length > 0) {
            return data.sales_rep_matrix.months;
        }
        return ['2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09'];
    }, [data]);

    // 月ラベル整形
    const formatMonthLabel = (m: string): string => {
        const parts = m.split('-');
        if (parts.length >= 2) {
            return `${parseInt(parts[1], 10)}月`;
        }
        return m;
    };

    // ソート管理（営業担当別テーブル）
    const [sortField, setSortField] = useState<'total' | 'shinban' | 'repeat' | 'rate' | 'name'>('total');
    const [sortAsc, setSortAsc] = useState<boolean>(false);

    // アコーディオン内・新版明細のソート管理
    const [orderSortField, setOrderSortField] = useState<'date' | 'customer' | 'shinban' | 'repeat' | 'count'>('shinban');
    const [orderSortAsc, setOrderSortAsc] = useState<boolean>(false);

    // 月別 × 材質別マトリクスの表示順
    const [materialMonthOrder, setMaterialMonthOrder] = useState<'asc' | 'desc'>('asc');

    const sortedReps = useMemo(() => {
        if (!data?.sales_rep_ranking) return [];
        const list = [...data.sales_rep_ranking];
        return list.sort((a, b) => {
            if (sortField === 'name') {
                return sortAsc
                    ? a.sales_rep.localeCompare(b.sales_rep, 'ja')
                    : b.sales_rep.localeCompare(a.sales_rep, 'ja');
            }
            let valA = 0;
            let valB = 0;
            if (metric === 'meters') {
                if (sortField === 'total') { valA = a.total_meters; valB = b.total_meters; }
                else if (sortField === 'shinban') { valA = a.shinban_meters; valB = b.shinban_meters; }
                else if (sortField === 'repeat') { valA = a.repeat_meters; valB = b.repeat_meters; }
                else if (sortField === 'rate') { valA = a.repeat_rate_meters; valB = b.repeat_rate_meters; }
            } else {
                if (sortField === 'total') { valA = a.total_amount; valB = b.total_amount; }
                else if (sortField === 'shinban') { valA = a.shinban_amount; valB = b.shinban_amount; }
                else if (sortField === 'repeat') { valA = a.repeat_amount; valB = b.repeat_amount; }
                else if (sortField === 'rate') { valA = a.repeat_rate_amount; valB = b.repeat_rate_amount; }
            }
            return sortAsc ? valA - valB : valB - valA;
        });
    }, [data, metric, sortField, sortAsc]);

    // 担当営業別の新版明細（ソート適用）
    const ordersByRep = useMemo(() => {
        if (!data?.detail_orders) return {};
        const map: Record<string, ShinbanDetailOrder[]> = {};
        data.detail_orders.forEach(order => {
            const rep = order.sales_rep || '未設定';
            if (!map[rep]) map[rep] = [];
            map[rep].push(order);
        });

        // 各営業マンごとの明細をソート
        Object.keys(map).forEach(rep => {
            map[rep].sort((a, b) => {
                if (orderSortField === 'date') {
                    const cmp = (a.order_date || '').localeCompare(b.order_date || '');
                    return orderSortAsc ? cmp : -cmp;
                }
                if (orderSortField === 'customer') {
                    const cmp = (a.customer_name || '').localeCompare(b.customer_name || '', 'ja');
                    return orderSortAsc ? cmp : -cmp;
                }
                if (orderSortField === 'count') {
                    const diff = (a.repeat_count || 0) - (b.repeat_count || 0);
                    return orderSortAsc ? diff : -diff;
                }
                const valA = metric === 'meters'
                    ? (orderSortField === 'shinban' ? a.meters : a.repeat_meters)
                    : (orderSortField === 'shinban' ? a.amount : a.repeat_amount);
                const valB = metric === 'meters'
                    ? (orderSortField === 'shinban' ? b.meters : b.repeat_meters)
                    : (orderSortField === 'shinban' ? b.amount : b.repeat_amount);
                return orderSortAsc ? (valA || 0) - (valB || 0) : (valB || 0) - (valA || 0);
            });
        });

        return map;
    }, [data, orderSortField, orderSortAsc, metric]);

    // 実績シェア順（取扱量が多い順）に並び替えた材質リスト
    const sortedMaterials = useMemo(() => {
        if (!data?.material_summary) return [];
        return [...data.material_summary].sort((a, b) => {
            const valA = metric === 'meters' ? a.meters : a.amount;
            const valB = metric === 'meters' ? b.meters : b.amount;
            return valB - valA;
        });
    }, [data?.material_summary, metric]);

    // 月別推移（昇順 / 降順）
    const sortedMonthlyMaterials = useMemo(() => {
        if (!data?.monthly_materials) return [];
        const rows = [...data.monthly_materials];
        if (materialMonthOrder === 'desc') {
            return [...rows].reverse();
        }
        return rows;
    }, [data?.monthly_materials, materialMonthOrder]);

    // 検索フィルター適用後の明細
    const filteredDetailOrders = useMemo(() => {
        if (!data?.detail_orders) return [];
        if (!detailSearch.trim()) return data.detail_orders;
        const term = detailSearch.toLowerCase().trim();
        return data.detail_orders.filter(d => 
            d.customer_name?.toLowerCase().includes(term) ||
            d.customer_code?.toLowerCase().includes(term) ||
            d.product_name?.toLowerCase().includes(term) ||
            d.title?.toLowerCase().includes(term) ||
            d.sales_rep?.toLowerCase().includes(term) ||
            String(d.order_no).includes(term)
        );
    }, [data, detailSearch]);

    // 明細CSVエクスポート
    const handleExportCSV = () => {
        if (!data?.detail_orders || data.detail_orders.length === 0) {
            toast.error('エクスポートするデータがありません');
            return;
        }

        const headers = [
            '区分', '担当営業', '得意先コード', '得意先名称', '受注No', '枝番', '受注日',
            '商品コード', '商品名', 'タイトル', '材質', '単位', '受注数量', 'サイズピッチ(mm)',
            '新版ｍ数', '新版金額(円)', 'リピート件数', 'リピートｍ数', 'リピート金額(円)', '総合計ｍ数', '総合計金額(円)'
        ];

        const rows: string[][] = [];
        data.detail_orders.forEach(d => {
            rows.push([
                `"${d.classification || ''}"`,
                `"${d.sales_rep || ''}"`,
                `"${d.customer_code || ''}"`,
                `"${(d.customer_name || '').replace(/"/g, '""')}"`,
                String(d.order_no),
                String(d.branch_no),
                d.order_date || '',
                `"${d.product_code || ''}"`,
                `"${(d.product_name || '').replace(/"/g, '""')}"`,
                `"${(d.title || '').replace(/"/g, '""')}"`,
                `"${d.material_group || ''}"`,
                `"${d.unit || ''}"`,
                String(d.quantity || 0),
                String(d.size_pitch || 0),
                String(d.meters || 0),
                String(d.amount || 0),
                String(d.repeat_count || 0),
                String(d.repeat_meters || 0),
                String(d.repeat_amount || 0),
                String((d.meters || 0) + (d.repeat_meters || 0)),
                String((d.amount || 0) + (d.repeat_amount || 0))
            ]);
        });

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `今期新版リピート受注明細_${categoryFilter}_${metric}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('受注明細CSVをダウンロードしました');
    };

    // 担当別月別実績マトリクスCSVエクスポート
    const handleExportMonthlyMatrixCSV = () => {
        if (!data?.sales_rep_matrix || !data.sales_rep_matrix.months.length) {
            toast.error('エクスポートする月別データがありません');
            return;
        }
        const months = data.sales_rep_matrix.months;
        const monthHeaders = months.map(m => formatMonthLabel(m));
        const metricUnit = metric === 'meters' ? 'm' : '円';
        const subLabel = matrixSubMetric === 'total' ? '総合計' : matrixSubMetric === 'shinban' ? '新版のみ' : 'リピートのみ';

        const headers = ['担当営業', ...monthHeaders, `通期合計(${metricUnit})`];
        const rows: string[][] = [];

        data.sales_rep_matrix.rows.forEach(r => {
            const rowVals = months.map(m => {
                const mData = r.monthly[m];
                if (!mData) return '0';
                const v = metric === 'meters'
                    ? (matrixSubMetric === 'total' ? mData.total_meters : matrixSubMetric === 'shinban' ? mData.shinban_meters : mData.repeat_meters)
                    : (matrixSubMetric === 'total' ? mData.total_amount : matrixSubMetric === 'shinban' ? mData.shinban_amount : mData.repeat_amount);
                return String(Math.round(v));
            });
            const totV = metric === 'meters'
                ? (matrixSubMetric === 'total' ? r.total.total_meters : matrixSubMetric === 'shinban' ? r.total.shinban_meters : r.total.repeat_meters)
                : (matrixSubMetric === 'total' ? r.total.total_amount : matrixSubMetric === 'shinban' ? r.total.shinban_amount : r.total.repeat_amount);
            rows.push([`"${r.sales_rep}"`, ...rowVals, String(Math.round(totV))]);
        });

        // 全社合計行
        const totRowVals = months.map(m => {
            const mData = data.sales_rep_matrix!.monthly_totals[m];
            if (!mData) return '0';
            const v = metric === 'meters'
                ? (matrixSubMetric === 'total' ? mData.total_meters : matrixSubMetric === 'shinban' ? mData.shinban_meters : mData.repeat_meters)
                : (matrixSubMetric === 'total' ? mData.total_amount : matrixSubMetric === 'shinban' ? mData.shinban_amount : mData.repeat_amount);
            return String(Math.round(v));
        });
        const grandTotV = metric === 'meters'
            ? (matrixSubMetric === 'total' ? data.sales_rep_matrix.overall_total.total_meters : matrixSubMetric === 'shinban' ? data.sales_rep_matrix.overall_total.shinban_meters : data.sales_rep_matrix.overall_total.repeat_meters)
            : (matrixSubMetric === 'total' ? data.sales_rep_matrix.overall_total.total_amount : matrixSubMetric === 'shinban' ? data.sales_rep_matrix.overall_total.shinban_amount : data.sales_rep_matrix.overall_total.repeat_amount);
        rows.push(['"全社合計"', ...totRowVals, String(Math.round(grandTotV))]);

        const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', `担当別月別実績マトリクス_${subLabel}_${metricUnit}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success('担当別月別マトリクスCSVをダウンロードしました');
    };

    // フォーマットヘルパー
    const formatValue = (metersVal: number, amountVal: number): string => {
        if (metric === 'meters') {
            return `${Math.round(metersVal).toLocaleString()} m`;
        }
        return `¥${Math.round(amountVal).toLocaleString()}`;
    };

    return (
        <div className="space-y-6 animate-fadeIn">
            {/* 1. ヘッダー & コントロールバー */}
            <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg text-white shadow-sm">
                            <Sparkles size={18} />
                        </span>
                        <h2 className="text-lg font-bold text-gray-900">
                            新版商品 ＆ 今期内リピート受注分析
                        </h2>
                        <span className="text-xs bg-indigo-50 text-indigo-700 font-semibold px-2.5 py-0.5 rounded-full border border-indigo-200">
                            当期 2026/02～ 受注ベース
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                        今期受注された「別注・3Fロール印刷」の新版と、その後のリピート定着（原反ｍ数・売上金額）を追跡・集計
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                    {/* 指標切り替えトグル */}
                    <div className="bg-gray-100 p-1 rounded-lg flex items-center border border-gray-200 shadow-inner">
                        <button
                            type="button"
                            onClick={() => setMetric('meters')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                metric === 'meters'
                                    ? 'bg-white text-blue-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            📏 ｍ（メートル）ベース
                        </button>
                        <button
                            type="button"
                            onClick={() => setMetric('amount')}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
                                metric === 'amount'
                                    ? 'bg-white text-emerald-700 shadow-sm'
                                    : 'text-gray-600 hover:text-gray-900'
                            }`}
                        >
                            💴 売上金額ベース
                        </button>
                    </div>

                    {/* 区分フィルター */}
                    <select
                        aria-label="受注区分フィルター"
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value as 'all' | 'roll' | 'custom')}
                        className="text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-gray-800 font-medium focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
                    >
                        <option value="all">全区分（ロール＋別注）</option>
                        <option value="roll">3Fロールフレキソ印刷のみ</option>
                        <option value="custom">別注（ポリ別注・ポリ除く）のみ</option>
                    </select>

                    {/* CSV出力ボタン */}
                    <button
                        type="button"
                        onClick={handleExportCSV}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-300 rounded-lg text-xs font-bold transition-colors shadow-sm"
                        title="Excel / CSV出力"
                    >
                        <Download size={14} />
                        <span>CSV出力</span>
                    </button>

                    {/* 更新ボタン */}
                    <button
                        type="button"
                        onClick={fetchData}
                        disabled={loading}
                        className="p-1.5 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors"
                        title="データを再集計"
                    >
                        <RotateCcw size={16} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center text-gray-500 space-y-3 bg-white rounded-xl border border-gray-200">
                    <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-sm font-medium">新版およびリピート受注データを集計中...</span>
                </div>
            ) : (!data || !data.summary) ? (
                <div className="p-8 text-center text-gray-500 bg-white rounded-xl border border-gray-200">
                    新版・リピート受注データの集計結果がありません
                </div>
            ) : (
                <>
                    {/* 2. KPI サマリーカード */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* 新版受注 */}
                        <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-sm relative overflow-hidden group hover:border-blue-300 transition-all">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-blue-50 rounded-full -mr-8 -mt-8 -z-0 transition-transform group-hover:scale-110"></div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between text-blue-800 font-bold text-xs mb-1">
                                    <span className="flex items-center gap-1.5">
                                        <Sparkles size={14} className="text-blue-600" />
                                        新版 受注実績
                                    </span>
                                    <span className="bg-blue-100/80 text-blue-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        {data.summary.shinban_count} 件
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-gray-900 tracking-tight mt-1">
                                    {metric === 'meters'
                                        ? `${Math.round(data.summary.shinban_meters).toLocaleString()} m`
                                        : `¥${Math.round(data.summary.shinban_amount).toLocaleString()}`}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-1">
                                    {metric === 'meters'
                                        ? `金額換算: ¥${Math.round(data.summary.shinban_amount).toLocaleString()}`
                                        : `ｍ換算: ${Math.round(data.summary.shinban_meters).toLocaleString()} m`}
                                </div>
                            </div>
                        </div>

                        {/* 今期内リピート受注 */}
                        <div className="bg-white p-4 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden group hover:border-indigo-300 transition-all">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 rounded-full -mr-8 -mt-8 -z-0 transition-transform group-hover:scale-110"></div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between text-indigo-800 font-bold text-xs mb-1">
                                    <span className="flex items-center gap-1.5">
                                        <TrendingUp size={14} className="text-indigo-600" />
                                        今期内リピート受注
                                    </span>
                                    <span className="bg-indigo-100/80 text-indigo-800 text-[10px] px-2 py-0.5 rounded-full font-bold">
                                        {data.summary.repeat_count} 件
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-indigo-900 tracking-tight mt-1">
                                    {metric === 'meters'
                                        ? `${Math.round(data.summary.repeat_meters).toLocaleString()} m`
                                        : `¥${Math.round(data.summary.repeat_amount).toLocaleString()}`}
                                </div>
                                <div className="text-[11px] text-gray-500 mt-1">
                                    {metric === 'meters'
                                        ? `金額換算: ¥${Math.round(data.summary.repeat_amount).toLocaleString()}`
                                        : `ｍ換算: ${Math.round(data.summary.repeat_meters).toLocaleString()} m`}
                                </div>
                            </div>
                        </div>

                        {/* 新版＋リピート 総合計 */}
                        <div className="bg-gradient-to-br from-slate-900 to-slate-800 p-4 rounded-xl text-white shadow-md relative overflow-hidden">
                            <div className="flex items-center justify-between text-slate-300 font-bold text-xs mb-1">
                                <span className="flex items-center gap-1.5">
                                    <Layers size={14} className="text-blue-400" />
                                    新版＋リピート 総合計
                                </span>
                                <span className="bg-white/20 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                                    {data.summary.shinban_count + data.summary.repeat_count} 件
                                </span>
                            </div>
                            <div className="text-2xl font-black text-white tracking-tight mt-1">
                                {metric === 'meters'
                                    ? `${Math.round(data.summary.total_meters).toLocaleString()} m`
                                    : `¥${Math.round(data.summary.total_amount).toLocaleString()}`}
                            </div>
                            <div className="text-[11px] text-slate-400 mt-1">
                                {metric === 'meters'
                                    ? `総売上額: ¥${Math.round(data.summary.total_amount).toLocaleString()}`
                                    : `総ｍ数: ${Math.round(data.summary.total_meters).toLocaleString()} m`}
                            </div>
                        </div>

                        {/* リピート定着率 */}
                        <div className="bg-white p-4 rounded-xl border border-emerald-100 shadow-sm relative overflow-hidden group hover:border-emerald-300 transition-all">
                            <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 rounded-full -mr-8 -mt-8 -z-0 transition-transform group-hover:scale-110"></div>
                            <div className="relative z-10">
                                <div className="flex items-center justify-between text-emerald-800 font-bold text-xs mb-1">
                                    <span className="flex items-center gap-1.5">
                                        <CheckCircle2 size={14} className="text-emerald-600" />
                                        今期リピート定着率
                                    </span>
                                    <span className="text-[10px] text-emerald-700 font-bold">
                                        {metric === 'meters' ? 'ｍ基準' : '金額基準'}
                                    </span>
                                </div>
                                <div className="text-2xl font-black text-emerald-700 tracking-tight mt-1">
                                    {metric === 'meters'
                                        ? `${data.summary.repeat_rate_meters}%`
                                        : `${data.summary.repeat_rate_amount}%`}
                                </div>
                                <div className="w-full bg-gray-100 rounded-full h-2 mt-2 overflow-hidden">
                                    <div
                                        className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                                        style={{
                                            width: `${Math.min(
                                                100,
                                                metric === 'meters'
                                                    ? data.summary.repeat_rate_meters
                                                    : data.summary.repeat_rate_amount
                                            )}%`
                                        }}
                                    ></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 3. 担当営業別 パフォーマンス（通期ランキング / 月別推移マトリクス） */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="flex items-center gap-2">
                                    <User size={18} className="text-gray-700" />
                                    <h3 className="font-bold text-sm text-gray-900">
                                        担当営業別 実績分析
                                    </h3>
                                </div>

                                {/* 表示ビュー切り替えタブ */}
                                <div className="inline-flex rounded-lg border border-gray-200 bg-gray-200/60 p-0.5 shadow-inner">
                                    <button
                                        type="button"
                                        onClick={() => setRepViewMode('ranking')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                            repViewMode === 'ranking'
                                                ? 'bg-white text-blue-700 shadow-xs'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <span>👑 通期サマリー＆明細展開</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setRepViewMode('monthly')}
                                        className={`px-3 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
                                            repViewMode === 'monthly'
                                                ? 'bg-white text-indigo-700 shadow-xs'
                                                : 'text-gray-600 hover:text-gray-900'
                                        }`}
                                    >
                                        <BarChart3 size={13} />
                                        <span>担当別 × 月別推移マトリクス</span>
                                        <span className="bg-indigo-100 text-indigo-800 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                                            新機能
                                        </span>
                                    </button>
                                </div>
                            </div>

                            <div className="text-xs text-gray-500 flex items-center gap-3">
                                <span>表示単位: <strong className="text-gray-800">{metric === 'meters' ? 'ｍ（メートル）' : '円（税別）'}</strong></span>
                            </div>
                        </div>

                        {/* ビュー1: 担当別 × 月別推移マトリクス */}
                        {repViewMode === 'monthly' ? (
                            <div className="overflow-x-auto">
                                {/* 月別マトリクス サブコントロール */}
                                <div className="px-4 py-2.5 bg-indigo-50/50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-gray-700">表示対象:</span>
                                        <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5 shadow-xs">
                                            <button
                                                type="button"
                                                onClick={() => setMatrixSubMetric('total')}
                                                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all ${
                                                    matrixSubMetric === 'total'
                                                        ? 'bg-indigo-600 text-white shadow-xs'
                                                        : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                            >
                                                総合計（新版＋リピート）
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMatrixSubMetric('shinban')}
                                                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all ${
                                                    matrixSubMetric === 'shinban'
                                                        ? 'bg-blue-600 text-white shadow-xs'
                                                        : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                            >
                                                新版のみ
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setMatrixSubMetric('repeat')}
                                                className={`px-2.5 py-1 rounded-md font-semibold text-xs transition-all ${
                                                    matrixSubMetric === 'repeat'
                                                        ? 'bg-emerald-600 text-white shadow-xs'
                                                        : 'text-gray-600 hover:text-gray-900'
                                                }`}
                                            >
                                                リピートのみ
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <span className="text-[11px] text-gray-500">※各担当者の最高値月をハイライト表示</span>
                                        <button
                                            type="button"
                                            onClick={handleExportMonthlyMatrixCSV}
                                            className="flex items-center gap-1 px-2.5 py-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-md font-bold shadow-xs text-xs transition-colors"
                                        >
                                            <Download size={13} />
                                            <span>月別マトリクスCSV</span>
                                        </button>
                                    </div>
                                </div>

                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                                            <th className="py-2.5 px-3 w-12 text-center">順位</th>
                                            <th className="py-2.5 px-3 sticky left-0 bg-gray-100/95 z-10 min-w-[90px]">担当営業</th>
                                            {matrixMonths.map(m => (
                                                <th key={m} className="py-2.5 px-2.5 text-right whitespace-nowrap min-w-[75px]">
                                                    {formatMonthLabel(m)}
                                                </th>
                                            ))}
                                            <th className="py-2.5 px-3 text-right bg-indigo-50/70 text-indigo-900 font-bold whitespace-nowrap min-w-[85px]">
                                                通期合計
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {data.sales_rep_matrix?.rows.map((row, idx) => {
                                            const monthValues = matrixMonths.map(m => {
                                                const mData = row.monthly[m];
                                                if (!mData) return 0;
                                                return metric === 'meters'
                                                    ? (matrixSubMetric === 'total' ? mData.total_meters : matrixSubMetric === 'shinban' ? mData.shinban_meters : mData.repeat_meters)
                                                    : (matrixSubMetric === 'total' ? mData.total_amount : matrixSubMetric === 'shinban' ? mData.shinban_amount : mData.repeat_amount);
                                            });
                                            const maxVal = Math.max(...monthValues, 0);

                                            const totVal = metric === 'meters'
                                                ? (matrixSubMetric === 'total' ? row.total.total_meters : matrixSubMetric === 'shinban' ? row.total.shinban_meters : row.total.repeat_meters)
                                                : (matrixSubMetric === 'total' ? row.total.total_amount : matrixSubMetric === 'shinban' ? row.total.shinban_amount : row.total.repeat_amount);

                                            return (
                                                <tr key={row.sales_rep} className="hover:bg-blue-50/40 transition-colors">
                                                    <td className="py-2.5 px-3 text-center text-gray-400 font-bold">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="py-2.5 px-3 font-bold text-gray-900 sticky left-0 bg-white hover:bg-blue-50/40 z-10 border-r border-gray-100 whitespace-nowrap">
                                                        {row.sales_rep}
                                                    </td>
                                                    {matrixMonths.map((m, mIdx) => {
                                                        const val = monthValues[mIdx];
                                                        const isPeak = val > 0 && val === maxVal;
                                                        return (
                                                            <td
                                                                key={m}
                                                                className={`py-2.5 px-2.5 text-right font-mono transition-colors ${
                                                                    isPeak
                                                                        ? 'bg-indigo-50/80 text-indigo-900 font-bold'
                                                                        : val > 0
                                                                        ? 'text-gray-800'
                                                                        : 'text-gray-300'
                                                                }`}
                                                            >
                                                                {val > 0 ? formatValue(val, val) : '-'}
                                                            </td>
                                                        );
                                                    })}
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-indigo-950 bg-indigo-50/40 whitespace-nowrap">
                                                        {formatValue(totVal, totVal)}
                                                    </td>
                                                </tr>
                                            );
                                        })}

                                        {/* 全社合計行 */}
                                        {data.sales_rep_matrix?.monthly_totals && (
                                            <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-slate-900">
                                                <td className="py-3 px-3 text-center text-slate-500 font-bold">-</td>
                                                <td className="py-3 px-3 font-bold sticky left-0 bg-slate-100/95 z-10 border-r border-slate-200 whitespace-nowrap">
                                                    全社合計
                                                </td>
                                                {matrixMonths.map(m => {
                                                    const mData = data.sales_rep_matrix!.monthly_totals[m];
                                                    const val = mData
                                                        ? (metric === 'meters'
                                                            ? (matrixSubMetric === 'total' ? mData.total_meters : matrixSubMetric === 'shinban' ? mData.shinban_meters : mData.repeat_meters)
                                                            : (matrixSubMetric === 'total' ? mData.total_amount : matrixSubMetric === 'shinban' ? mData.shinban_amount : mData.repeat_amount))
                                                        : 0;
                                                    return (
                                                        <td key={m} className="py-3 px-2.5 text-right font-mono text-slate-900 font-bold whitespace-nowrap">
                                                            {val > 0 ? formatValue(val, val) : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-3 px-3 text-right font-mono font-black text-indigo-900 bg-indigo-100/60 whitespace-nowrap">
                                                    {(() => {
                                                        const grandVal = metric === 'meters'
                                                            ? (matrixSubMetric === 'total' ? data.sales_rep_matrix.overall_total.total_meters : matrixSubMetric === 'shinban' ? data.sales_rep_matrix.overall_total.shinban_meters : data.sales_rep_matrix.overall_total.repeat_meters)
                                                            : (matrixSubMetric === 'total' ? data.sales_rep_matrix.overall_total.total_amount : matrixSubMetric === 'shinban' ? data.sales_rep_matrix.overall_total.shinban_amount : data.sales_rep_matrix.overall_total.repeat_amount);
                                                        return formatValue(grandVal, grandVal);
                                                    })()}
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            /* ビュー2: 通期ランキング ＆ 個別明細アコーディオン展開 */
                            <div className="overflow-x-auto">
                                {/* クイック並び替えバー */}
                                <div className="px-4 py-2.5 bg-slate-50 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-bold text-gray-600 flex items-center gap-1 mr-1">
                                            <ArrowDownUp size={13} className="text-gray-500" />
                                            並び替え:
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => { setSortField('total'); setSortAsc(false); }}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                                sortField === 'total' && !sortAsc
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <Trophy size={12} className={sortField === 'total' && !sortAsc ? 'text-amber-300' : 'text-amber-500'} />
                                            <span>総合計順</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSortField('shinban'); setSortAsc(false); }}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                                sortField === 'shinban' && !sortAsc
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <Zap size={12} className={sortField === 'shinban' && !sortAsc ? 'text-amber-300' : 'text-blue-500'} />
                                            <span>新版獲得力順</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSortField('repeat'); setSortAsc(false); }}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                                sortField === 'repeat' && !sortAsc
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <RotateCcw size={12} className={sortField === 'repeat' && !sortAsc ? 'text-white' : 'text-indigo-500'} />
                                            <span>リピート実績順</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSortField('rate'); setSortAsc(false); }}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                                sortField === 'rate' && !sortAsc
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <TrendingUp size={12} className={sortField === 'rate' && !sortAsc ? 'text-white' : 'text-emerald-500'} />
                                            <span>リピート率順</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => { setSortField('name'); setSortAsc(true); }}
                                            className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                                sortField === 'name' && sortAsc
                                                    ? 'bg-blue-600 text-white shadow-xs'
                                                    : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                            }`}
                                        >
                                            <span>🔤 担当名順</span>
                                        </button>
                                    </div>
                                    <span className="text-[11px] text-gray-400">
                                        ※見出しクリックで昇順/降順切替
                                    </span>
                                </div>

                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                                        <th className="py-2.5 px-3 w-12 text-center">順位</th>
                                        <th
                                            className={`py-2.5 px-3 cursor-pointer hover:bg-gray-200 transition-colors ${
                                                sortField === 'name' ? 'bg-blue-50 text-blue-800' : ''
                                            }`}
                                            onClick={() => {
                                                if (sortField === 'name') setSortAsc(!sortAsc);
                                                else { setSortField('name'); setSortAsc(true); }
                                            }}
                                        >
                                            <div className="flex items-center gap-1">
                                                <span>担当営業</span>
                                                <ArrowUpDown size={12} className={sortField === 'name' ? 'text-blue-600' : 'text-gray-400'} />
                                            </div>
                                        </th>
                                        <th
                                            className={`py-2.5 px-3 text-right cursor-pointer hover:bg-gray-200 transition-colors ${
                                                sortField === 'shinban' ? 'bg-blue-50 text-blue-800' : ''
                                            }`}
                                            onClick={() => {
                                                if (sortField === 'shinban') setSortAsc(!sortAsc);
                                                else { setSortField('shinban'); setSortAsc(false); }
                                            }}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>新版実績</span>
                                                <ArrowUpDown size={12} className={sortField === 'shinban' ? 'text-blue-600' : 'text-gray-400'} />
                                            </div>
                                        </th>
                                        <th
                                            className={`py-2.5 px-3 text-right cursor-pointer hover:bg-gray-200 transition-colors ${
                                                sortField === 'repeat' ? 'bg-blue-50 text-blue-800' : ''
                                            }`}
                                            onClick={() => {
                                                if (sortField === 'repeat') setSortAsc(!sortAsc);
                                                else { setSortField('repeat'); setSortAsc(false); }
                                            }}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>リピート実績</span>
                                                <ArrowUpDown size={12} className={sortField === 'repeat' ? 'text-blue-600' : 'text-gray-400'} />
                                            </div>
                                        </th>
                                        <th
                                            className={`py-2.5 px-3 text-right cursor-pointer hover:bg-gray-200 transition-colors ${
                                                sortField === 'total' ? 'bg-blue-50 text-blue-800' : ''
                                            }`}
                                            onClick={() => {
                                                if (sortField === 'total') setSortAsc(!sortAsc);
                                                else { setSortField('total'); setSortAsc(false); }
                                            }}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>総合計</span>
                                                <ArrowUpDown size={12} className={sortField === 'total' ? 'text-blue-600' : 'text-gray-400'} />
                                            </div>
                                        </th>
                                        <th
                                            className={`py-2.5 px-3 text-right cursor-pointer hover:bg-gray-200 transition-colors ${
                                                sortField === 'rate' ? 'bg-blue-50 text-blue-800' : ''
                                            }`}
                                            onClick={() => {
                                                if (sortField === 'rate') setSortAsc(!sortAsc);
                                                else { setSortField('rate'); setSortAsc(false); }
                                            }}
                                        >
                                            <div className="flex items-center justify-end gap-1">
                                                <span>リピート率</span>
                                                <ArrowUpDown size={12} className={sortField === 'rate' ? 'text-blue-600' : 'text-gray-400'} />
                                            </div>
                                        </th>
                                        <th className="py-2.5 px-3 w-20 text-center">明細</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedReps.map((rep, idx) => {
                                        const isExpanded = expandedRep === rep.sales_rep;
                                        const repOrders = ordersByRep[rep.sales_rep] || [];

                                        const shinVal = metric === 'meters' ? rep.shinban_meters : rep.shinban_amount;
                                        const repVal = metric === 'meters' ? rep.repeat_meters : rep.repeat_amount;
                                        const totVal = metric === 'meters' ? rep.total_meters : rep.total_amount;
                                        const rateVal = metric === 'meters' ? rep.repeat_rate_meters : rep.repeat_rate_amount;

                                        return (
                                            <React.Fragment key={rep.sales_rep}>
                                                <tr
                                                    onClick={() => setExpandedRep(isExpanded ? null : rep.sales_rep)}
                                                    className={`hover:bg-blue-50/60 cursor-pointer transition-colors ${
                                                        isExpanded ? 'bg-blue-50/80 font-medium' : ''
                                                    }`}
                                                >
                                                    <td className="py-3 px-3 text-center text-gray-500 font-bold">
                                                        {idx + 1}
                                                    </td>
                                                    <td className="py-3 px-3 font-bold text-gray-900 text-sm">
                                                        {rep.sales_rep}
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <div className="font-bold text-gray-800">
                                                            {formatValue(rep.shinban_meters, rep.shinban_amount)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">
                                                            {rep.shinban_count} 件
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <div className="font-bold text-indigo-700">
                                                            {formatValue(rep.repeat_meters, rep.repeat_amount)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">
                                                            {rep.repeat_count} 件
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <div className="font-bold text-gray-900 text-sm">
                                                            {formatValue(rep.total_meters, rep.total_amount)}
                                                        </div>
                                                        <div className="text-[10px] text-gray-400">
                                                            計 {rep.shinban_count + rep.repeat_count} 件
                                                        </div>
                                                    </td>
                                                    <td className="py-3 px-3 text-right">
                                                        <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                                            rateVal >= 50
                                                                ? 'bg-emerald-100 text-emerald-800'
                                                                : rateVal >= 30
                                                                ? 'bg-blue-100 text-blue-800'
                                                                : 'bg-gray-100 text-gray-700'
                                                        }`}>
                                                            {rateVal}%
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-3 text-center">
                                                        <button
                                                            type="button"
                                                            className="text-gray-400 hover:text-blue-600 transition-colors p-1"
                                                        >
                                                            {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                                                        </button>
                                                    </td>
                                                </tr>

                                                {/* ドリルダウン：この営業マンの新版商品一覧 */}
                                                {isExpanded && (
                                                    <tr>
                                                        <td colSpan={7} className="p-0 bg-slate-50 border-y border-blue-200">
                                                            <div className="p-4 space-y-2">
                                                                <div className="flex items-center justify-between mb-2">
                                                                    <div className="text-xs font-bold text-gray-800 flex items-center gap-1.5">
                                                                        <span>📂 {rep.sales_rep} の新版商品 ＆ リピート案件明細</span>
                                                                        <span className="text-[11px] bg-blue-100 text-blue-800 px-2 py-0.5 rounded font-bold">
                                                                            新版 {repOrders.length} 件
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-[11px] text-gray-500">
                                                                        ※各行をクリックするとリピート受注の日付・Noを表示
                                                                    </span>
                                                                </div>

                                                                {/* 担当者の月別推移ミニテーブル */}
                                                                {rep.monthly && (
                                                                    <div className="bg-white p-3 rounded-lg border border-gray-200 shadow-xs mb-3">
                                                                        <div className="text-xs font-bold text-gray-700 mb-2 flex items-center justify-between">
                                                                            <span className="flex items-center gap-1.5">
                                                                                <Calendar size={13} className="text-indigo-600" />
                                                                                <span>{rep.sales_rep} の月別実績推移（{metric === 'meters' ? 'ｍベース' : '売上金額'}）</span>
                                                                            </span>
                                                                            <span className="text-[10px] text-gray-400">※当期月度別</span>
                                                                        </div>
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-full text-center text-[11px] border border-gray-100">
                                                                                <thead className="bg-gray-50 text-gray-600 font-semibold border-b border-gray-200">
                                                                                    <tr>
                                                                                        <th className="py-1 px-2 text-left bg-gray-100">区分</th>
                                                                                        {matrixMonths.map(m => (
                                                                                            <th key={m} className="py-1 px-2 whitespace-nowrap">{formatMonthLabel(m)}</th>
                                                                                        ))}
                                                                                        <th className="py-1 px-2 bg-indigo-50 text-indigo-900 font-bold whitespace-nowrap">通期計</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="divide-y divide-gray-100">
                                                                                    <tr>
                                                                                        <td className="py-1 px-2 text-left font-medium text-gray-700 bg-gray-50/50">新版</td>
                                                                                        {matrixMonths.map(m => {
                                                                                            const mData = rep.monthly?.[m];
                                                                                            const v = metric === 'meters' ? mData?.shinban_meters : mData?.shinban_amount;
                                                                                            return (
                                                                                                <td key={m} className="py-1 px-2 font-mono">
                                                                                                    {v && v > 0 ? (
                                                                                                        <span className="font-semibold text-gray-800">{formatValue(v, v)}</span>
                                                                                                    ) : (
                                                                                                        <span className="text-gray-300">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                            );
                                                                                        })}
                                                                                        <td className="py-1 px-2 font-mono font-bold text-gray-900 bg-indigo-50/30">
                                                                                            {formatValue(rep.shinban_meters, rep.shinban_amount)}
                                                                                        </td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className="py-1 px-2 text-left font-medium text-indigo-700 bg-indigo-50/20">リピート</td>
                                                                                        {matrixMonths.map(m => {
                                                                                            const mData = rep.monthly?.[m];
                                                                                            const v = metric === 'meters' ? mData?.repeat_meters : mData?.repeat_amount;
                                                                                            return (
                                                                                                <td key={m} className="py-1 px-2 font-mono">
                                                                                                    {v && v > 0 ? (
                                                                                                        <span className="font-semibold text-indigo-600">{formatValue(v, v)}</span>
                                                                                                    ) : (
                                                                                                        <span className="text-gray-300">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                            );
                                                                                        })}
                                                                                        <td className="py-1 px-2 font-mono font-bold text-indigo-800 bg-indigo-50/30">
                                                                                            {formatValue(rep.repeat_meters, rep.repeat_amount)}
                                                                                        </td>
                                                                                    </tr>
                                                                                    <tr className="bg-slate-100/70 font-bold border-t border-slate-200">
                                                                                        <td className="py-1 px-2 text-left text-slate-800">月計</td>
                                                                                        {matrixMonths.map(m => {
                                                                                            const mData = rep.monthly?.[m];
                                                                                            const v = metric === 'meters' ? mData?.total_meters : mData?.total_amount;
                                                                                            return (
                                                                                                <td key={m} className="py-1 px-2 font-mono">
                                                                                                    {v && v > 0 ? (
                                                                                                        <span className="text-slate-900 font-bold">{formatValue(v, v)}</span>
                                                                                                    ) : (
                                                                                                        <span className="text-gray-300">-</span>
                                                                                                    )}
                                                                                                </td>
                                                                                            );
                                                                                        })}
                                                                                        <td className="py-1 px-2 font-mono text-blue-900 bg-indigo-100/60 font-black">
                                                                                            {formatValue(rep.total_meters, rep.total_amount)}
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}

                                                                <div className="max-h-80 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-inner">
                                                                    <table className="w-full text-left text-[11px]">
                                                                        <thead className="bg-gray-100 text-gray-600 font-bold sticky top-0 border-b border-gray-200">
                                                                            <tr>
                                                                                <th
                                                                                    className={`py-2 px-2.5 cursor-pointer hover:bg-gray-200 transition-colors ${orderSortField === 'date' ? 'bg-blue-50 text-blue-800' : ''}`}
                                                                                    onClick={() => {
                                                                                        if (orderSortField === 'date') setOrderSortAsc(!orderSortAsc);
                                                                                        else { setOrderSortField('date'); setOrderSortAsc(false); }
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span>受注日</span>
                                                                                        <ArrowUpDown size={11} className={orderSortField === 'date' ? 'text-blue-600' : 'text-gray-400'} />
                                                                                    </div>
                                                                                </th>
                                                                                <th
                                                                                    className={`py-2 px-2.5 cursor-pointer hover:bg-gray-200 transition-colors ${orderSortField === 'customer' ? 'bg-blue-50 text-blue-800' : ''}`}
                                                                                    onClick={() => {
                                                                                        if (orderSortField === 'customer') setOrderSortAsc(!orderSortAsc);
                                                                                        else { setOrderSortField('customer'); setOrderSortAsc(true); }
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span>得意先名</span>
                                                                                        <ArrowUpDown size={11} className={orderSortField === 'customer' ? 'text-blue-600' : 'text-gray-400'} />
                                                                                    </div>
                                                                                </th>
                                                                                <th className="py-2 px-2.5">品名 / タイトル</th>
                                                                                <th className="py-2 px-2.5">区分/材質</th>
                                                                                <th
                                                                                    className={`py-2 px-2.5 text-right cursor-pointer hover:bg-gray-200 transition-colors ${orderSortField === 'shinban' ? 'bg-blue-50 text-blue-800' : ''}`}
                                                                                    onClick={() => {
                                                                                        if (orderSortField === 'shinban') setOrderSortAsc(!orderSortAsc);
                                                                                        else { setOrderSortField('shinban'); setOrderSortAsc(false); }
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-center justify-end gap-1">
                                                                                        <span>新版実績</span>
                                                                                        <ArrowUpDown size={11} className={orderSortField === 'shinban' ? 'text-blue-600' : 'text-gray-400'} />
                                                                                    </div>
                                                                                </th>
                                                                                <th
                                                                                    className={`py-2 px-2.5 text-right cursor-pointer hover:bg-gray-200 transition-colors ${orderSortField === 'repeat' ? 'bg-blue-50 text-blue-800' : ''}`}
                                                                                    onClick={() => {
                                                                                        if (orderSortField === 'repeat') setOrderSortAsc(!orderSortAsc);
                                                                                        else { setOrderSortField('repeat'); setOrderSortAsc(false); }
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-center justify-end gap-1">
                                                                                        <span>リピート実績</span>
                                                                                        <ArrowUpDown size={11} className={orderSortField === 'repeat' ? 'text-blue-600' : 'text-gray-400'} />
                                                                                    </div>
                                                                                </th>
                                                                                <th
                                                                                    className={`py-2 px-2.5 text-center cursor-pointer hover:bg-gray-200 transition-colors ${orderSortField === 'count' ? 'bg-blue-50 text-blue-800' : ''}`}
                                                                                    onClick={() => {
                                                                                        if (orderSortField === 'count') setOrderSortAsc(!orderSortAsc);
                                                                                        else { setOrderSortField('count'); setOrderSortAsc(false); }
                                                                                    }}
                                                                                >
                                                                                    <div className="flex items-center justify-center gap-1">
                                                                                        <span>回数</span>
                                                                                        <ArrowUpDown size={11} className={orderSortField === 'count' ? 'text-blue-600' : 'text-gray-400'} />
                                                                                    </div>
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="divide-y divide-gray-100">
                                                                            {repOrders.map((ord) => {
                                                                                const orderKey = `${ord.order_no}-${ord.branch_no}`;
                                                                                const isOrderExpanded = expandedOrder === orderKey;

                                                                                return (
                                                                                    <React.Fragment key={orderKey}>
                                                                                        <tr
                                                                                            onClick={(e) => {
                                                                                                e.stopPropagation();
                                                                                                setExpandedOrder(isOrderExpanded ? null : orderKey);
                                                                                            }}
                                                                                            className="hover:bg-blue-50/50 cursor-pointer"
                                                                                        >
                                                                                            <td className="py-2 px-2.5 text-gray-500 font-mono">
                                                                                                {ord.order_date}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 font-bold text-gray-800 truncate max-w-[140px]" title={ord.customer_name}>
                                                                                                {ord.customer_name}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 max-w-[220px]">
                                                                                                <div className="font-medium text-gray-900 truncate" title={ord.product_name}>
                                                                                                    {ord.product_name}
                                                                                                </div>
                                                                                                <div className="text-[10px] text-gray-500 truncate" title={ord.title}>
                                                                                                    {ord.title}
                                                                                                </div>
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5">
                                                                                                <span className="bg-gray-100 px-1.5 py-0.5 rounded text-[10px] text-gray-700">
                                                                                                    {ord.material_group}
                                                                                                </span>
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 text-right font-bold text-gray-900">
                                                                                                {formatValue(ord.meters, ord.amount)}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 text-right font-bold text-indigo-700">
                                                                                                {ord.repeat_count > 0 ? formatValue(ord.repeat_meters, ord.repeat_amount) : '-'}
                                                                                            </td>
                                                                                            <td className="py-2 px-2.5 text-center">
                                                                                                {ord.repeat_count > 0 ? (
                                                                                                    <span className="bg-indigo-100 text-indigo-800 px-1.5 py-0.5 rounded font-bold text-[10px]">
                                                                                                        {ord.repeat_count}回
                                                                                                    </span>
                                                                                                ) : (
                                                                                                    <span className="text-gray-300">-</span>
                                                                                                )}
                                                                                            </td>
                                                                                        </tr>

                                                                                        {/* リピート受注の明細一覧 */}
                                                                                        {isOrderExpanded && ord.repeats.length > 0 && (
                                                                                            <tr>
                                                                                                <td colSpan={7} className="py-2 px-4 bg-indigo-50/50">
                                                                                                    <div className="text-[10px] text-indigo-900 font-bold mb-1">
                                                                                                        🔁 今期リピート履歴（{ord.repeats.length}回）:
                                                                                                    </div>
                                                                                                    <div className="space-y-1">
                                                                                                        {ord.repeats.map((repItem, rIdx) => (
                                                                                                            <div key={rIdx} className="flex items-center justify-between text-[10px] text-gray-700 bg-white px-2.5 py-1 rounded border border-indigo-100">
                                                                                                                <span className="font-mono text-gray-500">
                                                                                                                    {repItem.order_date} (No.{repItem.order_no}-{repItem.branch_no})
                                                                                                                </span>
                                                                                                                <span className="truncate max-w-[200px]" title={repItem.title || repItem.product_name}>
                                                                                                                    {repItem.title || repItem.product_name}
                                                                                                                </span>
                                                                                                                <span className="font-bold text-indigo-700">
                                                                                                                    {formatValue(repItem.meters, repItem.amount)}
                                                                                                                </span>
                                                                                                            </div>
                                                                                                        ))}
                                                                                                    </div>
                                                                                                </td>
                                                                                            </tr>
                                                                                        )}
                                                                                    </React.Fragment>
                                                                                );
                                                                            })}
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                    </div>

                    {/* 4. 月別 × 主要材質別 推移マトリクス表 */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="p-4 bg-gray-50/70 border-b border-gray-200 flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Calendar size={18} className="text-gray-700" />
                                <h3 className="font-bold text-sm text-gray-900">
                                    月別 × 主要材質別 新版実績推移
                                </h3>
                                <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.5 rounded font-bold">
                                    取扱シェア順（主力材質が左）
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-xs">
                                <button
                                    type="button"
                                    onClick={() => setMaterialMonthOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                    className="px-2.5 py-1 rounded bg-white border border-gray-300 hover:bg-gray-100 font-bold text-gray-700 flex items-center gap-1 shadow-2xs transition-colors"
                                >
                                    <ArrowUpDown size={12} className="text-blue-600" />
                                    <span>月順: {materialMonthOrder === 'asc' ? '古い順 ⬆️' : '新しい順 ⬇️'}</span>
                                </button>
                                <span className="text-gray-500">
                                    単位: {metric === 'meters' ? 'ｍ（メートル）' : '千円'}
                                </span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                                        <th className="py-2.5 px-3">受注月度</th>
                                        {sortedMaterials.map(m => (
                                            <th key={m.material_group} className="py-2.5 px-2.5 text-right whitespace-nowrap">
                                                {m.material_group}
                                            </th>
                                        ))}
                                        <th className="py-2.5 px-3 text-right bg-blue-50/50 text-blue-900 font-bold">
                                            月度合計
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {sortedMonthlyMaterials.map((mRow) => {
                                        return (
                                            <tr key={mRow.month} className="hover:bg-gray-50/80">
                                                <td className="py-2.5 px-3 font-bold text-gray-800 font-mono">
                                                    {mRow.month}
                                                </td>
                                                {sortedMaterials.map(m => {
                                                    const val = metric === 'meters'
                                                        ? (mRow.meters[m.material_group] || 0)
                                                        : Math.round((mRow.amount[m.material_group] || 0) / 1000);
                                                    return (
                                                        <td key={m.material_group} className={`py-2.5 px-2.5 text-right font-mono ${
                                                            val > 0 ? 'text-gray-800 font-medium' : 'text-gray-300'
                                                        }`}>
                                                            {val > 0 ? val.toLocaleString() : '-'}
                                                        </td>
                                                    );
                                                })}
                                                <td className="py-2.5 px-3 text-right font-bold text-blue-900 bg-blue-50/30 font-mono">
                                                    {metric === 'meters'
                                                        ? `${Math.round(mRow.total_meters).toLocaleString()} m`
                                                        : `¥${Math.round(mRow.total_amount).toLocaleString()}`}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 font-bold text-gray-900 border-t-2 border-gray-300">
                                        <td className="py-3 px-3">累計合計</td>
                                        {sortedMaterials.map(m => (
                                            <td key={m.material_group} className="py-3 px-2.5 text-right font-mono">
                                                {metric === 'meters'
                                                    ? Math.round(m.meters).toLocaleString()
                                                    : Math.round(m.amount / 1000).toLocaleString()}
                                            </td>
                                        ))}
                                        <td className="py-3 px-3 text-right bg-blue-100/60 text-blue-900 font-black font-mono">
                                            {metric === 'meters'
                                                ? `${Math.round(data.summary.shinban_meters).toLocaleString()} m`
                                                : `¥${Math.round(data.summary.shinban_amount).toLocaleString()}`}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    {/* 5. 材質別 累計シェア＆バーチャート */}
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="font-bold text-sm text-gray-900 flex items-center gap-2">
                                <Layers size={18} className="text-gray-700" />
                                材質別 新版実績構成比
                            </h3>
                            <span className="text-xs text-gray-500">
                                基準: {metric === 'meters' ? 'ｍ数（原反換算）' : '売上金額'}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {data.material_summary.map(m => {
                                const share = metric === 'meters' ? m.share_meters : m.share_amount;
                                return (
                                    <div key={m.material_group} className="p-3 bg-gray-50 rounded-lg border border-gray-100 space-y-1.5">
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-bold text-gray-800">{m.material_group}</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-gray-500">{m.count}件</span>
                                                <span className="font-bold text-gray-900">
                                                    {formatValue(m.meters, m.amount)}
                                                </span>
                                                <span className="bg-blue-100 text-blue-800 text-[10px] px-1.5 py-0.2 rounded font-bold">
                                                    {share}%
                                                </span>
                                            </div>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                                            <div
                                                className="bg-blue-600 h-1.5 rounded-full"
                                                style={{ width: `${Math.min(100, share)}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
