'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    FileSpreadsheet,
    User,
    Search,
    ArrowUpRight,
    Loader2,
    RefreshCw,
    ArrowDownUp,
    Trophy,
    Clock,
    TrendingDown,
    TrendingUp,
    AlertTriangle,
    ArrowUpDown
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { useFile } from '@/context/FileContext';

interface ChurnRiskItem {
    customer_code: string;
    customer_name: string;
    sales_rep: string;
    order_count: number;
    last_order_date: string;
    avg_cycle_days: number;
    days_since_last: number;
    delay_ratio: number;
    total_sales: number;
    sample_product: string;
    alert_level: 'warning' | 'danger';
    action_suggestion: string;
}

interface PlateExpiryItem {
    customer_code: string;
    customer_name: string;
    product_code: string;
    product_name: string;
    brand_name: string;
    classification: string;
    order_no: string | number;
    sales_rep: string;
    last_order_date: string;
    unit_price: number;
    cost_price: number;
    last_quantity: number;
    unit: string;
    elapsed_months: number;
    elapsed_days: number;
    remaining_months: number;
    action_suggestion: string;
}

interface MarginDeviationItem {
    customer_code: string;
    customer_name: string;
    product_code: string;
    product_name: string;
    sales_rep: string;
    total_sales: number;
    total_profit: number;
    margin_rate: number;
    deviation_type: 'low' | 'high';
    status_label: string;
    last_order_date: string;
    latest_unit_price: number;
    latest_cost_price: number;
    total_quantity: number;
    unit: string;
    action_suggestion: string;
}

interface CustomerMarginDeviationItem {
    customer_code: string;
    customer_name: string;
    sales_rep: string;
    total_sales: number;
    total_profit: number;
    margin_rate: number;
    deviation_type: 'low' | 'high';
    status_label: string;
    last_order_date: string;
    product_count: number;
    order_count: number;
    low_margin_prod_count: number;
    high_margin_prod_count: number;
    top_product_name: string;
    action_suggestion: string;
}

interface ActionableInsightsResponse {
    success: boolean;
    sales_reps: string[];
    selected_rep: string;
    summary: {
        churn_risk_count: number;
        plate_expiry_count: number;
        margin_deviation_count: number;
        low_margin_count: number;
        high_margin_count: number;
        customer_margin_deviation_count?: number;
        customer_low_margin_count?: number;
        customer_high_margin_count?: number;
    };
    churn_risks: ChurnRiskItem[];
    plate_expiries: PlateExpiryItem[];
    margin_deviations: MarginDeviationItem[];
    customer_margin_deviations?: CustomerMarginDeviationItem[];
}

type TabType = 'churn' | 'plate' | 'margin';
type MarginViewUnit = 'customer' | 'product';

