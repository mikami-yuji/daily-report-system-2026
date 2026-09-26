'use client';

import { useEffect, useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
    ShoppingBag,
    Search,
    Grid,
    List,
    Filter,
    ArrowUpDown,
    Download,
    ShoppingCart,
    Plus,
    Minus,
    Trash2,
    Copy,
    Check,
    AlertTriangle,
    Clock,
    Tag,
    Building2,
    Calendar,
    ChevronDown,
    X,
    ExternalLink,
    RefreshCw,
    Sparkles,
    FileSpreadsheet,
    Eye,
    Layers,
    SlidersHorizontal
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { searchDesignImages, getImageUrl, DesignImage } from '@/lib/api';
import { useFile } from '@/context/FileContext';

interface CustomerOption {
    code: string;
    name: string;
    rank: string;
    order_count: number;
    product_count: number;
    last_sales_date: string;
    total_sales: number;
    is_rep_customer?: boolean;
    primary_rep?: string;
}

interface ProductItem {
    product_code: string;
    product_name: string;
    brand_name: string;
    shape_type: string;
    is_roll: boolean;
    unit: string;
    latest_order_no: number;
    latest_branch_no: number;
    order_no_display: string;
    latest_order_date: string;
    latest_delivery_date: string;
    latest_sales_date: string;
    latest_unit_price: number;
    latest_cost_price: number;
    margin_rate: number | null;
    last_quantity: number;
    orders_count: number;
    total_quantity: number;
    total_amount: number;
    elapsed_months: number;
    alert_level: 'none' | 'warning' | 'danger';
    alert_text: string;
    sales_rep: string;
    title: string;
    material_name?: string;
    material_short?: string;
    colors_front?: number;
    colors_back?: number;
    colors_total?: number;
    color_display?: string;
    size_width?: number;
    size_pitch?: number;
    size_display?: string;
    weight?: number;
    capacity_display?: string;
    finish_note?: string;
    print_note?: string;
    image_url?: string | null;
    image_name?: string | null;
    image_variants?: string[];
}

interface CartItem {
    product: ProductItem;
    quantity: number;
}

function CatalogContent() {
    const searchParams = useSearchParams();
    const initialCode = searchParams.get('customer_code') || '';
    const { selectedFile } = useFile();

    // States
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [repName, setRepName] = useState<string>('');
    const [repCustomersCount, setRepCustomersCount] = useState<number>(0);
    const [customerScopeTab, setCustomerScopeTab] = useState<'rep' | 'all'>('rep');

    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [loadingCustomers, setLoadingCustomers] = useState(true);
    const [directDests, setDirectDests] = useState<{ name: string; code: string; order_count: number }[]>([]);
    const [selectedDirectDest, setSelectedDirectDest] = useState<string>('all');

    // Filters
    const [keyword, setKeyword] = useState('');
    const [shapeFilter, setShapeFilter] = useState('all');
    const [alertFilter, setAlertFilter] = useState('all');
    const [sortBy, setSortBy] = useState('latest_date');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // Cart
    const [cart, setCart] = useState<CartItem[]>([]);
    const [showCartModal, setShowCartModal] = useState(false);
    const [copiedEmail, setCopiedEmail] = useState(false);

    // Image Preview Modal States
    const [loadedThumbnails, setLoadedThumbnails] = useState<Record<string, string>>({});
    const [selectedProductForImage, setSelectedProductForImage] = useState<ProductItem | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageResults, setImageResults] = useState<DesignImage[]>([]);
    const [searchingImage, setSearchingImage] = useState(false);
    const [currentImageIdx, setCurrentImageIdx] = useState(0);

    // Initial / On-file-change Load of Customers
    useEffect(() => {
        setLoadingCustomers(true);
        const url = selectedFile
            ? `/api/catalog/customers?file_name=${encodeURIComponent(selectedFile)}`
            : '/api/catalog/customers';

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.customers) {
                    setCustomers(data.customers);
                    setRepName(data.rep_name || '');
                    const repCount = data.rep_customers_count || 0;
                    setRepCustomersCount(repCount);
                    if (repCount > 0) {
                        setCustomerScopeTab('rep');
                    } else {
                        setCustomerScopeTab('all');
                    }

                    if (initialCode) {
                        const target = data.customers.find((c: CustomerOption) => c.code === initialCode.trim());
                        if (target) {
                            setSelectedCustomer(target);
                            return;
                        }
                    }
                    
                    // Default to top customer (which is the top sales rep customer)
                    if (data.customers.length > 0) {
                        setSelectedCustomer(data.customers[0]);
                    }
                }
            })
            .catch(err => {
                console.error('Failed to load customers:', err);
                toast.error('得意先リストの取得に失敗しました');
            })
            .finally(() => setLoadingCustomers(false));
    }, [selectedFile, initialCode]);

    // Load direct destinations when selected customer changes
    useEffect(() => {
        if (!selectedCustomer) {
            setDirectDests([]);
            setSelectedDirectDest('all');
            return;
        }

        setSelectedDirectDest('all');
        fetch(`/api/catalog/direct-dests?customer_code=${selectedCustomer.code}`)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.direct_dests) {
                    setDirectDests(data.direct_dests);
                } else {
                    setDirectDests([]);
                }
            })
            .catch(err => {
                console.error('Failed to load direct dests:', err);
            });
    }, [selectedCustomer]);

    // Load Products when selected customer or selected direct destination changes
    useEffect(() => {
        if (!selectedCustomer) {
            setProducts([]);
            return;
        }

        setLoading(true);
        let url = `/api/catalog/products?customer_code=${selectedCustomer.code}`;
        if (selectedDirectDest !== 'all') {
            url += `&direct_dest=${encodeURIComponent(selectedDirectDest)}`;
        }

        fetch(url)
            .then(res => res.json())
            .then(data => {
                if (data.success && data.products) {
                    setProducts(data.products);
                }
            })
            .catch(err => {
                console.error('Failed to load products:', err);
                toast.error('商品リストの取得に失敗しました');
            })
            .finally(() => setLoading(false));
    }, [selectedCustomer, selectedDirectDest]);

    // Filtered and Sorted Products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            // Keyword Filter
            if (keyword.trim()) {
                const q = keyword.toLowerCase().trim();
                const matchName = p.product_name.toLowerCase().includes(q);
                const matchBrand = p.brand_name.toLowerCase().includes(q);
                const matchCode = p.product_code.toLowerCase().includes(q);
                const matchOrderNo = p.order_no_display.toLowerCase().includes(q);
                if (!matchName && !matchBrand && !matchCode && !matchOrderNo) return false;
            }

            // Shape Filter
            if (shapeFilter !== 'all') {
                if (shapeFilter === 'roll' && !p.is_roll) return false;
                if (shapeFilter === 'bag' && p.is_roll) return false;
            }

            // Alert Filter
            if (alertFilter === 'warning' && p.alert_level !== 'warning') return false;
            if (alertFilter === 'danger' && p.alert_level !== 'danger') return false;
            if (alertFilter === 'alert_all' && p.alert_level === 'none') return false;

            return true;
        }).sort((a, b) => {
            if (sortBy === 'price_desc') return b.latest_unit_price - a.latest_unit_price;
            if (sortBy === 'price_asc') return a.latest_unit_price - b.latest_unit_price;
            if (sortBy === 'orders_count') return b.orders_count - a.orders_count;
            if (sortBy === 'elapsed_desc') return b.elapsed_months - a.elapsed_months;
            if (sortBy === 'name') return a.product_name.localeCompare(b.product_name, 'ja');
            // latest_date (default)
            return (b.latest_sales_date || '').localeCompare(a.latest_sales_date || '');
        });
    }, [products, keyword, shapeFilter, alertFilter, sortBy]);

    // Cart Handlers
    const addToCart = (product: ProductItem, customQty?: number) => {
        const qty = customQty !== undefined ? customQty : (product.last_quantity > 0 ? product.last_quantity : 1000);
        setCart(prev => {
            const existingIdx = prev.findIndex(item => item.product.product_code === product.product_code && item.product.product_name === product.product_name);
            if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx].quantity += qty;
                toast.success(`${product.product_name} の数量を更新しました (${updated[existingIdx].quantity.toLocaleString()}${product.unit})`);
                return updated;
            } else {
                toast.success(`カートに追加しました: ${product.product_name}`);
                return [...prev, { product, quantity: qty }];
            }
        });
    };

    const updateCartQuantity = (index: number, delta: number) => {
        setCart(prev => {
            const updated = [...prev];
            const current = updated[index].quantity;
            const newQty = Math.max(0, current + delta);
            if (newQty === 0) {
                return updated.filter((_, i) => i !== index);
            }
            updated[index].quantity = newQty;
            return updated;
        });
    };

    const setCartItemQtyDirect = (index: number, val: number) => {
        setCart(prev => {
            const updated = [...prev];
            if (val <= 0) {
                return updated.filter((_, i) => i !== index);
            }
            updated[index].quantity = val;
            return updated;
        });
    };

    const removeFromCart = (index: number) => {
        setCart(prev => prev.filter((_, i) => i !== index));
    };

    const clearCart = () => {
        if (cart.length > 0 && confirm('カート内の全商品を削除しますか？')) {
            setCart([]);
            toast.success('カートをクリアしました');
        }
    };

    // Calculate Cart Totals
    const cartTotalAmount = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.quantity * item.product.latest_unit_price), 0);
    }, [cart]);

    const cartTotalCount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);

    // Generate Order Email Text
    const generateEmailText = (type: 'order' | 'quote') => {
        const title = type === 'order' ? '発注依頼' : '見積依頼';
        const dateStr = new Date().toLocaleDateString('ja-JP');
        const custName = selectedCustomer ? selectedCustomer.name : '得意先未指定';
        const custCode = selectedCustomer ? selectedCustomer.code : '';

        let text = `お疲れ様です。\n以下の通り、商品の${title}をお願いいたします。\n\n`;
        text += `【依頼日】${dateStr}\n`;
        text += `【得意先】${custName} (CD: ${custCode})\n\n`;
        text += `【${title}商品明細】\n`;

        cart.forEach((item, idx) => {
            const p = item.product;
            const subtotal = Math.round(item.quantity * p.latest_unit_price);
            text += `----------------------------------------\n`;
            text += `${idx + 1}. ${p.product_name}\n`;
            if (p.brand_name) text += `   銘柄: ${p.brand_name}\n`;
            text += `   商品コード: ${p.product_code}\n`;
            if (p.order_no_display && p.order_no_display !== '-') text += `   前回受注No: ${p.order_no_display}\n`;
            text += `   数量: ${item.quantity.toLocaleString()} ${p.unit}\n`;
            text += `   単価: ${p.latest_unit_price.toLocaleString()} 円 (小計: ${subtotal.toLocaleString()} 円)\n`;
        });

        text += `----------------------------------------\n`;
        text += `【合計金額】${Math.round(cartTotalAmount).toLocaleString()} 円 (全${cart.length}品目 / 総数量: ${cartTotalCount.toLocaleString()})\n\n`;
        text += `ご確認のほど、よろしくお願いいたします。`;

        return text;
    };

    const copyEmailToClipboard = (type: 'order' | 'quote') => {
        const text = generateEmailText(type);
        navigator.clipboard.writeText(text).then(() => {
            setCopiedEmail(true);
            toast.success(`${type === 'order' ? '発注' : '見積'}依頼メール文章をコピーしました！`);
            setTimeout(() => setCopiedEmail(false), 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            toast.error('クリップボードへのコピーに失敗しました');
        });
    };

    // 顧客名称のクリーンアップヘルパー（GitHub product-search-app準拠）
    const getCleanCompanyName = (name?: string) => {
        if (!name) return '取扱商品一覧';
        return name.replace(/[(（]株[)）]/g, '株式会社').trim();
    };

    const getFileSafeCompanyName = (name?: string) => {
        if (!name) return '商品一覧';
        return name.replace(/[(（]株[)）]/g, '').replace(/[\\/:*?"<>|]/g, '_').trim();
    };

    // 1. カタログ取扱商品一覧 Excel出力 (.xlsx)
    const exportToExcel = async () => {
        if (!selectedCustomer || filteredProducts.length === 0) {
            toast.error('エクスポート対象の商品がありません');
            return;
        }

        try {
            const compName = getCleanCompanyName(selectedCustomer.name);
            const fileSafeComp = getFileSafeCompanyName(selectedCustomer.name);
            const today = new Date();
            const dateStr = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月${String(today.getDate()).padStart(2, '0')}日`;
            const fileDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ASAHIPACK Daily Report System';
            workbook.lastModifiedBy = repName || '営業担当';
            workbook.created = today;

            const ws = workbook.addWorksheet('取扱商品一覧', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
            });

            // 列定義
            ws.columns = [
                { header: 'No.', key: 'no', width: 7 },
                { header: '受注№', key: 'order_no', width: 15 },
                { header: '商品コード', key: 'code', width: 14 },
                { header: '品名', key: 'name', width: 38 },
                { header: '銘柄・ブランド', key: 'brand', width: 20 },
                { header: '形状', key: 'shape', width: 11 },
                { header: '材質', key: 'material', width: 18 },
                { header: '色数', key: 'colors', width: 14 },
                { header: '量目', key: 'capacity', width: 11 },
                { header: '単位', key: 'unit', width: 8 },
                { header: '実効単価', key: 'unit_price', width: 13 },
                { header: '原単価', key: 'cost_price', width: 13 },
                { header: '粗利率', key: 'margin', width: 12 },
                { header: '最新受注日', key: 'order_date', width: 13 },
                { header: '最終売上日', key: 'sales_date', width: 13 },
                { header: '前回数量', key: 'last_qty', width: 12 },
                { header: '累計回数', key: 'orders_count', width: 11 },
                { header: '累計数量', key: 'total_qty', width: 14 },
                { header: '累計金額', key: 'total_amount', width: 16 },
                { header: '経過月数', key: 'elapsed', width: 11 },
                { header: 'アラート状態', key: 'alert', width: 15 },
                { header: '備考・仕様', key: 'notes', width: 24 }
            ];

            // 1行目: タイトル
            ws.mergeCells('A1:V1');
            const titleCell = ws.getCell('A1');
            titleCell.value = `【${compName} 様】 取扱商品一覧（材質・色数・量目明細付き）`;
            titleCell.font = { name: 'Meiryo', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF1E40AF' }
            };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(1).height = 36;

            // 2行目: メタデータ
            ws.mergeCells('A2:V2');
            const metaCell = ws.getCell('A2');
            metaCell.value = `出力日: ${dateStr}  |  得意先コード: ${selectedCustomer.code}  |  対象品目数: ${filteredProducts.length}品目${repName ? `  |  担当営業: ${repName}` : ''}`;
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

            // 4行目: テーブルヘッダー
            const headerRow = ws.getRow(4);
            headerRow.values = [
                'No.',
                '受注№',
                '商品コード',
                '品名',
                '銘柄・ブランド',
                '形状',
                '材質',
                '色数',
                '量目',
                '単位',
                '実効単価',
                '原単価',
                '粗利率',
                '最新受注日',
                '最終売上日',
                '前回数量',
                '累計回数',
                '累計数量',
                '累計金額',
                '経過月数',
                'アラート状態',
                '備考・仕様'
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

            filteredProducts.forEach((p, idx) => {
                const rowIdx = 5 + idx;
                const row = ws.getRow(rowIdx);
                const isEven = idx % 2 === 1;
                const baseBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

                const formatD = (dStr?: string | null) => dStr ? dStr.replace(/-/g, '/') : '';
                const alertLabel = p.alert_text || (p.alert_level === 'danger' ? '版落ち確定' : p.alert_level === 'warning' ? '版落ち予告' : '正常');
                const noteText = [p.finish_note, p.print_note].filter(Boolean).join(' / ');

                row.values = [
                    idx + 1,
                    p.order_no_display && p.order_no_display !== '-' ? p.order_no_display : '',
                    p.product_code,
                    p.product_name,
                    p.brand_name || '',
                    p.shape_type || (p.is_roll ? 'ロール' : '単袋'),
                    p.material_name || p.material_short || '',
                    p.color_display || '',
                    p.capacity_display || '',
                    p.unit || '',
                    p.latest_unit_price || 0,
                    p.latest_cost_price > 0 ? p.latest_cost_price : null,
                    p.margin_rate !== null ? p.margin_rate / 100 : null,
                    formatD(p.latest_order_date),
                    formatD(p.latest_sales_date),
                    p.last_quantity || 0,
                    p.orders_count || 0,
                    p.total_quantity || 0,
                    p.total_amount || 0,
                    p.elapsed_months !== null && p.elapsed_months !== undefined ? p.elapsed_months : null,
                    alertLabel,
                    noteText
                ];

                row.height = 22;
                row.font = { name: 'Meiryo', size: 9.5 };

                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = thinBorder;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: baseBg }
                    };

                    // 中央揃え: No(1), 受注No(2), 商品CD(3), 形状(6), 色数(8), サイズ(9), 単位(10), 受注日(14), 売上日(15)
                    if ([1, 2, 3, 6, 8, 9, 10, 14, 15].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if ([4, 5, 7, 22].includes(colNumber)) { // 左揃え: 品名(4), 銘柄(5), 材質(7), 備考(22)
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                    } else if (colNumber === 11 || colNumber === 12) { // 単価(11), 原単価(12)
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;"-"';
                    } else if (colNumber === 13) { // 粗利率(13)
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '0.0%;[Red]-0.0%;"-"';
                    } else if ([16, 17, 18].includes(colNumber)) { // 数量(16,17,18)
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '#,##0;[Red]-#,##0;"-"';
                    } else if (colNumber === 19) { // 金額(19)
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0;[Red]-¥#,##0;"-"';
                    } else if (colNumber === 20) { // 経過月数(20)
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '0"ヶ月"';
                    } else if (colNumber === 21) { // アラート(21)
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        if (p.alert_level === 'danger') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
                            cell.font = { name: 'Meiryo', size: 9.5, bold: true, color: { argb: 'FF991B1B' } };
                        } else if (p.alert_level === 'warning') {
                            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
                            cell.font = { name: 'Meiryo', size: 9.5, bold: true, color: { argb: 'FF92400E' } };
                        }
                    }
                });
            });

            // オートフィルター設定
            ws.autoFilter = {
                from: { row: 4, column: 1 },
                to: { row: 4 + filteredProducts.length, column: 22 }
            };

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `${fileSafeComp}_取扱商品一覧_${fileDateStr}.xlsx`);
            toast.success(`「${fileSafeComp}」の商品一覧Excelを出力しました`);
        } catch (err) {
            console.error('Excel export error:', err);
            toast.error('Excelファイルの出力に失敗しました');
        }
    };

    // 2. カート発注・見積リスト Excel出力 (.xlsx)
    const exportCartToExcel = async () => {
        if (cart.length === 0) {
            toast.error('カートに商品が入っていません');
            return;
        }

        try {
            const compName = selectedCustomer ? getCleanCompanyName(selectedCustomer.name) : '顧客';
            const fileSafeComp = selectedCustomer ? getFileSafeCompanyName(selectedCustomer.name) : '発注依頼';
            const today = new Date();
            const dateStr = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月${String(today.getDate()).padStart(2, '0')}日`;
            const fileDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ASAHIPACK Daily Report System';
            workbook.lastModifiedBy = repName || '営業担当';
            workbook.created = today;

            const ws = workbook.addWorksheet('発注依頼書', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
            });

            ws.columns = [
                { header: 'No.', key: 'no', width: 7 },
                { header: '受注№', key: 'order_no', width: 15 },
                { header: '商品コード', key: 'code', width: 14 },
                { header: '品名', key: 'name', width: 40 },
                { header: '銘柄・ブランド', key: 'brand', width: 20 },
                { header: '形状', key: 'shape', width: 11 },
                { header: '発注数量', key: 'qty', width: 14 },
                { header: '単位', key: 'unit', width: 8 },
                { header: '単価', key: 'price', width: 14 },
                { header: '発注小計(円)', key: 'subtotal', width: 18 },
                { header: '最新受注日', key: 'order_date', width: 14 }
            ];

            // 1行目: タイトル
            ws.mergeCells('A1:K1');
            const titleCell = ws.getCell('A1');
            titleCell.value = `【発注依頼書】 ${compName} 様`;
            titleCell.font = { name: 'Meiryo', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF059669' }
            };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(1).height = 36;

            // 2行目: メタデータ
            ws.mergeCells('A2:K2');
            const metaCell = ws.getCell('A2');
            metaCell.value = `出力日: ${dateStr}  |  得意先コード: ${selectedCustomer?.code || '-'}  |  発注品目数: ${cart.length}品目  |  合計金額: ¥${Math.round(cartTotalAmount).toLocaleString()}${repName ? `  |  担当営業: ${repName}` : ''}`;
            metaCell.font = { name: 'Meiryo', size: 10, color: { argb: 'FF065F46' } };
            metaCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFECFDF5' }
            };
            metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(2).height = 22;

            // 3行目: 空行
            ws.getRow(3).height = 8;

            // 4行目: テーブルヘッダー
            const headerRow = ws.getRow(4);
            headerRow.values = [
                'No.',
                '受注№',
                '商品コード',
                '品名',
                '銘柄・ブランド',
                '形状',
                '発注数量',
                '単位',
                '単価',
                '発注小計(円)',
                '最新受注日'
            ];
            headerRow.height = 28;
            headerRow.eachCell((cell) => {
                cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF10B981' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF6EE7B7' } },
                    bottom: { style: 'medium', color: { argb: 'FF065F46' } },
                    left: { style: 'thin', color: { argb: 'FF6EE7B7' } },
                    right: { style: 'thin', color: { argb: 'FF6EE7B7' } }
                };
            });

            const thinBorder: Partial<ExcelJS.Borders> = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            cart.forEach((item, idx) => {
                const rowIdx = 5 + idx;
                const row = ws.getRow(rowIdx);
                const isEven = idx % 2 === 1;
                const baseBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';
                const formatD = (dStr?: string | null) => dStr ? dStr.replace(/-/g, '/') : '';
                const subtotal = item.quantity * item.product.latest_unit_price;

                row.values = [
                    idx + 1,
                    item.product.order_no_display && item.product.order_no_display !== '-' ? item.product.order_no_display : '',
                    item.product.product_code,
                    item.product.product_name,
                    item.product.brand_name || '',
                    item.product.shape_type || (item.product.is_roll ? 'ロール' : '単袋'),
                    item.quantity,
                    item.product.unit || '',
                    item.product.latest_unit_price || 0,
                    subtotal,
                    formatD(item.product.latest_order_date)
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

                    if ([1, 2, 3, 6, 8, 11].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if ([4, 5].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                    } else if (colNumber === 7) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '#,##0';
                        cell.font = { name: 'Meiryo', size: 10, bold: true };
                    } else if (colNumber === 9) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;"-"';
                    } else if (colNumber === 10) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0;[Red]-¥#,##0;"-"';
                        cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FF065F46' } };
                    }
                });
            });

            // 合計行
            const totalRowIdx = 5 + cart.length;
            const totalRow = ws.getRow(totalRowIdx);
            ws.mergeCells(`A${totalRowIdx}:I${totalRowIdx}`);
            const totalLabelCell = ws.getCell(`A${totalRowIdx}`);
            totalLabelCell.value = '合計発注金額 (税込想定)';
            totalLabelCell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FF1E293B' } };
            totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
            totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
            totalLabelCell.border = {
                top: { style: 'thin', color: { argb: 'FF10B981' } },
                bottom: { style: 'double', color: { argb: 'FF065F46' } },
                left: { style: 'thin', color: { argb: 'FF10B981' } },
                right: { style: 'thin', color: { argb: 'FF10B981' } }
            };

            const totalValCell = ws.getCell(`J${totalRowIdx}`);
            totalValCell.value = { formula: `SUM(J5:J${totalRowIdx - 1})`, result: cartTotalAmount };
            totalValCell.numFmt = '¥#,##0';
            totalValCell.font = { name: 'Meiryo', size: 12, bold: true, color: { argb: 'FF065F46' } };
            totalValCell.alignment = { vertical: 'middle', horizontal: 'right' };
            totalValCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
            totalValCell.border = {
                top: { style: 'thin', color: { argb: 'FF10B981' } },
                bottom: { style: 'double', color: { argb: 'FF065F46' } },
                left: { style: 'thin', color: { argb: 'FF10B981' } },
                right: { style: 'thin', color: { argb: 'FF10B981' } }
            };

            const endCell = ws.getCell(`K${totalRowIdx}`);
            endCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
            endCell.border = {
                top: { style: 'thin', color: { argb: 'FF10B981' } },
                bottom: { style: 'double', color: { argb: 'FF065F46' } },
                left: { style: 'thin', color: { argb: 'FF10B981' } },
                right: { style: 'thin', color: { argb: 'FF10B981' } }
            };

            totalRow.height = 28;

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, `${fileSafeComp}_発注依頼書_${fileDateStr}.xlsx`);
            toast.success(`「${fileSafeComp}」の発注書Excelを出力しました`);
        } catch (err) {
            console.error('Cart Excel export error:', err);
            toast.error('発注書Excelファイルの出力に失敗しました');
        }
    };

    // Handle Design / Product Image Search & Modal Open
    const handleProductImageSearch = async (product: ProductItem, e?: React.MouseEvent) => {
        if (e) e.stopPropagation();
        setSelectedProductForImage(product);
        setShowImageModal(true);
        setCurrentImageIdx(0);

        // If product already has resolved images from Asahipack01 画像サーバー
        if (product.image_variants && product.image_variants.length > 0) {
            const initialList: DesignImage[] = product.image_variants.map(url => {
                const fname = url.split('/').pop() || '';
                return {
                    name: fname,
                    path: url,
                    folder: 'Asahipack01 商品画像サーバー',
                    mtime: Date.now() / 1000,
                    source: 'file_server'
                };
            });
            setImageResults(initialList);
            setSearchingImage(false);
            return;
        } else if (product.image_url) {
            const fname = product.image_name || product.image_url.split('/').pop() || '';
            setImageResults([{
                name: fname,
                path: product.image_url,
                folder: 'Asahipack01 商品画像サーバー',
                mtime: Date.now() / 1000,
                source: 'file_server'
            }]);
            setSearchingImage(false);
            return;
        }

        // Fallback: search in 企画課Web and 営業部デザインフォルダ
        setSearchingImage(true);
        setImageResults([]);

        const queriesToTry: string[] = [];
        if (product.latest_order_no) queriesToTry.push(String(product.latest_order_no));
        if (product.product_code) queriesToTry.push(String(product.product_code));

        let foundImages: DesignImage[] = [];
        for (const q of queriesToTry) {
            try {
                const res = await searchDesignImages(q);
                if (res.images && res.images.length > 0) {
                    foundImages = res.images;
                    break;
                }
            } catch (err) {
                console.error('Image search error for', q, err);
            }
        }

        setSearchingImage(false);
        setImageResults(foundImages);
        if (foundImages.length > 0) {
            const thumbUrl = getImageUrl(foundImages[0].path);
            setLoadedThumbnails(prev => ({
                ...prev,
                [product.product_code]: thumbUrl
            }));
        }
    };

    // Customer search & scope filtering
    const filteredCustomersList = useMemo(() => {
        let list = customers;
        if (customerScopeTab === 'rep' && repCustomersCount > 0) {
            list = list.filter(c => c.is_rep_customer);
        }
        if (customerSearchQuery.trim()) {
            const q = customerSearchQuery.toLowerCase().trim();
            const matched = list.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q));
            if (matched.length === 0 && customerScopeTab === 'rep') {
                return customers.filter(c => c.name.toLowerCase().includes(q) || c.code.includes(q)).slice(0, 50);
            }
            return matched.slice(0, 50);
        }
        return list.slice(0, 50);
    }, [customers, customerSearchQuery, customerScopeTab, repCustomersCount]);

    return (
        <div className="space-y-6 max-w-[1600px] mx-auto pb-16">
            {/* Top Customer Selector Bar */}
            <div className="bg-white rounded-xl border border-sf-border shadow-sm p-5">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white shadow-md">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-sf-text flex items-center gap-2">
                                <span>商品検索・発注カタログ</span>
                            </h1>
                            <p className="text-xs text-sf-text-weak mt-0.5">
                                得意先ごとの購入商品（AS/400基幹データ）を画像・単価・スペック付きで瞬時に検索・比較・発注作成
                            </p>
                        </div>
                    </div>

                    {/* Customer Dropdown / Selector */}
                    <div className="relative w-full lg:w-96">
                        <div
                            onClick={() => setShowCustomerDropdown(!showCustomerDropdown)}
                            className="flex items-center justify-between px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-lg cursor-pointer hover:bg-slate-100 transition-colors"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <Building2 size={16} className="text-blue-600 flex-shrink-0" />
                                {selectedCustomer ? (
                                    <div className="flex items-center gap-1.5 truncate">
                                        {selectedCustomer.is_rep_customer && (
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                                                担当
                                            </span>
                                        )}
                                        <span className="text-sm font-semibold text-gray-800 truncate">
                                            {selectedCustomer.name}
                                        </span>
                                        <span className="text-xs text-gray-500 font-mono shrink-0">(CD: {selectedCustomer.code})</span>
                                    </div>
                                ) : (
                                    <span className="text-sm text-gray-400">得意先を選択してください...</span>
                                )}
                            </div>
                            <ChevronDown size={16} className="text-gray-500 flex-shrink-0" />
                        </div>

                        {/* Customer Dropdown Modal */}
                        {showCustomerDropdown && (
                            <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-sf-border shadow-2xl z-50 max-h-96 flex flex-col overflow-hidden animate-fadeIn">
                                {/* Search input & Tab Selector */}
                                <div className="p-3 bg-slate-50 border-b border-gray-200 space-y-2">
                                    <div className="relative">
                                        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                        <input
                                            type="text"
                                            value={customerSearchQuery}
                                            onChange={e => setCustomerSearchQuery(e.target.value)}
                                            placeholder="得意先名またはコードで検索..."
                                            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                            autoFocus
                                        />
                                    </div>
                                    
                                    {/* Scope Tabs: 担当顧客 vs 全社 */}
                                    <div className="flex items-center gap-1.5 p-0.5 bg-slate-200/80 rounded-lg text-xs">
                                        <button
                                            type="button"
                                            onClick={() => setCustomerScopeTab('rep')}
                                            className={`flex-1 py-1 px-2 rounded-md font-bold text-center transition-all flex items-center justify-center gap-1 ${
                                                customerScopeTab === 'rep'
                                                    ? 'bg-white text-blue-700 shadow-xs'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            <Sparkles size={12} className="text-amber-500" />
                                            <span>{repName ? `${repName} 担当` : '担当顧客'} ({repCustomersCount}件)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCustomerScopeTab('all')}
                                            className={`flex-1 py-1 px-2 rounded-md font-bold text-center transition-all flex items-center justify-center gap-1 ${
                                                customerScopeTab === 'all'
                                                    ? 'bg-white text-slate-800 shadow-xs'
                                                    : 'text-gray-600 hover:text-gray-900'
                                            }`}
                                        >
                                            <Building2 size={12} className="text-gray-500" />
                                            <span>全社顧客 ({customers.length}件)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Customer List */}
                                <div className="overflow-y-auto flex-1 divide-y divide-gray-100 max-h-64">
                                    {filteredCustomersList.length === 0 ? (
                                        <div className="p-6 text-center text-xs text-gray-400">
                                            該当する得意先が見つかりませんでした
                                        </div>
                                    ) : (
                                        filteredCustomersList.map(c => (
                                            <div
                                                key={c.code}
                                                onClick={() => {
                                                    setSelectedCustomer(c);
                                                    setShowCustomerDropdown(false);
                                                    setCustomerSearchQuery('');
                                                }}
                                                className={`p-3 text-xs cursor-pointer flex justify-between items-center hover:bg-blue-50/80 transition-colors ${
                                                    selectedCustomer?.code === c.code ? 'bg-blue-50 font-bold border-l-4 border-blue-600 pl-2' : 'text-gray-700'
                                                }`}
                                            >
                                                <div className="min-w-0 pr-2">
                                                    <div className="font-semibold text-sf-text flex items-center gap-1.5 truncate">
                                                        {c.is_rep_customer && (
                                                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 shrink-0">
                                                                ★ 担当
                                                            </span>
                                                        )}
                                                        <span className="truncate">{c.name}</span>
                                                        {c.rank && (
                                                            <span className="text-[10px] px-1.5 py-0.2 bg-gray-100 text-gray-600 rounded shrink-0">
                                                                {c.rank}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="text-[11px] text-gray-400 font-mono mt-0.5 flex items-center gap-1.5 flex-wrap">
                                                        <span>CD: {c.code}</span>
                                                        <span>|</span>
                                                        <span>商品: {c.product_count}品目</span>
                                                        {c.primary_rep && !c.is_rep_customer && (
                                                            <>
                                                                <span>|</span>
                                                                <span className="text-gray-500">担当: {c.primary_rep}</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <div className="font-bold text-gray-800 font-mono">
                                                        {Number(c.total_sales).toLocaleString()}円
                                                    </div>
                                                    <div className="text-[10px] text-gray-400">
                                                        最新: {c.last_sales_date || '-'}
                                                    </div>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Selected Customer Summary Stats */}
                {selectedCustomer && (
                    <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[11px] text-gray-500 block">取扱登録商品数</span>
                            <span className="text-lg font-bold text-slate-800">{products.length} <span className="text-xs font-normal">品目</span></span>
                        </div>
                        <div className="bg-blue-50 p-2.5 rounded-lg border border-blue-200">
                            <span className="text-[11px] text-blue-700 block">アクティブ商品</span>
                            <span className="text-lg font-bold text-blue-800">
                                {products.filter(p => p.alert_level === 'none').length} <span className="text-xs font-normal">品目</span>
                            </span>
                        </div>
                        <div className="bg-amber-50 p-2.5 rounded-lg border border-amber-200">
                            <span className="text-[11px] text-amber-700 block">経過注意 (22ヶ月〜)</span>
                            <span className="text-lg font-bold text-amber-800">
                                {products.filter(p => p.alert_level === 'warning').length} <span className="text-xs font-normal">品目</span>
                            </span>
                        </div>
                        <div className="bg-rose-50 p-2.5 rounded-lg border border-rose-200">
                            <span className="text-[11px] text-rose-700 block">版落ち危険 (24ヶ月〜)</span>
                            <span className="text-lg font-bold text-rose-800">
                                {products.filter(p => p.alert_level === 'danger').length} <span className="text-xs font-normal">品目</span>
                            </span>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[11px] text-gray-500 block">顧客カルテを開く</span>
                            <Link
                                href={`/customers/detail?code=${selectedCustomer.code}`}
                                className="inline-flex items-center gap-1 text-sm font-bold text-blue-600 hover:underline mt-0.5"
                            >
                                <span>詳細カルテ</span>
                                <ExternalLink size={14} />
                            </Link>
                        </div>
                        <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                            <span className="text-[11px] text-gray-500 block">最終取引日</span>
                            <span className="text-sm font-semibold text-gray-700">{selectedCustomer.last_sales_date || '-'}</span>
                        </div>
                    </div>
                )}
            </div>

            {/* Filter & Control Bar */}
            <div className="bg-white rounded-xl border border-sf-border shadow-sm p-4 space-y-3">
                <div className="flex flex-col md:flex-row items-center justify-between gap-3">
                    {/* Search Input */}
                    <div className="relative flex-1 w-full">
                        <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                        <input
                            type="text"
                            value={keyword}
                            onChange={e => setKeyword(e.target.value)}
                            placeholder="商品名称、銘柄・ブランド、商品コード、受注Noでキーワード検索..."
                            className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        />
                        {keyword && (
                            <button
                                onClick={() => setKeyword('')}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>

                    {/* View Switcher & Action Buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
                        {/* Direct Destination Selector (when available) */}
                        {directDests.length > 0 && (
                            <div className="relative flex items-center gap-1.5">
                                <span className="text-xs font-bold text-gray-500 flex items-center gap-1 shrink-0">
                                    <Building2 size={13} className="text-indigo-600" />
                                    直送先:
                                </span>
                                <div className="relative">
                                    <select
                                        value={selectedDirectDest}
                                        onChange={e => setSelectedDirectDest(e.target.value)}
                                        className={`pl-2.5 pr-7 py-2 text-xs border rounded-lg appearance-none font-medium cursor-pointer transition-all ${
                                            selectedDirectDest !== 'all'
                                                ? 'bg-indigo-50 border-indigo-300 text-indigo-900 font-bold ring-2 ring-indigo-500/20'
                                                : 'bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100'
                                        }`}
                                    >
                                        <option value="all">すべての直送先 ({directDests.length}箇所)</option>
                                        {directDests.map((d, i) => (
                                            <option key={i} value={d.name}>
                                                {d.name} ({d.order_count}件)
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                </div>
                                {selectedDirectDest !== 'all' && (
                                    <button
                                        onClick={() => setSelectedDirectDest('all')}
                                        className="p-1 text-[11px] text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded flex items-center gap-0.5"
                                        title="直送先絞り込みを解除"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Sort Dropdown */}
                        <div className="relative">
                            <select
                                value={sortBy}
                                onChange={e => setSortBy(e.target.value)}
                                className="pl-3 pr-8 py-2 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 appearance-none font-medium cursor-pointer"
                            >
                                <option value="latest_date">最新受注日順</option>
                                <option value="price_desc">単価が高い順</option>
                                <option value="price_asc">単価が安い順</option>
                                <option value="orders_count">発注回数順</option>
                                <option value="elapsed_desc">経過月数が長い順</option>
                                <option value="name">商品名順</option>
                            </select>
                            <ArrowUpDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                        </div>

                        {/* View Switch Buttons */}
                        <div className="flex items-center bg-gray-100 p-0.5 rounded-lg border border-gray-200">
                            <button
                                onClick={() => setViewMode('grid')}
                                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                                    viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                                title="カードグリッド表示"
                            >
                                <Grid size={16} />
                            </button>
                            <button
                                onClick={() => setViewMode('table')}
                                className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition-colors ${
                                    viewMode === 'table' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                                }`}
                                title="詳細テーブル表示"
                            >
                                <List size={16} />
                            </button>
                        </div>

                        {/* Export Excel Button */}
                        <button
                            onClick={exportToExcel}
                            className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                            title="絞り込んだ商品をExcel出力 (.xlsx)"
                        >
                            <FileSpreadsheet size={15} />
                            <span className="hidden sm:inline">Excel出力</span>
                        </button>

                        {/* Cart Button */}
                        <button
                            onClick={() => setShowCartModal(true)}
                            className="relative px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                        >
                            <ShoppingCart size={16} />
                            <span>発注カート</span>
                            {cart.length > 0 && (
                                <span className="px-1.5 py-0.2 bg-amber-400 text-slate-900 text-[11px] font-black rounded-full animate-bounce">
                                    {cart.length}
                                </span>
                            )}
                        </button>
                    </div>
                </div>

                {/* Quick Filters */}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                    <span className="text-xs font-semibold text-gray-500 flex items-center gap-1 mr-1">
                        <Filter size={13} />
                        絞り込み:
                    </span>

                    {/* Shape Filters */}
                    <button
                        onClick={() => setShapeFilter('all')}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                            shapeFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        全形状 ({products.length})
                    </button>
                    <button
                        onClick={() => setShapeFilter('roll')}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                            shapeFilter === 'roll' ? 'bg-purple-600 text-white' : 'bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200'
                        }`}
                    >
                        ロール製品のみ
                    </button>
                    <button
                        onClick={() => setShapeFilter('bag')}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                            shapeFilter === 'bag' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200'
                        }`}
                    >
                        単袋製品のみ
                    </button>

                    <div className="h-4 w-px bg-gray-200 mx-1" />

                    {/* Alert Filters */}
                    <button
                        onClick={() => setAlertFilter('all')}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                            alertFilter === 'all' ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        全ステータス
                    </button>
                    <button
                        onClick={() => setAlertFilter('warning')}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                            alertFilter === 'warning' ? 'bg-amber-500 text-white' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200'
                        }`}
                    >
                        ⚠️ 経過注意 (22ヶ月〜)
                    </button>
                    <button
                        onClick={() => setAlertFilter('danger')}
                        className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
                            alertFilter === 'danger' ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                        }`}
                    >
                        🚨 版落ち注意 (24ヶ月〜)
                    </button>

                    <span className="text-xs text-gray-400 ml-auto font-mono">
                        表示中: {filteredProducts.length} 件
                    </span>
                </div>
            </div>

            {/* Products Main View */}
            {loading ? (
                <div className="py-20 text-center text-gray-400 bg-white rounded-xl border border-sf-border">
                    <RefreshCw className="animate-spin mx-auto mb-3 text-blue-500" size={32} />
                    <p className="font-semibold text-sm">商品カタログを読み込んでいます...</p>
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="py-20 text-center text-gray-400 bg-white rounded-xl border border-sf-border">
                    <ShoppingBag className="mx-auto mb-3 text-gray-300" size={48} />
                    <p className="font-semibold text-base text-gray-600">該当する商品が見つかりませんでした</p>
                    <p className="text-xs text-gray-400 mt-1">検索キーワードまたは絞り込み条件を変更してください</p>
                </div>
            ) : viewMode === 'grid' ? (
                /* Grid View (Amazon Style Cards) */
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {filteredProducts.map((p, idx) => (
                        <div
                            key={idx}
                            className="bg-white rounded-xl border border-sf-border shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group hover:border-blue-300"
                        >
                            {/* Card Header Tag Bar */}
                            <div className="px-3.5 py-2 bg-slate-50 border-b border-gray-100 flex justify-between items-center text-[11px]">
                                <span className="font-mono text-gray-500 font-semibold">
                                    {p.order_no_display && p.order_no_display !== '-' ? `No.${p.order_no_display}` : `CD: ${p.product_code}`}
                                </span>
                                {p.alert_level === 'danger' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-rose-100 text-rose-800 font-bold rounded text-[10px] border border-rose-200">
                                        🚨 {p.alert_text}
                                    </span>
                                ) : p.alert_level === 'warning' ? (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 font-bold rounded text-[10px] border border-amber-200">
                                        ⚠️ {p.alert_text}
                                    </span>
                                ) : (
                                    <span className="text-emerald-700 font-medium text-[10px]">
                                        最終: {p.latest_sales_date || '-'}
                                    </span>
                                )}
                            </div>

                            {/* Image Placeholder / Visual */}
                            <div
                                onClick={(e) => handleProductImageSearch(p, e)}
                                className="h-44 bg-slate-50 flex items-center justify-center relative border-b border-gray-100 p-2 cursor-pointer group/img overflow-hidden transition-colors hover:bg-blue-50/40"
                                title="クリックしてデザイン・カンプ画像を検索・確認"
                            >
                                {p.image_url ? (
                                    <img
                                        src={p.image_url}
                                        alt={p.product_name}
                                        className="w-full h-full object-contain group-hover/img:scale-105 transition-transform"
                                        loading="lazy"
                                    />
                                ) : loadedThumbnails[p.product_code] ? (
                                    <img
                                        src={loadedThumbnails[p.product_code]}
                                        alt={p.product_name}
                                        className="w-full h-full object-contain group-hover/img:scale-105 transition-transform"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="text-center">
                                        <div className="w-16 h-16 mx-auto bg-white rounded-xl shadow-sm border border-gray-200 flex items-center justify-center text-slate-400 group-hover/img:scale-105 group-hover/img:border-blue-400 transition-all">
                                            {p.is_roll ? <Layers size={28} className="text-purple-500" /> : <ShoppingBag size={28} className="text-blue-500" />}
                                        </div>
                                        <span className="text-[10px] text-gray-400 block mt-1.5 font-mono">{p.product_code}</span>
                                    </div>
                                )}
                                <span className={`absolute top-2 left-2 px-2 py-0.5 rounded text-[10px] font-bold shadow-sm z-10 ${
                                    p.is_roll ? 'bg-purple-100/95 text-purple-800 border border-purple-200' : 'bg-blue-100/95 text-blue-800 border border-blue-200'
                                }`}>
                                    {p.shape_type || (p.is_roll ? 'ロール' : '単袋')}
                                </span>

                                {p.image_variants && p.image_variants.length > 1 && (
                                    <span className="absolute bottom-2 right-2 px-1.5 py-0.2 bg-black/60 text-white rounded text-[10px] font-mono z-10 backdrop-blur-sm">
                                        +{p.image_variants.length}枚
                                    </span>
                                )}

                                {/* Hover Overlay */}
                                <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-bold backdrop-blur-[1px]">
                                    <Eye size={16} />
                                    <span>画像を見る</span>
                                </div>
                            </div>

                            {/* Content Body */}
                            <div className="p-3.5 flex-1 flex flex-col justify-between space-y-3">
                                <div>
                                    <h3 className="font-bold text-sm text-sf-text line-clamp-2 leading-snug group-hover:text-blue-600 transition-colors">
                                        {p.product_name}
                                    </h3>
                                    {p.brand_name && (
                                        <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[11px] rounded border border-blue-200 max-w-full truncate">
                                            <Tag size={10} />
                                            <span className="truncate">{p.brand_name}</span>
                                        </div>
                                    )}
                                    {/* Material, Color & Capacity Specs */}
                                    {(p.material_name || p.color_display || p.capacity_display) && (
                                        <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[10.5px]">
                                            {p.material_name && (
                                                <span className="px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded border border-slate-200 font-medium">
                                                    {p.material_name}
                                                </span>
                                            )}
                                            {p.color_display && (
                                                <span className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 font-medium">
                                                    🎨 {p.color_display}
                                                </span>
                                            )}
                                            {p.capacity_display && (
                                                <span className="px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200 font-mono font-medium">
                                                    ⚖️ {p.capacity_display}
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Pricing & Spec */}
                                <div className="space-y-1.5 pt-2 border-t border-gray-100">
                                    <div className="flex items-baseline justify-between">
                                        <span className="text-xs text-gray-400">実効単価</span>
                                        <div className="text-right">
                                            <span className="text-xl font-extrabold text-sf-text font-mono">
                                                {p.latest_unit_price.toLocaleString()}
                                            </span>
                                            <span className="text-xs text-gray-500 ml-1">円/{p.unit}</span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-gray-500">
                                        <span>前回発注: <strong className="text-gray-700 font-mono">{p.last_quantity.toLocaleString()} {p.unit}</strong></span>
                                        <span>累計: <strong className="text-gray-700 font-mono">{p.orders_count}回</strong></span>
                                    </div>
                                </div>

                                {/* Add to Cart Action Button */}
                                <button
                                    onClick={() => addToCart(p)}
                                    className="w-full py-2 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold text-xs rounded-lg flex items-center justify-center gap-1.5 shadow-sm active:scale-95 transition-all"
                                >
                                    <ShoppingCart size={14} />
                                    <span>発注カートに追加</span>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                /* Detailed Table View */
                <div className="bg-white rounded-xl border border-sf-border shadow-sm overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-gray-50 text-sf-text-weak uppercase border-b border-sf-border">
                                <tr>
                                    <th className="py-3 px-3 font-semibold text-center">画像</th>
                                    <th className="py-3 px-3 font-semibold">売上日 (納期)</th>
                                    <th className="py-3 px-3 font-semibold">受注No</th>
                                    <th className="py-3 px-3 font-semibold">商品コード</th>
                                    <th className="py-3 px-4 font-semibold">商品名称 / 銘柄・ブランド</th>
                                    <th className="py-3 px-3 font-semibold">材質</th>
                                    <th className="py-3 px-3 font-semibold">色数</th>
                                    <th className="py-3 px-3 font-semibold">量目</th>
                                    <th className="py-3 px-3 font-semibold">形状</th>
                                    <th className="py-3 px-3 font-semibold text-right">前回数量</th>
                                    <th className="py-3 px-3 font-semibold text-right">実効単価</th>
                                    <th className="py-3 px-3 font-semibold text-right">原単価</th>
                                    <th className="py-3 px-3 font-semibold text-right">粗利率</th>
                                    <th className="py-3 px-3 font-semibold text-center">経過状態</th>
                                    <th className="py-3 px-3 font-semibold text-center">カート</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredProducts.map((p, idx) => (
                                    <tr key={idx} className="hover:bg-blue-50/40 transition-colors">
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <button
                                                onClick={(e) => handleProductImageSearch(p, e)}
                                                className="p-0.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition-colors inline-flex items-center justify-center"
                                                title="画像を表示"
                                            >
                                                {p.image_url ? (
                                                    <img
                                                        src={p.image_url}
                                                        alt=""
                                                        className="w-8 h-8 object-contain rounded border border-gray-200 bg-white shadow-xs"
                                                        loading="lazy"
                                                    />
                                                ) : loadedThumbnails[p.product_code] ? (
                                                    <img
                                                        src={loadedThumbnails[p.product_code]}
                                                        alt=""
                                                        className="w-8 h-8 object-contain rounded border border-gray-200 bg-white shadow-xs"
                                                        loading="lazy"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-blue-400 hover:text-blue-500">
                                                        <Eye size={14} />
                                                    </div>
                                                )}
                                            </button>
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-gray-700 whitespace-nowrap font-medium">
                                            {p.latest_sales_date || p.latest_order_date || '-'}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-gray-700 whitespace-nowrap font-medium">
                                            {p.order_no_display}
                                        </td>
                                        <td className="py-2.5 px-3 font-mono text-gray-500 whitespace-nowrap">
                                            {p.product_code}
                                        </td>
                                        <td className="py-2.5 px-4">
                                            <div className="font-medium text-sf-text">{p.product_name}</div>
                                            {p.brand_name && (
                                                <span className="inline-block mt-0.5 px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-200">
                                                    🏷️ {p.brand_name}
                                                </span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className="text-gray-700 font-medium">
                                                {p.material_name || p.material_short || '-'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className="text-indigo-700 font-medium">
                                                {p.color_display || '-'}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap font-mono text-amber-800 font-semibold">
                                            {p.capacity_display || '-'}
                                        </td>
                                        <td className="py-2.5 px-3 whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                                                p.is_roll ? 'bg-purple-100 text-purple-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {p.shape_type || (p.is_roll ? 'ロール' : '単袋')}
                                            </span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-medium whitespace-nowrap">
                                            {p.last_quantity.toLocaleString()} {p.unit}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono font-bold text-sf-text whitespace-nowrap">
                                            {p.latest_unit_price.toLocaleString()}円
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-gray-500 whitespace-nowrap">
                                            {p.latest_cost_price > 0 ? `${p.latest_cost_price.toLocaleString()}円` : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-gray-600 whitespace-nowrap">
                                            {p.margin_rate !== null ? `${p.margin_rate}%` : '-'}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            {p.alert_level === 'danger' ? (
                                                <span className="px-2 py-0.5 bg-rose-100 text-rose-800 rounded font-bold text-[10px]">
                                                    🚨 版落ち ({p.elapsed_months}ヶ月)
                                                </span>
                                            ) : p.alert_level === 'warning' ? (
                                                <span className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded font-bold text-[10px]">
                                                    ⚠️ 注意 ({p.elapsed_months}ヶ月)
                                                </span>
                                            ) : (
                                                <span className="text-gray-400 text-[10px]">正常 ({p.elapsed_months}ヶ月)</span>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => addToCart(p)}
                                                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded text-xs shadow-sm"
                                            >
                                                + カート
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Cart Modal */}
            {showCartModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl border border-sf-border shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-150">
                        {/* Modal Header */}
                        <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
                            <div className="flex items-center gap-2.5">
                                <ShoppingCart size={20} className="text-amber-400" />
                                <h3 className="font-bold text-base">
                                    発注・見積カート
                                    <span className="text-xs text-gray-300 font-normal ml-2">
                                        ({selectedCustomer ? selectedCustomer.name : '得意先未選択'})
                                    </span>
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowCartModal(false)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-5 overflow-y-auto flex-1 space-y-4">
                            {cart.length === 0 ? (
                                <div className="text-center py-12 text-gray-400">
                                    <ShoppingCart size={48} className="mx-auto mb-3 text-gray-300" />
                                    <p className="font-bold text-sm text-gray-600">カートに商品が入っていません</p>
                                    <p className="text-xs text-gray-400 mt-1">カタログから商品を選んで「カートに追加」してください</p>
                                </div>
                            ) : (
                                <div className="divide-y divide-gray-100 border border-gray-200 rounded-xl overflow-hidden">
                                    {cart.map((item, idx) => (
                                        <div key={idx} className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-50/60 transition-colors">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-mono text-xs text-gray-400 font-semibold">#{idx + 1}</span>
                                                    <h4 className="font-bold text-sm text-sf-text truncate">{item.product.product_name}</h4>
                                                </div>
                                                <div className="text-xs text-gray-500 mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                                                    {item.product.brand_name && <span>🏷️ {item.product.brand_name}</span>}
                                                    <span>単価: <strong>{item.product.latest_unit_price.toLocaleString()}円</strong></span>
                                                    <span>コード: {item.product.product_code}</span>
                                                </div>
                                            </div>

                                            {/* Quantity Adjuster */}
                                            <div className="flex items-center gap-3 w-full sm:w-auto justify-between">
                                                <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white shadow-sm">
                                                    <button
                                                        onClick={() => updateCartQuantity(idx, -100)}
                                                        className="px-2 py-1.5 hover:bg-gray-100 text-gray-600 border-r border-gray-200"
                                                        title="100減らす"
                                                    >
                                                        <Minus size={14} />
                                                    </button>
                                                    <input
                                                        type="number"
                                                        value={item.quantity}
                                                        onChange={e => setCartItemQtyDirect(idx, parseInt(e.target.value) || 0)}
                                                        className="w-20 px-2 py-1 text-center font-mono font-bold text-xs text-gray-800 focus:outline-none"
                                                    />
                                                    <button
                                                        onClick={() => updateCartQuantity(idx, 100)}
                                                        className="px-2 py-1.5 hover:bg-gray-100 text-gray-600 border-l border-gray-200"
                                                        title="100増やす"
                                                    >
                                                        <Plus size={14} />
                                                    </button>
                                                </div>
                                                <span className="text-xs text-gray-500 font-medium">{item.product.unit}</span>

                                                {/* Subtotal */}
                                                <div className="text-right min-w-[90px]">
                                                    <span className="text-sm font-bold text-gray-900 font-mono block">
                                                        {Math.round(item.quantity * item.product.latest_unit_price).toLocaleString()}円
                                                    </span>
                                                </div>

                                                <button
                                                    onClick={() => removeFromCart(idx)}
                                                    className="p-1.5 text-gray-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 transition-colors"
                                                    title="削除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Summary Bar */}
                            {cart.length > 0 && (
                                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                                    <button
                                        onClick={clearCart}
                                        className="text-xs text-gray-500 hover:text-rose-600 underline font-medium"
                                    >
                                        カートをすべて空にする
                                    </button>
                                    <div className="text-right">
                                        <span className="text-xs text-gray-500 mr-2">合計金額 ({cart.length}品目):</span>
                                        <span className="text-2xl font-black text-sf-text font-mono">
                                            {Math.round(cartTotalAmount).toLocaleString()}
                                            <span className="text-sm font-normal text-gray-600 ml-1">円</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Modal Footer Actions */}
                        {cart.length > 0 && (
                            <div className="p-4 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row gap-2.5 justify-end items-center flex-wrap">
                                <button
                                    onClick={exportCartToExcel}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                                    title="スタイリング・計算式付きの発注書Excelを出力します"
                                >
                                    <FileSpreadsheet size={15} />
                                    <span>発注書Excel出力</span>
                                </button>
                                <button
                                    onClick={() => copyEmailToClipboard('quote')}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-100 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                                >
                                    <Copy size={15} />
                                    <span>見積依頼文をコピー</span>
                                </button>
                                <button
                                    onClick={() => copyEmailToClipboard('order')}
                                    className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md transition-all"
                                >
                                    {copiedEmail ? <Check size={16} /> : <Copy size={16} />}
                                    <span>発注依頼メール文章をコピー</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Design & Product Image Preview Modal */}
            {showImageModal && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-gray-200">
                        {/* Image Modal Header */}
                        <div className="p-4 px-6 border-b border-gray-100 flex justify-between items-center bg-slate-900 text-white">
                            <div className="flex items-center gap-2.5 truncate">
                                <Eye size={20} className="text-blue-400 flex-shrink-0" />
                                <div className="truncate">
                                    <h3 className="font-bold text-sm truncate">{selectedProductForImage?.product_name}</h3>
                                    <p className="text-[11px] text-gray-400 font-mono">
                                        受注No: {selectedProductForImage?.order_no_display || '-'} | CD: {selectedProductForImage?.product_code}
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

                        {/* Image Modal Body */}
                        <div className="p-6 overflow-y-auto flex-1 bg-slate-50 flex flex-col items-center justify-center min-h-[350px]">
                            {searchingImage ? (
                                <div className="text-center py-12">
                                    <RefreshCw className="animate-spin text-blue-600 mx-auto mb-3" size={36} />
                                    <p className="text-sm font-semibold text-gray-700">企画課Webビューア＆社内フォルダから画像を検索中...</p>
                                    <p className="text-xs text-gray-400 mt-1">受注No: {selectedProductForImage?.latest_order_no || selectedProductForImage?.product_code}</p>
                                </div>
                            ) : imageResults.length === 0 ? (
                                <div className="text-center py-12 max-w-md">
                                    <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
                                    <h4 className="font-bold text-gray-700 text-base">画像が見つかりませんでした</h4>
                                    <p className="text-xs text-gray-500 mt-2 leading-relaxed">
                                        企画課Webビューアおよび営業部デザイン共有フォルダに、この受注No・商品コード（{selectedProductForImage?.order_no_display || selectedProductForImage?.product_code}）に該当する画像データは登録されていません。
                                    </p>
                                </div>
                            ) : (
                                <div className="w-full flex flex-col items-center space-y-4">
                                    {/* Main Selected Image */}
                                    <div className="relative max-h-[480px] max-w-full flex items-center justify-center bg-white rounded-xl shadow-sm border border-gray-200 p-2 overflow-hidden">
                                        {imageResults[currentImageIdx]?.path ? (
                                            <img
                                                src={getImageUrl(imageResults[currentImageIdx].path)}
                                                alt={imageResults[currentImageIdx].name}
                                                className="max-h-[440px] max-w-full object-contain rounded-lg shadow-inner"
                                            />
                                        ) : (
                                            <div className="p-12 text-gray-400">画像を表示できません</div>
                                        )}
                                    </div>

                                    {/* Image Info & Download */}
                                    <div className="w-full flex flex-col sm:flex-row items-center justify-between gap-2 px-2 text-xs">
                                        <div className="text-gray-600 truncate">
                                            <span className="font-bold text-gray-800">{imageResults[currentImageIdx]?.name}</span>
                                            {imageResults[currentImageIdx]?.folder && (
                                                <span className="ml-2 text-gray-400">({imageResults[currentImageIdx].folder})</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-shrink-0">
                                            <span className="font-mono text-gray-400 text-[11px]">
                                                {currentImageIdx + 1} / {imageResults.length}
                                            </span>
                                            {imageResults[currentImageIdx]?.path && (
                                                <a
                                                    href={getImageUrl(imageResults[currentImageIdx].path)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="px-3 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg font-semibold flex items-center gap-1 border border-blue-200 transition-colors"
                                                >
                                                    <Download size={13} />
                                                    <span>拡大・保存</span>
                                                </a>
                                            )}
                                        </div>
                                    </div>

                                    {/* Thumbnail Strip (if multiple) */}
                                    {imageResults.length > 1 && (
                                        <div className="flex gap-2 overflow-x-auto p-2 max-w-full bg-white rounded-lg border border-gray-200">
                                            {imageResults.map((img, i) => (
                                                <button
                                                    key={i}
                                                    onClick={() => setCurrentImageIdx(i)}
                                                    className={`w-14 h-14 rounded-lg overflow-hidden border-2 flex-shrink-0 transition-all ${
                                                        currentImageIdx === i ? 'border-blue-600 scale-105 shadow-md' : 'border-gray-200 opacity-70 hover:opacity-100'
                                                    }`}
                                                >
                                                    <img src={getImageUrl(img.path)} alt="" className="w-full h-full object-cover" />
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function CatalogPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-gray-400">読み込み中...</div>}>
            <CatalogContent />
        </Suspense>
    );
}