export default function ActionableSalesInsights(): React.JSX.Element {
    const { selectedFile } = useFile();
    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<ActionableInsightsResponse | null>(null);
    const [selectedRep, setSelectedRep] = useState<string>('all');
    const [hasAutoSelected, setHasAutoSelected] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('churn');
    const [marginViewUnit, setMarginViewUnit] = useState<MarginViewUnit>('customer');
    const [marginFilter, setMarginFilter] = useState<'all' | 'low' | 'high'>('all');
    const [searchKeyword, setSearchKeyword] = useState<string>('');

    // 並び替えステート
    const [churnSort, setChurnSort] = useState<'impact' | 'delay' | 'days' | 'name'>('impact');
    const [plateSort, setPlateSort] = useState<'urgency' | 'orders' | 'name'>('urgency');
    const [marginSort, setMarginSort] = useState<'impact' | 'rate_asc' | 'rate_desc' | 'name'>('impact');

    // 日報ファイル名から担当営業名を抽出（例: 本社007_【見上】_2026年度用日報.xlsm → 見上）
    const repNameFromFile = useMemo(() => {
        if (!selectedFile) return '';
        const match = selectedFile.match(/【(.*?)】/);
        return match ? match[1].trim() : '';
    }, [selectedFile]);

    // 自分の担当営業と一致するリスト上の名前を特定
    const matchedMyRep = useMemo(() => {
        if (!data?.sales_reps || !repNameFromFile) return '';
        return data.sales_reps.find(r => r === repNameFromFile || r.includes(repNameFromFile) || repNameFromFile.includes(r)) || '';
    }, [data?.sales_reps, repNameFromFile]);

    // Fetch Insights Data
    const fetchInsights = async (rep: string) => {
        setLoading(true);
        try {
            const url = rep !== 'all'
                ? `/api/sales-insights/actionable?sales_rep=${encodeURIComponent(rep)}&limit=150`
                : `/api/sales-insights/actionable?limit=150`;
            const res = await fetch(url);
            const json = await res.json();
            if (json.success) {
                setData(json);
                // 初回ロード時、自分の担当営業があれば自動選択
                if (!hasAutoSelected && repNameFromFile && json.sales_reps) {
                    const matched = json.sales_reps.find((r: string) => r === repNameFromFile || r.includes(repNameFromFile) || repNameFromFile.includes(r));
                    if (matched && rep === 'all') {
                        setSelectedRep(matched);
                        setHasAutoSelected(true);
                        return; // setSelectedRepのuseEffectで再取得される
                    }
                }
                setHasAutoSelected(true);
            } else {
                toast.error('営業指標データの取得に失敗しました');
            }
        } catch (err) {
            console.error('Failed to load actionable insights:', err);
            toast.error('営業指標データの通信エラーが発生しました');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchInsights(selectedRep);
    }, [selectedRep]);

    // フィルタリング ＆ 並び替え処理
    const filteredChurnRisks = useMemo(() => {
        if (!data?.churn_risks) return [];
        let list = [...data.churn_risks];
        const q = searchKeyword.toLowerCase().trim();
        if (q) {
            list = list.filter(i =>
                i.customer_name.toLowerCase().includes(q) ||
                i.customer_code.toLowerCase().includes(q) ||
                i.sales_rep.toLowerCase().includes(q) ||
                i.sample_product.toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => {
            if (churnSort === 'impact') return (b.total_sales || 0) - (a.total_sales || 0);
            if (churnSort === 'delay') return (b.delay_ratio || 0) - (a.delay_ratio || 0);
            if (churnSort === 'days') return (b.days_since_last || 0) - (a.days_since_last || 0);
            if (churnSort === 'name') return a.customer_name.localeCompare(b.customer_name, 'ja');
            return 0;
        });
    }, [data?.churn_risks, searchKeyword, churnSort]);

    const filteredPlateExpiries = useMemo(() => {
        if (!data?.plate_expiries) return [];
        let list = [...data.plate_expiries];
        const q = searchKeyword.toLowerCase().trim();
        if (q) {
            list = list.filter(i =>
                i.customer_name.toLowerCase().includes(q) ||
                i.customer_code.toLowerCase().includes(q) ||
                i.product_name.toLowerCase().includes(q) ||
                String(i.order_no).includes(q) ||
                i.sales_rep.toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => {
            if (plateSort === 'urgency') return (b.elapsed_months || 0) - (a.elapsed_months || 0);
            if (plateSort === 'orders') return (b.last_quantity || 0) - (a.last_quantity || 0);
            if (plateSort === 'name') return a.customer_name.localeCompare(b.customer_name, 'ja');
            return 0;
        });
    }, [data?.plate_expiries, searchKeyword, plateSort]);

    const filteredMarginDeviations = useMemo(() => {
        if (!data?.margin_deviations) return [];
        let list = [...data.margin_deviations];
        if (marginFilter !== 'all') {
            list = list.filter(i => i.deviation_type === marginFilter);
        }
        const q = searchKeyword.toLowerCase().trim();
        if (q) {
            list = list.filter(i =>
                i.customer_name.toLowerCase().includes(q) ||
                i.customer_code.toLowerCase().includes(q) ||
                i.product_name.toLowerCase().includes(q) ||
                i.sales_rep.toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => {
            if (marginSort === 'impact') return (b.total_sales || 0) - (a.total_sales || 0);
            if (marginSort === 'rate_asc') return (a.margin_rate || 0) - (b.margin_rate || 0);
            if (marginSort === 'rate_desc') return (b.margin_rate || 0) - (a.margin_rate || 0);
            if (marginSort === 'name') return a.customer_name.localeCompare(b.customer_name, 'ja');
            return 0;
        });
    }, [data?.margin_deviations, marginFilter, searchKeyword, marginSort]);

    const filteredCustomerMarginDeviations = useMemo(() => {
        if (!data?.customer_margin_deviations) return [];
        let list = [...data.customer_margin_deviations];
        if (marginFilter !== 'all') {
            list = list.filter(i => i.deviation_type === marginFilter);
        }
        const q = searchKeyword.toLowerCase().trim();
        if (q) {
            list = list.filter(i =>
                i.customer_name.toLowerCase().includes(q) ||
                i.customer_code.toLowerCase().includes(q) ||
                i.sales_rep.toLowerCase().includes(q) ||
                i.top_product_name.toLowerCase().includes(q)
            );
        }
        return list.sort((a, b) => {
            if (marginSort === 'impact') return (b.total_sales || 0) - (a.total_sales || 0);
            if (marginSort === 'rate_asc') return (a.margin_rate || 0) - (b.margin_rate || 0);
            if (marginSort === 'rate_desc') return (b.margin_rate || 0) - (a.margin_rate || 0);
            if (marginSort === 'name') return a.customer_name.localeCompare(b.customer_name, 'ja');
            return 0;
        });
    }, [data?.customer_margin_deviations, marginFilter, searchKeyword, marginSort]);

    // Excel Export
    const handleExportExcel = async () => {
        if (!data) return;
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ASAHIPACK Daily Report System';
            const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');

            if (activeTab === 'churn') {
                const ws = workbook.addWorksheet('発注停止・失注阻止リスト');
                ws.columns = [
                    { header: '得意先CD', key: 'code', width: 12 },
                    { header: '得意先名', key: 'name', width: 35 },
                    { header: '担当営業', key: 'rep', width: 14 },
                    { header: '最終注文日', key: 'last_date', width: 14 },
                    { header: '平均周期(日)', key: 'avg_cycle', width: 14 },
                    { header: '未発注日数', key: 'days', width: 14 },
                    { header: '超過倍率', key: 'ratio', width: 12 },
                    { header: '年間売上(円)', key: 'sales', width: 16 },
                    { header: '代表商品', key: 'product', width: 30 },
                    { header: '営業アクション推奨', key: 'action', width: 45 },
                ];
                filteredChurnRisks.forEach(r => {
                    ws.addRow({
                        code: r.customer_code,
                        name: r.customer_name,
                        rep: r.sales_rep,
                        last_date: r.last_order_date,
                        avg_cycle: r.avg_cycle_days,
                        days: r.days_since_last,
                        ratio: `${r.delay_ratio}倍`,
                        sales: r.total_sales,
                        product: r.sample_product,
                        action: r.action_suggestion
                    });
                });
                const buffer = await workbook.xlsx.writeBuffer();
                saveAs(new Blob([buffer]), `発注停止_失注阻止アクションリスト_${todayStr}.xlsx`);
                toast.success('失注阻止リストを出力しました');
            } else if (activeTab === 'plate') {
                const ws = workbook.addWorksheet('版落ち寸前リスト');
                ws.columns = [
                    { header: '得意先CD', key: 'code', width: 12 },
                    { header: '得意先名', key: 'name', width: 35 },
                    { header: '受注No', key: 'order_no', width: 14 },
                    { header: '商品名', key: 'product', width: 35 },
                    { header: '担当営業', key: 'rep', width: 14 },
                    { header: '最終受注日', key: 'last_date', width: 14 },
                    { header: '前回数量', key: 'qty', width: 14 },
                    { header: '単価', key: 'price', width: 12 },
                    { header: '経過月数', key: 'months', width: 12 },
                    { header: '期限まで', key: 'rem', width: 14 },
                    { header: '営業アクション推奨', key: 'action', width: 45 },
                ];
                filteredPlateExpiries.forEach(r => {
                    ws.addRow({
                        code: r.customer_code,
                        name: r.customer_name,
                        order_no: r.order_no,
                        product: r.product_name,
                        rep: r.sales_rep,
                        last_date: r.last_order_date,
                        qty: `${r.last_quantity.toLocaleString()} ${r.unit}`,
                        price: r.unit_price,
                        months: `${r.elapsed_months}ヶ月`,
                        rem: `あと${r.remaining_months}ヶ月`,
                        action: r.action_suggestion
                    });
                });
                const buffer = await workbook.xlsx.writeBuffer();
                saveAs(new Blob([buffer]), `版落ち2年寸前アクションリスト_${todayStr}.xlsx`);
                toast.success('版落ち寸前リストを出力しました');
            } else {
                // 適正利益乖離: 会社別シートと個別商品別シートの両方を出力
                const wsCust = workbook.addWorksheet('適正利益乖離（会社別）');
                wsCust.columns = [
                    { header: '得意先CD', key: 'code', width: 12 },
                    { header: '得意先名', key: 'name', width: 35 },
                    { header: '担当営業', key: 'rep', width: 14 },
                    { header: '判定', key: 'status', width: 22 },
                    { header: '会社粗利率', key: 'rate', width: 12 },
                    { header: '年間売上(円)', key: 'sales', width: 16 },
                    { header: '粗利金額(円)', key: 'profit', width: 16 },
                    { header: '取引品目数', key: 'product_count', width: 12 },
                    { header: '薄利品目数(<12%)', key: 'low_count', width: 16 },
                    { header: '高利品目数(>35%)', key: 'high_count', width: 16 },
                    { header: '主な取扱商品', key: 'top_product', width: 35 },
                    { header: '営業アクション推奨', key: 'action', width: 50 },
                ];
                filteredCustomerMarginDeviations.forEach(r => {
                    wsCust.addRow({
                        code: r.customer_code,
                        name: r.customer_name,
                        rep: r.sales_rep,
                        status: r.status_label,
                        rate: `${r.margin_rate}%`,
                        sales: r.total_sales,
                        profit: r.total_profit,
                        product_count: r.product_count,
                        low_count: r.low_margin_prod_count,
                        high_count: r.high_margin_prod_count,
                        top_product: r.top_product_name,
                        action: r.action_suggestion
                    });
                });

                const wsProd = workbook.addWorksheet('適正利益乖離（個別商品別）');
                wsProd.columns = [
                    { header: '得意先CD', key: 'code', width: 12 },
                    { header: '得意先名', key: 'name', width: 35 },
                    { header: '商品名', key: 'product', width: 35 },
                    { header: '担当営業', key: 'rep', width: 14 },
                    { header: '判定', key: 'status', width: 22 },
                    { header: '粗利率', key: 'rate', width: 12 },
                    { header: '売上金額(円)', key: 'sales', width: 16 },
                    { header: '粗利金額(円)', key: 'profit', width: 16 },
                    { header: '最新単価', key: 'price', width: 12 },
                    { header: '仕入原価', key: 'cost', width: 12 },
                    { header: '営業アクション推奨', key: 'action', width: 45 },
                ];
                filteredMarginDeviations.forEach(r => {
                    wsProd.addRow({
                        code: r.customer_code,
                        name: r.customer_name,
                        product: r.product_name,
                        rep: r.sales_rep,
                        status: r.status_label,
                        rate: `${r.margin_rate}%`,
                        sales: r.total_sales,
                        profit: r.total_profit,
                        price: r.latest_unit_price,
                        cost: r.latest_cost_price,
                        action: r.action_suggestion
                    });
                });

                const buffer = await workbook.xlsx.writeBuffer();
                saveAs(new Blob([buffer]), `適正利益乖離アクションリスト_${todayStr}.xlsx`);
                toast.success('適正利益乖離リスト（会社別・商品別）を出力しました');
            }
        } catch (err) {
            console.error('Excel export error:', err);
            toast.error('Excel出力に失敗しました');
        }
    };

    return (
        <div className="space-y-4">
            {/* Top Control Bar */}
            <div className="bg-white rounded-lg border border-sf-border shadow-xs p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-sf-text">アクション指標一覧</span>
                </div>

                <div className="flex items-center gap-2.5 flex-wrap">
                    {/* Sales Rep Selector */}
                    <div className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs">
                        <User size={14} className="text-gray-400" />
                        <span className="text-gray-500 font-medium">担当営業:</span>
                        <select
                            value={selectedRep}
                            onChange={e => setSelectedRep(e.target.value)}
                            className="bg-transparent font-bold text-gray-800 focus:outline-none cursor-pointer"
                        >
                            <option value="all">全営業担当</option>
                            {data?.sales_reps.map(rep => {
                                const isMe = matchedMyRep && rep === matchedMyRep;
                                return (
                                    <option key={rep} value={rep}>
                                        {rep}{isMe ? '（自分）' : ''}
                                    </option>
                                );
                            })}
                        </select>
                    </div>

                    {/* Quick switch to My Rep button if not currently selected */}
                    {matchedMyRep && selectedRep !== matchedMyRep && (
                        <button
                            type="button"
                            onClick={() => setSelectedRep(matchedMyRep)}
                            className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-semibold text-xs rounded-lg border border-blue-200 transition-colors flex items-center gap-1"
                            title={`自分の担当「${matchedMyRep}」に切り替えます`}
                        >
                            <User size={13} />
                            <span>自分の担当（{matchedMyRep}）</span>
                        </button>
                    )}

                    {/* Refresh Button */}
                    <button
                        onClick={() => fetchInsights(selectedRep)}
                        disabled={loading}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-gray-200 transition-colors"
                        title="再取得"
                    >
                        <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
                    </button>

                    {/* Excel Export */}
                    <button
                        onClick={handleExportExcel}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg flex items-center gap-1.5 shadow-xs transition-colors"
                        title="現在のリストをExcel出力 (.xlsx)"
                    >
                        <FileSpreadsheet size={15} />
                        <span>Excel出力</span>
                    </button>
                </div>
            </div>

            {/* 3 Action Tabs */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Tab 1: Churn Risk */}
                <button
                    onClick={() => setActiveTab('churn')}
                    className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        activeTab === 'churn'
                            ? 'bg-rose-50/80 border-rose-400 shadow-sm ring-1 ring-rose-300'
                            : 'bg-white border-sf-border hover:bg-gray-50 shadow-xs'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-gray-900">🚨 発注ストップ</span>
                        </div>
                        <span className={`text-xl font-bold font-mono ${activeTab === 'churn' ? 'text-rose-700' : 'text-gray-700'}`}>
                            {data?.summary.churn_risk_count ?? 0}
                            <span className="text-xs font-normal ml-0.5 text-gray-500">件</span>
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                        通常の発注周期を超過している顧客（フォロー・在庫確認）
                    </p>
                </button>

                {/* Tab 2: Plate Expiry */}
                <button
                    onClick={() => setActiveTab('plate')}
                    className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        activeTab === 'plate'
                            ? 'bg-blue-50/80 border-blue-400 shadow-sm ring-1 ring-blue-300'
                            : 'bg-white border-sf-border hover:bg-gray-50 shadow-xs'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-gray-900">⏰ 版落ち寸前（2年保管）</span>
                        </div>
                        <span className={`text-xl font-bold font-mono ${activeTab === 'plate' ? 'text-blue-700' : 'text-gray-700'}`}>
                            {data?.summary.plate_expiry_count ?? 0}
                            <span className="text-xs font-normal ml-0.5 text-gray-500">品目</span>
                        </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                        最終発注から20〜23ヶ月経過の別注品（再版代不要のリピート案内）
                    </p>
                </button>

                {/* Tab 3: Fair Profit Margin Deviation */}
                <button
                    onClick={() => setActiveTab('margin')}
                    className={`p-3.5 rounded-lg border text-left transition-all flex flex-col justify-between ${
                        activeTab === 'margin'
                            ? 'bg-amber-50/80 border-amber-400 shadow-sm ring-1 ring-amber-300'
                            : 'bg-white border-sf-border hover:bg-gray-50 shadow-xs'
                    }`}
                >
                    <div className="flex justify-between items-start">
                        <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-gray-900">⚖️ 適正利益乖離</span>
                        </div>
                        <div className="text-right">
                            <span className={`text-xl font-bold font-mono ${activeTab === 'margin' ? 'text-amber-700' : 'text-gray-700'}`}>
                                {marginViewUnit === 'customer'
                                    ? (data?.summary.customer_margin_deviation_count ?? 0)
                                    : (data?.summary.margin_deviation_count ?? 0)}
                                <span className="text-xs font-normal ml-0.5 text-gray-500">
                                    {marginViewUnit === 'customer' ? '社' : '品目'}
                                </span>
                            </span>
                            <div className="text-[10px] text-gray-400 font-medium">
                                {marginViewUnit === 'customer'
                                    ? `（商品別: ${data?.summary.margin_deviation_count ?? 0}品）`
                                    : `（会社別: ${data?.summary.customer_margin_deviation_count ?? 0}社）`}
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-gray-500 mt-1.5">
                        粗利率12%未満（薄利）または35%超（高粗利）の会社・品目
                    </p>
                </button>
            </div>

            {/* Keyword Search & Sub-filters */}
            <div className="bg-white rounded-xl border border-sf-border p-3.5 flex flex-wrap items-center justify-between gap-3 shadow-xs">
                <div className="relative flex-1 min-w-[240px]">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={searchKeyword}
                        onChange={e => setSearchKeyword(e.target.value)}
                        placeholder={
                            activeTab === 'margin' && marginViewUnit === 'customer'
                                ? "得意先名、コード、担当営業、代表商品で絞り込み..."
                                : "得意先名、商品名、受注Noで絞り込み..."
                        }
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                    />
                </div>

                {activeTab === 'margin' && (
                    <div className="flex items-center gap-3 flex-wrap">
                        {/* 表示単位切り替え（会社ごと / 個別商品） */}
                        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200 text-xs">
                            <button
                                type="button"
                                onClick={() => setMarginViewUnit('customer')}
                                className={`px-2.5 py-1 font-bold rounded-md transition-all ${
                                    marginViewUnit === 'customer'
                                        ? 'bg-white text-amber-900 shadow-xs border border-gray-200'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                会社ごと ({data?.summary.customer_margin_deviation_count ?? 0}社)
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarginViewUnit('product')}
                                className={`px-2.5 py-1 font-bold rounded-md transition-all ${
                                    marginViewUnit === 'product'
                                        ? 'bg-white text-amber-900 shadow-xs border border-gray-200'
                                        : 'text-gray-500 hover:text-gray-800'
                                }`}
                            >
                                個別商品 ({data?.summary.margin_deviation_count ?? 0}品)
                            </button>
                        </div>

                        {/* 利益判定フィルター */}
                        <div className="flex items-center gap-1.5">
                            <span className="text-xs text-gray-500 font-semibold">利益判定:</span>
                            <button
                                onClick={() => setMarginFilter('all')}
                                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                                    marginFilter === 'all'
                                        ? 'bg-slate-800 text-white'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                全件 ({marginViewUnit === 'customer'
                                    ? (data?.summary.customer_margin_deviation_count ?? 0)
                                    : (data?.summary.margin_deviation_count ?? 0)})
                            </button>
                            <button
                                onClick={() => setMarginFilter('low')}
                                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                                    marginFilter === 'low'
                                        ? 'bg-rose-600 text-white'
                                        : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                }`}
                            >
                                薄利 (&lt;12%) ({marginViewUnit === 'customer'
                                    ? (data?.summary.customer_low_margin_count ?? 0)
                                    : (data?.summary.low_margin_count ?? 0)})
                            </button>
                            <button
                                onClick={() => setMarginFilter('high')}
                                className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                                    marginFilter === 'high'
                                        ? 'bg-indigo-600 text-white'
                                        : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200'
                                }`}
                            >
                                高粗利 (&gt;35%) ({marginViewUnit === 'customer'
                                    ? (data?.summary.customer_high_margin_count ?? 0)
                                    : (data?.summary.high_margin_count ?? 0)})
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* 並び替えクイックバー */}
            <div className="bg-slate-50 border border-sf-border rounded-xl px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-gray-700 flex items-center gap-1 mr-1">
                        <ArrowDownUp size={13} className="text-gray-500" />
                        並び替え:
                    </span>

                    {/* タブ1: 発注ストップ */}
                    {activeTab === 'churn' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setChurnSort('impact')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    churnSort === 'impact'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="年間売上高が大きい重要顧客を優先表示（金額影響最大）"
                            >
                                <Trophy size={12} className={churnSort === 'impact' ? 'text-amber-300' : 'text-amber-500'} />
                                <span>🏆 年間売上規模順（最重要）</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setChurnSort('delay')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    churnSort === 'delay'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="通常発注サイクルからの遅延倍率が大きい順"
                            >
                                <AlertTriangle size={12} className={churnSort === 'delay' ? 'text-amber-300' : 'text-rose-500'} />
                                <span>⚠️ 超過倍率順</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setChurnSort('days')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    churnSort === 'days'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <Clock size={12} className={churnSort === 'days' ? 'text-white' : 'text-gray-500'} />
                                <span>⏳ 未発注日数順</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setChurnSort('name')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    churnSort === 'name'
                                        ? 'bg-slate-700 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <span>🔤 顧客名順</span>
                            </button>
                        </>
                    )}

                    {/* タブ2: 版落ち寸前 */}
                    {activeTab === 'plate' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setPlateSort('urgency')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    plateSort === 'urgency'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="23ヶ月経過（期限間近）を最優先表示"
                            >
                                <Clock size={12} className={plateSort === 'urgency' ? 'text-amber-300' : 'text-blue-500'} />
                                <span>⏰ 期限緊急順 (23ヶ月優先)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlateSort('orders')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    plateSort === 'orders'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="過去の注文回数が多い重要品目を優先"
                            >
                                <Trophy size={12} className={plateSort === 'orders' ? 'text-amber-300' : 'text-amber-500'} />
                                <span>📦 前回ロット順</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setPlateSort('name')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    plateSort === 'name'
                                        ? 'bg-slate-700 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <span>🔤 顧客名順</span>
                            </button>
                        </>
                    )}

                    {/* タブ3: 適正利益乖離 */}
                    {activeTab === 'margin' && (
                        <>
                            <button
                                type="button"
                                onClick={() => setMarginSort('impact')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    marginSort === 'impact'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="売上規模が大きい会社・品目を最優先表示"
                            >
                                <Trophy size={12} className={marginSort === 'impact' ? 'text-amber-300' : 'text-amber-500'} />
                                <span>🏆 売上規模順 (影響大)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarginSort('rate_asc')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    marginSort === 'rate_asc'
                                        ? 'bg-rose-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="粗利率が低い順（赤字・薄利改善の優先順）"
                            >
                                <TrendingDown size={12} className={marginSort === 'rate_asc' ? 'text-white' : 'text-rose-500'} />
                                <span>📉 薄利改善順 (低粗利優先)</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarginSort('rate_desc')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    marginSort === 'rate_desc'
                                        ? 'bg-indigo-600 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                                title="粗利率が高い順（コンペ・他社流出防止）"
                            >
                                <TrendingUp size={12} className={marginSort === 'rate_desc' ? 'text-white' : 'text-indigo-500'} />
                                <span>📈 高粗利順</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setMarginSort('name')}
                                className={`px-2.5 py-1 rounded-md font-bold transition-all flex items-center gap-1 ${
                                    marginSort === 'name'
                                        ? 'bg-slate-700 text-white shadow-xs'
                                        : 'bg-white text-gray-700 border border-gray-200 hover:bg-gray-100'
                                }`}
                            >
                                <span>🔤 名称順</span>
                            </button>
                        </>
                    )}
                </div>
            </div>

            {/* Main Action Table */}
            <div className="bg-white rounded-xl border border-sf-border shadow-sm overflow-hidden">
                {loading ? (
                    <div className="py-20 text-center text-gray-400">
                        <Loader2 size={30} className="animate-spin text-blue-600 mx-auto mb-2" />
                        <p className="font-bold text-sm text-gray-700">データを読み込み中...</p>
                    </div>
                ) : (
                    <>
                        {/* TAB 1: Churn Risk Table */}
                        {activeTab === 'churn' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-rose-50/50 text-gray-700 border-b border-rose-100 uppercase font-semibold">
                                        <tr>
                                            <th className="py-3 px-3">状態</th>
                                            <th className="py-3 px-3">得意先名称 / コード</th>
                                            <th className="py-3 px-3">担当営業</th>
                                            <th className="py-3 px-3">最終注文日</th>
                                            <th className="py-3 px-3 text-right">平均周期</th>
                                            <th className="py-3 px-3 text-right">未発注日数</th>
                                            <th className="py-3 px-3 text-right">超過倍率</th>
                                            <th className="py-3 px-3 text-right">年間売上</th>
                                            <th className="py-3 px-4">推奨アクション</th>
                                            <th className="py-3 px-3 text-center">カタログ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredChurnRisks.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="py-12 text-center text-gray-400">
                                                    該当するデータはありません
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredChurnRisks.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-rose-50/30 transition-colors">
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        {item.delay_ratio >= 2.5 ? (
                                                            <span className="px-2 py-0.5 bg-rose-600 text-white font-bold rounded text-[10px]">
                                                                重大
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px]">
                                                                警戒
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-bold text-gray-900">{item.customer_name}</div>
                                                        <div className="text-[11px] text-gray-400 font-mono">CD: {item.customer_code}</div>
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-gray-700">
                                                        {item.sales_rep}
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-gray-600">
                                                        {item.last_order_date}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-medium text-gray-600">
                                                        {item.avg_cycle_days}日
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-600">
                                                        {item.days_since_last}日
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-rose-700 text-sm">
                                                        {item.delay_ratio}倍
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800">
                                                        ¥{item.total_sales.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs text-gray-700 leading-snug">
                                                        <div className="text-gray-800">{item.action_suggestion}</div>
                                                        {item.sample_product && (
                                                            <div className="text-[11px] text-gray-400 mt-0.5 truncate max-w-xs">
                                                                代表品: {item.sample_product}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <Link
                                                            href={`/catalog?customer_code=${item.customer_code}`}
                                                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded text-xs inline-flex items-center gap-1 transition-colors border border-blue-200"
                                                        >
                                                            <span>カタログ</span>
                                                            <ArrowUpRight size={13} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* TAB 2: Plate Expiry Table */}
                        {activeTab === 'plate' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-blue-50/50 text-gray-700 border-b border-blue-100 uppercase font-semibold">
                                        <tr>
                                            <th className="py-3 px-3">期限</th>
                                            <th className="py-3 px-3">得意先名称 / コード</th>
                                            <th className="py-3 px-4">商品名 / 受注No</th>
                                            <th className="py-3 px-3">担当営業</th>
                                            <th className="py-3 px-3">最終受注日</th>
                                            <th className="py-3 px-3 text-right">前回ロット</th>
                                            <th className="py-3 px-3 text-right">販売単価</th>
                                            <th className="py-3 px-3 text-center">経過</th>
                                            <th className="py-3 px-4">推奨アクション</th>
                                            <th className="py-3 px-3 text-center">カタログ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredPlateExpiries.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="py-12 text-center text-gray-400">
                                                    該当するデータはありません
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredPlateExpiries.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        <span className="px-2 py-0.5 bg-blue-100 text-blue-800 font-bold rounded text-[11px]">
                                                            あと{item.remaining_months}ヶ月
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-bold text-gray-900">{item.customer_name}</div>
                                                        <div className="text-[11px] text-gray-400 font-mono">CD: {item.customer_code}</div>
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <div className="font-bold text-gray-800">{item.product_name}</div>
                                                        <div className="text-[11px] text-indigo-600 font-mono font-medium flex items-center gap-1.5 mt-0.5">
                                                            <span>No.{item.order_no}</span>
                                                            <span>|</span>
                                                            <span>CD: {item.product_code}</span>
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-gray-700">
                                                        {item.sales_rep}
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap font-mono text-gray-600">
                                                        {item.last_order_date}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800">
                                                        {item.last_quantity.toLocaleString()} {item.unit}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-gray-700 font-medium">
                                                        ¥{item.unit_price.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap font-mono text-gray-600">
                                                        {item.elapsed_months}ヶ月経過
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs text-gray-700 leading-snug">
                                                        <div className="text-gray-800">{item.action_suggestion}</div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <Link
                                                            href={`/catalog?customer_code=${item.customer_code}`}
                                                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded text-xs inline-flex items-center gap-1 transition-colors border border-blue-200"
                                                        >
                                                            <span>手配カタログ</span>
                                                            <ArrowUpRight size={13} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* TAB 3-A: Customer Margin Deviation Table (会社ごと) */}
                        {activeTab === 'margin' && marginViewUnit === 'customer' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-amber-50/50 text-gray-700 border-b border-amber-100 uppercase font-semibold">
                                        <tr>
                                            <th className="py-3 px-3">判定</th>
                                            <th className="py-3 px-3">得意先名称 / コード</th>
                                            <th className="py-3 px-3">担当営業</th>
                                            <th className="py-3 px-3 text-right">会社粗利率</th>
                                            <th className="py-3 px-3 text-right">年間売上</th>
                                            <th className="py-3 px-3 text-right">粗利額</th>
                                            <th className="py-3 px-3 text-center">取引品目（内訳）</th>
                                            <th className="py-3 px-4">主な取扱商品</th>
                                            <th className="py-3 px-4">営業アクション推奨</th>
                                            <th className="py-3 px-3 text-center">アクション</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredCustomerMarginDeviations.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="py-12 text-center text-gray-400">
                                                    該当するデータはありません
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredCustomerMarginDeviations.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        {item.deviation_type === 'low' ? (
                                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[10px] border border-rose-200">
                                                                薄利警戒 (&lt;12%)
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[10px] border border-indigo-200">
                                                                高利警戒 (&gt;35%)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-bold text-gray-900">{item.customer_name}</div>
                                                        <div className="text-[11px] text-gray-400 font-mono">CD: {item.customer_code}</div>
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-gray-700">
                                                        {item.sales_rep}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sm">
                                                        <span className={item.deviation_type === 'low' ? 'text-rose-600' : 'text-indigo-600'}>
                                                            {item.margin_rate}%
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800">
                                                        ¥{item.total_sales.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                                                        ¥{item.total_profit.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <span className="font-mono font-semibold text-gray-800">{item.product_count}品</span>
                                                        {item.low_margin_prod_count > 0 && (
                                                            <span className="ml-1.5 px-1.5 py-0.5 bg-rose-50 text-rose-700 border border-rose-200 rounded text-[10px] font-mono">
                                                                薄利 {item.low_margin_prod_count}
                                                            </span>
                                                        )}
                                                        {item.high_margin_prod_count > 0 && (
                                                            <span className="ml-1.5 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded text-[10px] font-mono">
                                                                高利 {item.high_margin_prod_count}
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs text-gray-800 max-w-[200px] truncate" title={item.top_product_name}>
                                                        {item.top_product_name || '-'}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs text-gray-700 leading-snug">
                                                        <div className="text-gray-800">{item.action_suggestion}</div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => {
                                                                    setMarginViewUnit('product');
                                                                    setSearchKeyword(item.customer_name);
                                                                }}
                                                                className="px-2 py-1 bg-amber-50 text-amber-800 hover:bg-amber-100 font-bold rounded text-xs inline-flex items-center gap-0.5 transition-colors border border-amber-200"
                                                                title="この得意先の個別商品一覧に切り替え"
                                                            >
                                                                <span>品目一覧</span>
                                                            </button>
                                                            <Link
                                                                href={`/catalog?customer_code=${item.customer_code}`}
                                                                className="px-2 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded text-xs inline-flex items-center gap-0.5 transition-colors border border-blue-200"
                                                                title="手配カタログを開く"
                                                            >
                                                                <span>カタログ</span>
                                                                <ArrowUpRight size={12} />
                                                            </Link>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}

                        {/* TAB 3-B: Product Margin Deviation Table (個別商品) */}
                        {activeTab === 'margin' && marginViewUnit === 'product' && (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-amber-50/50 text-gray-700 border-b border-amber-100 uppercase font-semibold">
                                        <tr>
                                            <th className="py-3 px-3">判定</th>
                                            <th className="py-3 px-3">得意先名称 / コード</th>
                                            <th className="py-3 px-4">商品名 / コード</th>
                                            <th className="py-3 px-3">担当営業</th>
                                            <th className="py-3 px-3 text-right">粗利率</th>
                                            <th className="py-3 px-3 text-right">年間売上</th>
                                            <th className="py-3 px-3 text-right">粗利額</th>
                                            <th className="py-3 px-3 text-right">単価 / 原価</th>
                                            <th className="py-3 px-4">推奨アクション</th>
                                            <th className="py-3 px-3 text-center">カタログ</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {filteredMarginDeviations.length === 0 ? (
                                            <tr>
                                                <td colSpan={10} className="py-12 text-center text-gray-400">
                                                    該当するデータはありません
                                                </td>
                                            </tr>
                                        ) : (
                                            filteredMarginDeviations.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-amber-50/30 transition-colors">
                                                    <td className="py-2.5 px-3 whitespace-nowrap">
                                                        {item.deviation_type === 'low' ? (
                                                            <span className="px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[10px] border border-rose-200">
                                                                薄利警戒 (&lt;12%)
                                                            </span>
                                                        ) : (
                                                            <span className="px-2 py-0.5 bg-indigo-100 text-indigo-800 font-bold rounded text-[10px] border border-indigo-200">
                                                                高利警戒 (&gt;35%)
                                                            </span>
                                                        )}
                                                    </td>
                                                    <td className="py-2.5 px-3">
                                                        <div className="font-bold text-gray-900">{item.customer_name}</div>
                                                        <div className="text-[11px] text-gray-400 font-mono">CD: {item.customer_code}</div>
                                                    </td>
                                                    <td className="py-2.5 px-4">
                                                        <div className="font-bold text-gray-800">{item.product_name}</div>
                                                        <div className="text-[11px] text-gray-400 font-mono mt-0.5">
                                                            CD: {item.product_code}
                                                        </div>
                                                    </td>
                                                    <td className="py-2.5 px-3 whitespace-nowrap font-medium text-gray-700">
                                                        {item.sales_rep}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-sm">
                                                        <span className={item.deviation_type === 'low' ? 'text-rose-600' : 'text-indigo-600'}>
                                                            {item.margin_rate}%
                                                        </span>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-gray-800">
                                                        ¥{item.total_sales.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-gray-700">
                                                        ¥{item.total_profit.toLocaleString()}
                                                    </td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-xs">
                                                        <div className="font-medium text-gray-800">¥{item.latest_unit_price.toLocaleString()}</div>
                                                        <div className="text-[10px] text-gray-400">原価: ¥{item.latest_cost_price.toLocaleString()}</div>
                                                    </td>
                                                    <td className="py-2.5 px-4 text-xs text-gray-700 leading-snug">
                                                        <div className="text-gray-800">{item.action_suggestion}</div>
                                                    </td>
                                                    <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                                        <Link
                                                            href={`/catalog?customer_code=${item.customer_code}`}
                                                            className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded text-xs inline-flex items-center gap-1 transition-colors border border-blue-200"
                                                        >
                                                            <span>カタログ</span>
                                                            <ArrowUpRight size={13} />
                                                        </Link>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}

