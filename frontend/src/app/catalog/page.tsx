'use client';

import { useEffect, useState, useMemo, useRef, Suspense, useTransition } from 'react';
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
    Tag,
    Building2,
    ChevronDown,
    X,
    ExternalLink,
    RefreshCw,
    Sparkles,
    FileSpreadsheet,
    Eye,
    Layers,
    MapPin,
    Lock,
    Loader2,
    Mail
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
    direct_customer_name?: string;
    direct_customer_code?: string;
    classification?: string;
    classification_display?: string;
    jan_code?: string;
    product_unit_price?: number;
    product_cost_price?: number;
    print_fee?: number;
    print_cost?: number;
    print_content?: string;
    is_reorder_due?: boolean;
    reorder_cycle_days?: number | null;
    days_since_last_order?: number | null;
    reorder_suggest_text?: string;
}

interface CartItem {
    product: ProductItem;
    quantity: number;
    customer_code?: string;
    customer_name?: string;
}

function CatalogContent() {
    const searchParams = useSearchParams();
    const initialCode = searchParams.get('customer_code') || '';
    const { selectedFile } = useFile();

    // States
    const [customers, setCustomers] = useState<CustomerOption[]>([]);
    const [customersLoading, setCustomersLoading] = useState(true);
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
    const [customerSearchQuery, setCustomerSearchQuery] = useState('');
    const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
    const [repName, setRepName] = useState<string>('');
    const [repCustomersCount, setRepCustomersCount] = useState<number>(0);
    const [customerScopeTab, setCustomerScopeTab] = useState<'rep' | 'all'>('rep');

    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [directDests, setDirectDests] = useState<{ name: string; code: string; sample_customer?: string; order_count: number }[]>([]);
    const [selectedDirectDest, setSelectedDirectDest] = useState<string>('all');
    const [directDestQuery, setDirectDestQuery] = useState<string>('');
    const [showDirectDestDropdown, setShowDirectDestDropdown] = useState<boolean>(false);

    // 直送先のキーワード検索・サジェスト絞り込み
    const filteredDirectDests = useMemo(() => {
        if (!directDestQuery.trim()) return directDests;
        const q = directDestQuery.toLowerCase().trim();
        return directDests.filter(d =>
            (d.name && d.name.toLowerCase().includes(q)) ||
            (d.code && d.code.toLowerCase().includes(q))
        );
    }, [directDests, directDestQuery]);

    // Filters & Search Loading States
    const [displayedKeyword, setDisplayedKeyword] = useState('');
    const [keyword, setKeyword] = useState('');
    const [searchDebounceLoading, setSearchDebounceLoading] = useState(false);
    const [isFiltering, startTransition] = useTransition();
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

    const handleKeywordChange = (val: string) => {
        setDisplayedKeyword(val);
        setSearchDebounceLoading(true);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        debounceTimerRef.current = setTimeout(() => {
            startTransition(() => {
                setKeyword(val);
                setSearchDebounceLoading(false);
            });
        }, 180);
    };

    const handleClearKeyword = () => {
        setDisplayedKeyword('');
        setKeyword('');
        setSearchDebounceLoading(false);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
    };

    const isSearching = loading || isFiltering || searchDebounceLoading;

    const [shapeFilter, setShapeFilter] = useState('all');
    const [alertFilter, setAlertFilter] = useState<'all' | 'warning' | 'danger' | 'reorder' | 'alert_all'>('all');
    const [sortBy, setSortBy] = useState('latest_date');
    const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

    // 再発注推奨（発注サイクル到来）商品の件数
    const reorderDueCount = useMemo(() => {
        return products.filter(p => p.is_reorder_due).length;
    }, [products]);

    // Cart
    const [cart, setCart] = useState<CartItem[]>([]);
    const [cartCustomer, setCartCustomer] = useState<{ code: string; name: string } | null>(null);
    const [showCartModal, setShowCartModal] = useState(false);
    const [copiedEmail, setCopiedEmail] = useState(false);

    // Image Preview Modal States
    const [loadedThumbnails, setLoadedThumbnails] = useState<Record<string, string>>({});
    const [selectedProductForImage, setSelectedProductForImage] = useState<ProductItem | null>(null);
    const [showImageModal, setShowImageModal] = useState(false);
    const [imageResults, setImageResults] = useState<DesignImage[]>([]);
    const [searchingImage, setSearchingImage] = useState(false);
    const [currentImageIdx, setCurrentImageIdx] = useState(0);

    // Excel Export Dropdown States
    const [showExcelDropdown, setShowExcelDropdown] = useState(false);
    const excelDropdownRef = useRef<HTMLDivElement>(null);
    const [showCartExcelDropdown, setShowCartExcelDropdown] = useState(false);
    const cartExcelDropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (excelDropdownRef.current && !excelDropdownRef.current.contains(event.target as Node)) {
                setShowExcelDropdown(false);
            }
            if (cartExcelDropdownRef.current && !cartExcelDropdownRef.current.contains(event.target as Node)) {
                setShowCartExcelDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Initial / On-file-change Load of Customers
    useEffect(() => {
        let isMounted = true;
        const loadCustomers = async () => {
            setCustomersLoading(true);
            const url = selectedFile
                ? `/api/catalog/customers?file_name=${encodeURIComponent(selectedFile)}`
                : '/api/catalog/customers';

            try {
                const res = await fetch(url);
                const data = await res.json();
                if (!isMounted) return;

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
            } catch (err) {
                console.error('Failed to load customers:', err);
                if (isMounted) toast.error('得意先リストの取得に失敗しました');
            } finally {
                if (isMounted) setCustomersLoading(false);
            }
        };

        loadCustomers();
        return () => {
            isMounted = false;
        };
    }, [selectedFile, initialCode]);

    // Load direct destinations when selected customer changes
    useEffect(() => {
        if (!selectedCustomer) {
            return;
        }

        let isMounted = true;
        fetch(`/api/catalog/direct-dests?customer_code=${selectedCustomer.code}`)
            .then(res => res.json())
            .then(data => {
                if (!isMounted) return;
                setSelectedDirectDest('all');
                setDirectDestQuery('');
                setShowDirectDestDropdown(false);
                if (data.success && data.direct_dests) {
                    setDirectDests(data.direct_dests);
                } else {
                    setDirectDests([]);
                }
            })
            .catch(err => {
                if (!isMounted) return;
                console.error('Failed to load direct dests:', err);
                setDirectDests([]);
            });

        return () => {
            isMounted = false;
        };
    }, [selectedCustomer]);

    // Load Products when selected customer or selected direct destination changes
    useEffect(() => {
        let isMounted = true;
        const loadProducts = async () => {
            if (!selectedCustomer) {
                setProducts([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                let url = `/api/catalog/products?customer_code=${selectedCustomer.code}`;
                if (selectedDirectDest !== 'all') {
                    url += `&direct_dest=${encodeURIComponent(selectedDirectDest)}`;
                }

                const res = await fetch(url);
                const data = await res.json();
                if (!isMounted) return;

                if (data.success && data.products) {
                    setProducts(data.products);
                } else {
                    setProducts([]);
                }
            } catch (err) {
                if (!isMounted) return;
                console.error('Failed to load products:', err);
                toast.error('商品リストの取得に失敗しました');
                setProducts([]);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadProducts();
        return () => {
            isMounted = false;
        };
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
            if (alertFilter === 'reorder' && !p.is_reorder_due) return false;
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
        const currentCustCode = selectedCustomer?.code || '';
        const currentCustName = selectedCustomer?.name || '未指定の得意先';

        // 別顧客の混在防止チェック
        if (cart.length > 0 && cartCustomer && cartCustomer.code !== currentCustCode) {
            const confirmed = window.confirm(
                `【ご確認: 手配先が異なります】\n\n現在カートに「${cartCustomer.name}」様の商品（${cart.length}点）が入っています。\n\n「${currentCustName}」様の商品を追加するため、カートをリセットして新しく入れ替えますか？\n\n※「キャンセル」を押すと既存のカート内容が保持され、追加は中止されます。`
            );
            if (!confirmed) {
                toast('手配カートへの追加をキャンセルしました（既存カートは保持されています）', { icon: 'ℹ️' });
                return;
            }
            // リセットして新規追加
            setCart([{ product, quantity: qty, customer_code: currentCustCode, customer_name: currentCustName }]);
            setCartCustomer({ code: currentCustCode, name: currentCustName });
            toast.success(`手配カートを「${currentCustName}」様向けにリセットし、商品を追加しました`);
            return;
        }

        setCart(prev => {
            const existingIdx = prev.findIndex(item => item.product.product_code === product.product_code && item.product.product_name === product.product_name);
            if (existingIdx >= 0) {
                const updated = [...prev];
                updated[existingIdx].quantity += qty;
                toast.success(`${product.product_name} の手配数量を更新しました (${updated[existingIdx].quantity.toLocaleString()}${product.unit})`);
                return updated;
            } else {
                toast.success(`手配カートに追加しました: ${product.product_name}`);
                return [...prev, { product, quantity: qty, customer_code: currentCustCode, customer_name: currentCustName }];
            }
        });
        if (!cartCustomer && currentCustCode) {
            setCartCustomer({ code: currentCustCode, name: currentCustName });
        }
    };

    const updateCartQuantity = (index: number, delta: number) => {
        setCart(prev => {
            const updated = [...prev];
            const current = updated[index].quantity;
            const newQty = Math.max(0, current + delta);
            if (newQty === 0) {
                const filtered = updated.filter((_, i) => i !== index);
                if (filtered.length === 0) setCartCustomer(null);
                return filtered;
            }
            updated[index].quantity = newQty;
            return updated;
        });
    };

    const setCartItemQtyDirect = (index: number, val: number) => {
        setCart(prev => {
            const updated = [...prev];
            if (val <= 0) {
                const filtered = updated.filter((_, i) => i !== index);
                if (filtered.length === 0) setCartCustomer(null);
                return filtered;
            }
            updated[index].quantity = val;
            return updated;
        });
    };

    const removeFromCart = (index: number) => {
        setCart(prev => {
            const updated = prev.filter((_, i) => i !== index);
            if (updated.length === 0) {
                setCartCustomer(null);
            }
            return updated;
        });
    };

    const clearCart = () => {
        if (cart.length > 0 && confirm('手配カート内の全商品を削除しますか？')) {
            setCart([]);
            setCartCustomer(null);
            toast.success('手配カートをクリアしました');
        }
    };

    // Calculate Cart Totals
    const cartTotalAmount = useMemo(() => {
        return cart.reduce((sum, item) => sum + (item.quantity * item.product.latest_unit_price), 0);
    }, [cart]);

    const cartTotalCount = useMemo(() => {
        return cart.reduce((sum, item) => sum + item.quantity, 0);
    }, [cart]);

    // Generate Order / Arrangement Email Text (営業から事務への手配依頼)
    const generateEmailText = () => {
        const dateStr = new Date().toLocaleDateString('ja-JP');
        const custName = cartCustomer?.name || (selectedCustomer ? selectedCustomer.name : '得意先未指定');
        const custCode = cartCustomer?.code || (selectedCustomer ? selectedCustomer.code : '');

        let text = `事務担当者様\nお疲れ様です。以下の通り、商品の手配をお願いいたします。\n\n`;
        text += `【依頼種別】手配依頼\n`;
        text += `【依頼日】${dateStr}\n`;
        if (repName) text += `【依頼営業】${repName}\n`;
        text += `【得意先】${custName} (CD: ${custCode})\n\n`;
        text += `【手配商品明細】\n`;

        cart.forEach((item, idx) => {
            const p = item.product;
            const subtotal = Math.round(item.quantity * p.latest_unit_price);
            text += `----------------------------------------\n`;
            text += `${idx + 1}. ${p.product_name}\n`;
            if (p.classification) text += `   種別: ${p.classification}\n`;
            if (p.brand_name) text += `   銘柄: ${p.brand_name}\n`;
            if (p.direct_customer_name) text += `   直送先: ${p.direct_customer_name}\n`;
            text += `   商品コード: ${p.product_code}\n`;
            if (p.order_no_display && p.order_no_display !== '-') text += `   前回受注No: ${p.order_no_display}\n`;
            text += `   手配数量: ${item.quantity.toLocaleString()} ${p.unit}\n`;
            text += `   販売単価: ${p.latest_unit_price.toLocaleString()} 円 (小計: ${subtotal.toLocaleString()} 円)\n`;
        });

        text += `----------------------------------------\n`;
        text += `【手配合計金額】${Math.round(cartTotalAmount).toLocaleString()} 円 (全${cart.length}品目 / 総手配数量: ${cartTotalCount.toLocaleString()})\n\n`;
        text += `ご確認および手配のほど、よろしくお願いいたします。`;

        return text;
    };

    const copyEmailToClipboard = () => {
        const text = generateEmailText();
        navigator.clipboard.writeText(text).then(() => {
            setCopiedEmail(true);
            toast.success('手配依頼メール文章をコピーしました！');
            setTimeout(() => setCopiedEmail(false), 2000);
        }).catch(err => {
            console.error('Copy failed:', err);
            toast.error('クリップボードへのコピーに失敗しました');
        });
    };

    // メールソフト（Outlook等）を新規作成ウィンドウで起動
    const openEmailInMailer = () => {
        if (cart.length === 0) {
            toast.error('手配カートに商品がありません');
            return;
        }
        const text = generateEmailText();
        const custName = cartCustomer?.name || (selectedCustomer ? selectedCustomer.name : '得意先未指定');
        const cleanCust = custName.replace(/[(（]株[)）]/g, '株式会社').trim();
        const subject = `【手配依頼】${cleanCust}様${repName ? `（担当: ${repName}）` : ''}`;

        // バックアップとしてクリップボードにも本文をコピーしておく
        navigator.clipboard.writeText(text).catch(console.error);

        const mailtoUrl = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(text)}`;

        if (mailtoUrl.length > 2000) {
            // URL長制限を超過する場合は件名のみ設定してメーラーを開き、本文は貼り付けを促す
            window.location.href = `mailto:?subject=${encodeURIComponent(subject)}`;
            toast.success('メーラーを起動しました。明細が多いため本文をクリップボードにコピーしました（メール本文に貼り付けてください）', { duration: 6000 });
        } else {
            window.location.href = mailtoUrl;
            toast.success('メールソフトを起動しました（念のため本文もコピー済）');
        }
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
    const exportToExcel = async (includeCost: boolean = false) => {
        if (!selectedCustomer || filteredProducts.length === 0) {
            toast.error('エクスポート対象の商品がありません');
            return;
        }

        try {
            const compName = getCleanCompanyName(selectedCustomer.name);
            const fileSafeComp = getFileSafeCompanyName(selectedCustomer.name);
            const today = new Date();
            const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
            const fileDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

            // 種別の正規化ヘルパー
            const getDisplayClassification = (p: ProductItem): string => {
                if (p.classification_display) return p.classification_display;
                const cRaw = (p.classification || '').trim();
                const cNorm = cRaw.replace(/（/g, '(').replace(/）/g, ')');
                if (cNorm.includes('シルク')) return 'シルク';
                if (/3F|３Ｆ|ロールフレキソ|SP|ＳＰ/i.test(cNorm)) return 'SP';
                if (cNorm.includes('オクダ・ヌマタオフセット版') || cNorm.includes('オフセット')) return 'オフセット';
                if (cNorm.includes('シール(フルオーダー)') || cNorm.includes('別注シール')) return '別注シール';
                if (cNorm.includes('シール(セミオーダー)') || cNorm === 'シール') return 'シール';
                if (cNorm.includes('ポリ別注')) return 'ポリ別注';
                if (cNorm.includes('別注')) return '別注';
                if (cNorm.includes('既製品')) return '既製品';
                return cRaw;
            };

            // 種別の優先順位（1: 別注, 2: ポリ別注, 3: SP, 4: シルク, 5: オフセット, 6: 既製品, 7: 別注シール, 8: シール）
            const getClassificationOrder = (cls: string): number => {
                const orderMap: Record<string, number> = {
                    '別注': 1,
                    '別注品': 1,
                    'ポリ別注': 2,
                    'SP': 3,
                    'シルク': 4,
                    'オフセット': 5,
                    '既製品': 6,
                    '別注シール': 7,
                    'シール': 8
                };
                return orderMap[cls] ?? 99;
            };

            // 重量（数値のみ）抽出ヘルパー
            const getWeightNumber = (p: ProductItem): number | string => {
                if (p.weight && p.weight > 0) {
                    return p.weight;
                }
                if (p.capacity_display) {
                    const m = p.capacity_display.match(/[\d.]+/);
                    if (m) {
                        const v = parseFloat(m[0]);
                        return isNaN(v) ? '' : v;
                    }
                }
                return '';
            };

            // 材質の表記整形ヘルパー（【 】付き）
            const formatMaterial = (m?: string): string => {
                if (!m) return '';
                const trimmed = m.trim();
                if (!trimmed) return '';
                if (trimmed.startsWith('【')) return trimmed;
                return `【${trimmed}】`;
            };

            const parseNum = (val: unknown): number => {
                if (val == null || val === '') return 999999;
                const m = String(val).match(/[-+]?[0-9]*\.?[0-9]+/);
                if (!m) return 999999;
                const n = parseFloat(m[0]);
                return isNaN(n) ? 999999 : n;
            };

            // 並び替え: ①種別順 → ②材質順 → ③重量順（昇順/小さい順） → ④色数順（昇順/小さい順）
            const sortedForExport = [...filteredProducts].sort((a, b) => {
                // 1. 種別順
                const clsA = getDisplayClassification(a);
                const clsB = getDisplayClassification(b);
                const orderA = getClassificationOrder(clsA);
                const orderB = getClassificationOrder(clsB);
                if (orderA !== orderB) return orderA - orderB;

                // 2. 材質順
                const matA = (a.material_name || a.material_short || '').trim();
                const matB = (b.material_name || b.material_short || '').trim();
                if (!matA && matB) return 1;
                if (matA && !matB) return -1;
                const matCmp = matA.localeCompare(matB, 'ja');
                if (matCmp !== 0) return matCmp;

                // 3. 重量順（小さいものから / 昇順）
                const weightA = typeof a.weight === 'number' && a.weight > 0 ? a.weight : parseNum(a.capacity_display);
                const weightB = typeof b.weight === 'number' && b.weight > 0 ? b.weight : parseNum(b.capacity_display);
                if (weightA !== weightB) return weightA - weightB;

                // 4. 色数順（小さいものから / 昇順）
                const colA = a.colors_total != null ? a.colors_total : parseNum(a.color_display);
                const colB = b.colors_total != null ? b.colors_total : parseNum(b.color_display);
                if (colA !== colB) return colA - colB;

                // 5. 安定ソート（最新受注日 降順）
                const dateA = a.latest_order_date || a.latest_sales_date || '';
                const dateB = b.latest_order_date || b.latest_sales_date || '';
                if (dateA !== dateB) return dateB.localeCompare(dateA);

                return a.product_name.localeCompare(b.product_name, 'ja');
            });

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ASAHIPACK Daily Report System';
            workbook.lastModifiedBy = repName || '営業担当';
            workbook.created = today;

            const ws = workbook.addWorksheet('取扱商品一覧', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 3, showGridLines: true }]
            });

            // 列の定義
            // includeCost === true の場合: 18列 (種別の前に直送先、商品単価の前に色数を追加)
            // includeCost === false の場合: 15列 (種別の前に直送先、商品単価の前に色数を追加)
            const baseColumns: Partial<ExcelJS.Column>[] = [
                { header: 'No.', key: 'no', width: 6 },
                { header: '直送先', key: 'direct_dest', width: 22 },
                { header: '種別', key: 'classification', width: 12 },
                { header: '受注No.', key: 'order_no', width: 14 },
                { header: '商品コード', key: 'code', width: 14 },
                { header: '品名', key: 'name', width: 38 },
                { header: '重量', key: 'weight', width: 10 },
                { header: '形状', key: 'shape', width: 10 },
                { header: '材質', key: 'material', width: 16 },
                { header: '色数', key: 'colors', width: 12 },
                { header: '商品単価', key: 'unit_price', width: 12 },
            ];

            if (includeCost) {
                baseColumns.push(
                    { header: '商品原価', key: 'cost_price', width: 12 },
                    { header: '印刷代', key: 'print_fee', width: 12 },
                    { header: '印刷原価', key: 'print_cost', width: 12 },
                    { header: '粗利率', key: 'margin_rate', width: 10 }
                );
            } else {
                baseColumns.push(
                    { header: '印刷代', key: 'print_fee', width: 12 }
                );
            }

            baseColumns.push(
                { header: '印刷内容', key: 'print_content', width: 32 },
                { header: 'JANコード', key: 'jan_code', width: 16 },
                { header: '最新受注日', key: 'order_date', width: 14 }
            );

            ws.columns = baseColumns;

            const totalCols = includeCost ? 18 : 15;
            const titleEndCol = includeCost ? 'O' : 'L';
            const dateStartCol = includeCost ? 'P' : 'M';
            const lastCol = includeCost ? 'R' : 'O';

            // 1行目: タイトルバー（原価ありの場合は社内管理用としてダークネイビー #0F2942、通常はダークスレート #1F2937）
            ws.mergeCells(`A1:${titleEndCol}1`);
            const titleCell = ws.getCell('A1');
            titleCell.value = includeCost
                ? `【${selectedCustomer.code} ${compName}　　様】取扱商品一覧（社内用・原価付き）`
                : `【${selectedCustomer.code} ${compName}　　様】取扱商品一覧`;
            titleCell.font = { name: 'Meiryo', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: includeCost ? 'FF0F2942' : 'FF1F2937' }
            };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };

            ws.mergeCells(`${dateStartCol}1:${lastCol}1`);
            const dateCell = ws.getCell(`${dateStartCol}1`);
            dateCell.value = `出力日: ${dateStr}`;
            dateCell.font = { name: 'Meiryo', size: 10, color: { argb: 'FFE2E8F0' } };
            dateCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: includeCost ? 'FF0F2942' : 'FF1F2937' }
            };
            dateCell.alignment = { vertical: 'middle', horizontal: 'right' };
            ws.getRow(1).height = 36;

            // 2行目: 余白空行
            ws.getRow(2).height = 8;

            // 3行目: テーブルヘッダー
            const headerRow = ws.getRow(3);
            const headerTitles = [
                'No.',
                '直送先',
                '種別',
                '受注No.',
                '商品コード',
                '品名',
                '重量',
                '形状',
                '材質',
                '色数',
                '商品単価'
            ];
            if (includeCost) {
                headerTitles.push('商品原価', '印刷代', '印刷原価', '粗利率');
            } else {
                headerTitles.push('印刷代');
            }
            headerTitles.push('印刷内容', 'JANコード', '最新受注日');

            headerRow.values = headerTitles;
            headerRow.height = 28;
            headerRow.eachCell((cell, colNum) => {
                cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                const isCostCol = includeCost && (colNum === 12 || colNum === 14 || colNum === 15);
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isCostCol ? 'FF1E3A8A' : 'FF1F2937' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FF475569' } },
                    bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
                    left: { style: 'thin', color: { argb: 'FF475569' } },
                    right: { style: 'thin', color: { argb: 'FF475569' } }
                };
            });

            const thinBorder: Partial<ExcelJS.Borders> = {
                top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
            };

            sortedForExport.forEach((p, idx) => {
                const rowIdx = 4 + idx;
                const row = ws.getRow(rowIdx);
                const isEven = idx % 2 === 1;
                const baseBg = isEven ? 'FFF8FAFC' : 'FFFFFFFF';

                const formatD = (dStr?: string | null) => dStr ? dStr.replace(/-/g, '/') : '';
                const dispClass = getDisplayClassification(p);

                // 別注（ポリ別注含む）は商品コードの記載必要なし
                const isBetchu = dispClass === '別注' || dispClass === 'ポリ別注';
                const formattedCode = isBetchu
                    ? ''
                    : (p.product_code ? p.product_code.padStart(9, '0') : '');

                // 既製品は受注Noの記載必要なし
                const orderNoStr = dispClass === '既製品'
                    ? ''
                    : (p.order_no_display && p.order_no_display !== '-'
                        ? p.order_no_display
                        : (p.latest_order_no ? String(p.latest_order_no) : ''));

                const weightVal = getWeightNumber(p);
                const rawMat = p.material_name || p.material_short || '';
                const formattedMat = formatMaterial(rawMat);

                // 色数表示
                const colorVal = p.color_display || (p.colors_total ? `${p.colors_total}色` : '');

                // 直送先
                const directDestVal = p.direct_customer_name || '';

                // 商品単価（本体）と商品原価（本体）、印刷代、印刷原価
                const rawUnitPrice = p.product_unit_price !== undefined
                    ? p.product_unit_price
                    : p.latest_unit_price;
                const unitPriceVal = rawUnitPrice > 0 ? rawUnitPrice : (p.latest_unit_price > 0 ? p.latest_unit_price : null);

                const rawCostPrice = p.product_cost_price !== undefined
                    ? p.product_cost_price
                    : p.latest_cost_price;
                const costVal = rawCostPrice > 0 ? rawCostPrice : null;

                const printFeeVal = (p.print_fee !== undefined && p.print_fee !== null && p.print_fee > 0)
                    ? p.print_fee
                    : (p.print_fee === 0 && p.print_content ? 0 : null);

                const printCostVal = (p.print_cost !== undefined && p.print_cost !== null && p.print_cost > 0)
                    ? p.print_cost
                    : null;

                // JANコード（未登録時は空欄）
                const janCodeVal = p.jan_code || '';

                const rowValues: (string | number | boolean | null | undefined)[] = [
                    idx + 1,
                    directDestVal,
                    dispClass,
                    orderNoStr,
                    formattedCode,
                    p.product_name,
                    weightVal,
                    p.shape_type || (p.is_roll ? 'ロール' : '単袋'),
                    formattedMat,
                    colorVal,
                    unitPriceVal
                ];

                if (includeCost) {
                    const marginVal = p.margin_rate != null ? p.margin_rate / 100 : null;
                    rowValues.push(costVal, printFeeVal, printCostVal, marginVal);
                } else {
                    rowValues.push(printFeeVal);
                }

                rowValues.push(
                    p.print_content || '',
                    janCodeVal,
                    formatD(p.latest_order_date || p.latest_sales_date)
                );

                row.values = rowValues;
                row.height = 22;
                row.font = { name: 'Meiryo', size: 9.5 };

                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = thinBorder;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: baseBg }
                    };

                    // 配置と書式
                    if (includeCost) {
                        // center: 1(No), 3(種別), 4(受注No), 5(コード), 7(重量), 8(形状), 10(色数), 17(JAN), 18(日付)
                        if ([1, 3, 4, 5, 7, 8, 10, 17, 18].includes(colNumber)) {
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        } else if ([2, 6, 9, 16].includes(colNumber)) {
                            // left: 2(直送先), 6(品名), 9(材質), 16(印刷内容)
                            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                        } else if ([11, 12, 13, 14].includes(colNumber)) {
                            // right: 11(商品単価), 12(商品原価), 13(印刷代), 14(印刷原価)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;""';
                        } else if (colNumber === 15) {
                            // right: 15(粗利率)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '0.0%';
                        }

                        if (colNumber === 5 || colNumber === 17) {
                            cell.numFmt = '@';
                        }
                    } else {
                        // center: 1(No), 3(種別), 4(受注No), 5(コード), 7(重量), 8(形状), 10(色数), 14(JAN), 15(日付)
                        if ([1, 3, 4, 5, 7, 8, 10, 14, 15].includes(colNumber)) {
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        } else if ([2, 6, 9, 13].includes(colNumber)) {
                            // left: 2(直送先), 6(品名), 9(材質), 13(印刷内容)
                            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                        } else if (colNumber === 11 || colNumber === 12) {
                            // right: 11(商品単価), 12(印刷代)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;""';
                        }

                        if (colNumber === 5 || colNumber === 14) {
                            cell.numFmt = '@';
                        }
                    }
                });
            });

            // オートフィルター設定（3行目ヘッダーから全列）
            ws.autoFilter = {
                from: { row: 3, column: 1 },
                to: { row: 3 + sortedForExport.length, column: totalCols }
            };

            const fileName = includeCost
                ? `${fileSafeComp}_取扱商品一覧(原価あり)_${fileDateStr}.xlsx`
                : `${fileSafeComp}_取扱商品一覧_${fileDateStr}.xlsx`;

            const buffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            saveAs(blob, fileName);
            toast.success(
                includeCost
                    ? `「${fileSafeComp}」の商品一覧Excel（原価あり）を出力しました`
                    : `「${fileSafeComp}」の商品一覧Excelを出力しました`
            );
        } catch (err) {
            console.error('Excel export error:', err);
            toast.error('Excelファイルの出力に失敗しました');
        }
    };

    // 2. カート商品手配依頼リスト Excel出力 (.xlsx)
    const exportCartToExcel = async (includeCost: boolean = false) => {
        if (cart.length === 0) {
            toast.error('手配カートに商品が入っていません');
            return;
        }

        try {
            const custTargetName = cartCustomer?.name || (selectedCustomer ? selectedCustomer.name : '手配依頼');
            const compName = getCleanCompanyName(custTargetName);
            const fileSafeComp = getFileSafeCompanyName(custTargetName);
            const today = new Date();
            const dateStr = `${today.getFullYear()}年${String(today.getMonth() + 1).padStart(2, '0')}月${String(today.getDate()).padStart(2, '0')}日`;
            const fileDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'ASAHIPACK Daily Report System';
            workbook.lastModifiedBy = repName || '営業担当';
            workbook.created = today;

            const ws = workbook.addWorksheet(includeCost ? '手配依頼書(社内稟議用)' : '手配依頼書', {
                views: [{ state: 'frozen', xSplit: 0, ySplit: 4, showGridLines: true }]
            });

            const baseCartCols: Partial<ExcelJS.Column>[] = [
                { header: 'No.', key: 'no', width: 7 },
                { header: '受注№', key: 'order_no', width: 15 },
                { header: '商品コード', key: 'code', width: 14 },
                { header: '品名', key: 'name', width: 40 },
                { header: '銘柄・ブランド', key: 'brand', width: 20 },
                { header: '形状', key: 'shape', width: 11 },
                { header: '手配数量', key: 'qty', width: 14 },
                { header: '単位', key: 'unit', width: 8 },
                { header: '色数', key: 'colors', width: 12 },
                { header: '販売単価', key: 'price', width: 14 },
            ];

            if (includeCost) {
                baseCartCols.push(
                    { header: '仕入原価', key: 'cost_price', width: 14 },
                    { header: '仕入原価計(円)', key: 'cost_subtotal', width: 16 },
                    { header: '想定粗利(円)', key: 'profit', width: 16 },
                    { header: '粗利率', key: 'margin_rate', width: 11 }
                );
            }

            baseCartCols.push(
                { header: '手配小計(円)', key: 'subtotal', width: 18 },
                { header: '最新受注日', key: 'order_date', width: 14 }
            );

            ws.columns = baseCartCols;

            const totalCols = includeCost ? 16 : 12;
            const lastColLetter = includeCost ? 'P' : 'L';

            // 1行目: タイトル
            ws.mergeCells(`A1:${lastColLetter}1`);
            const titleCell = ws.getCell('A1');
            titleCell.value = includeCost
                ? `【手配依頼書（社内稟議用・原価付き）】 ${compName} 様`
                : `【手配依頼書】 ${compName} 様`;
            titleCell.font = { name: 'Meiryo', size: 15, bold: true, color: { argb: 'FFFFFFFF' } };
            titleCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: includeCost ? 'FF0F2942' : 'FF059669' }
            };
            titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(1).height = 36;

            // 2行目: メタデータ
            ws.mergeCells(`A2:${lastColLetter}2`);
            const metaCell = ws.getCell('A2');
            metaCell.value = `出力日: ${dateStr}  |  得意先コード: ${selectedCustomer?.code || '-'}  |  手配品目数: ${cart.length}品目  |  合計金額: ¥${Math.round(cartTotalAmount).toLocaleString()}${repName ? `  |  担当営業: ${repName}` : ''}`;
            metaCell.font = { name: 'Meiryo', size: 10, color: { argb: includeCost ? 'FF1E293B' : 'FF065F46' } };
            metaCell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: includeCost ? 'FFF1F5F9' : 'FFECFDF5' }
            };
            metaCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
            ws.getRow(2).height = 22;

            // 3行目: 空行
            ws.getRow(3).height = 8;

            // 4行目: テーブルヘッダー
            const headerRow = ws.getRow(4);
            const headerTitles = [
                'No.',
                '受注№',
                '商品コード',
                '品名',
                '銘柄・ブランド',
                '形状',
                '手配数量',
                '単位',
                '色数',
                '販売単価'
            ];
            if (includeCost) {
                headerTitles.push('仕入原価', '仕入原価計(円)', '想定粗利(円)', '粗利率');
            }
            headerTitles.push('手配小計(円)', '最新受注日');

            headerRow.values = headerTitles;
            headerRow.height = 28;
            headerRow.eachCell((cell, colNum) => {
                cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                const isCostCol = includeCost && (colNum >= 11 && colNum <= 14);
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: isCostCol ? 'FF1E3A8A' : (includeCost ? 'FF334155' : 'FF10B981') }
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
                const costPrice = item.product.latest_cost_price || 0;
                const costSubtotal = item.quantity * costPrice;
                const profit = subtotal - costSubtotal;
                const marginRate = subtotal > 0 && costPrice > 0 ? (profit / subtotal) : null;
                const colorVal = item.product.color_display || (item.product.colors_total ? `${item.product.colors_total}色` : '');

                const rowValues: (string | number | boolean | null | undefined)[] = [
                    idx + 1,
                    item.product.order_no_display && item.product.order_no_display !== '-' ? item.product.order_no_display : '',
                    item.product.product_code,
                    item.product.product_name,
                    item.product.brand_name || '',
                    item.product.shape_type || (item.product.is_roll ? 'ロール' : '単袋'),
                    item.quantity,
                    item.product.unit || '',
                    colorVal,
                    item.product.latest_unit_price || 0
                ];

                if (includeCost) {
                    rowValues.push(
                        costPrice > 0 ? costPrice : null,
                        costSubtotal > 0 ? costSubtotal : null,
                        subtotal > 0 && costPrice > 0 ? profit : null,
                        marginRate
                    );
                }

                rowValues.push(
                    subtotal,
                    formatD(item.product.latest_order_date)
                );

                row.values = rowValues;
                row.height = 24;
                row.font = { name: 'Meiryo', size: 9.5 };

                row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                    cell.border = thinBorder;
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: baseBg }
                    };

                    if (includeCost) {
                        if ([1, 2, 3, 6, 8, 9, 16].includes(colNumber)) {
                            // center: 1(No), 2(受注№), 3(コード), 6(形状), 8(単位), 9(色数), 16(最新受注日)
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        } else if ([4, 5].includes(colNumber)) {
                            // left: 4(品名), 5(銘柄)
                            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                        } else if (colNumber === 7) {
                            // right qty
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '#,##0';
                            cell.font = { name: 'Meiryo', size: 10, bold: true };
                        } else if (colNumber === 10 || colNumber === 11) {
                            // right: 10(販売単価), 11(仕入原価)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;"-"';
                        } else if (colNumber === 12 || colNumber === 13 || colNumber === 15) {
                            // right: 12(仕入原価計), 13(想定粗利), 15(手配小計)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '¥#,##0;[Red]-¥#,##0;"-"';
                            if (colNumber === 15) {
                                cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FF065F46' } };
                            }
                        } else if (colNumber === 14) {
                            // right: 14(粗利率)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '0.0%';
                        }
                    } else {
                        if ([1, 2, 3, 6, 8, 9, 12].includes(colNumber)) {
                            // center: 1(No), 2(受注№), 3(コード), 6(形状), 8(単位), 9(色数), 12(最新受注日)
                            cell.alignment = { vertical: 'middle', horizontal: 'center' };
                        } else if ([4, 5].includes(colNumber)) {
                            // left: 4(品名), 5(銘柄)
                            cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                        } else if (colNumber === 7) {
                            // right qty
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '#,##0';
                            cell.font = { name: 'Meiryo', size: 10, bold: true };
                        } else if (colNumber === 10) {
                            // right: 10(販売単価)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;"-"';
                        } else if (colNumber === 11) {
                            // right: 11(手配小計)
                            cell.alignment = { vertical: 'middle', horizontal: 'right' };
                            cell.numFmt = '¥#,##0;[Red]-¥#,##0;"-"';
                            cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FF065F46' } };
                        }
                    }
                });
            });

            // 合計行
            const totalRowIdx = 5 + cart.length;
            const totalRow = ws.getRow(totalRowIdx);
            const mergeEndLetter = includeCost ? 'N' : 'J';
            const subtotalColLetter = includeCost ? 'O' : 'K';
            const lastCol = includeCost ? 'P' : 'L';

            ws.mergeCells(`A${totalRowIdx}:${mergeEndLetter}${totalRowIdx}`);
            const totalLabelCell = ws.getCell(`A${totalRowIdx}`);
            totalLabelCell.value = '合計手配金額 (税込想定)';
            totalLabelCell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FF1E293B' } };
            totalLabelCell.alignment = { vertical: 'middle', horizontal: 'right', indent: 1 };
            totalLabelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFECFDF5' } };
            totalLabelCell.border = {
                top: { style: 'thin', color: { argb: 'FF10B981' } },
                bottom: { style: 'double', color: { argb: 'FF065F46' } },
                left: { style: 'thin', color: { argb: 'FF10B981' } },
                right: { style: 'thin', color: { argb: 'FF10B981' } }
            };

            const totalValCell = ws.getCell(`${subtotalColLetter}${totalRowIdx}`);
            totalValCell.value = { formula: `SUM(${subtotalColLetter}5:${subtotalColLetter}${totalRowIdx - 1})`, result: cartTotalAmount };
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

            const endCell = ws.getCell(`${lastCol}${totalRowIdx}`);
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
            const fileName = includeCost
                ? `${fileSafeComp}_手配依頼書(原価あり)_${fileDateStr}.xlsx`
                : `${fileSafeComp}_手配依頼書_${fileDateStr}.xlsx`;
            saveAs(blob, fileName);
            toast.success(
                includeCost
                    ? `「${fileSafeComp}」の手配依頼書Excel（原価あり）を出力しました`
                    : `「${fileSafeComp}」の手配依頼書Excelを出力しました`
            );
        } catch (err) {
            console.error('Cart Excel export error:', err);
            toast.error('手配依頼書Excelファイルの出力に失敗しました');
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
                    mtime: 0,
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
                mtime: 0,
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

        // 別注品（70始まり）の場合は初回受注Noもフォールバックで試す
        // ※ 規格品（70以外）は商品コードが昔の別注品受注番号と衝突するためクエリに追加しない
        const cleanCode = String(product.product_code || '').trim().replace(/^0+/, '');
        if (cleanCode.startsWith('70')) {
            const initialOrderNo = cleanCode.slice(2).replace(/^0+/, '');
            if (initialOrderNo && !queriesToTry.includes(initialOrderNo)) {
                queriesToTry.push(initialOrderNo);
            }
        }

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
                <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl text-white shadow-md">
                            <ShoppingBag size={24} />
                        </div>
                        <div>
                            <h1 className="text-xl font-bold text-sf-text flex items-center gap-2">
                                <span>商品検索・手配カタログ</span>
                            </h1>
                            <p className="text-xs text-sf-text-weak mt-0.5">
                                得意先ごとの購入商品（AS/400基幹データ）を画像・単価・スペック付きで瞬時に検索・比較・手配依頼作成
                            </p>
                        </div>
                    </div>

                    {/* Selectors: 得意先 ＋ 直送先（右隣） */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 w-full xl:w-auto">
                        {/* Customer Dropdown / Selector */}
                        <div className="relative w-full sm:w-72 md:w-80">
                            <div
                                onClick={() => {
                                    if (!customersLoading) {
                                        setShowCustomerDropdown(!showCustomerDropdown);
                                        setShowDirectDestDropdown(false);
                                    }
                                }}
                                className={`flex items-center justify-between px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg transition-colors shadow-xs ${
                                    customersLoading ? 'cursor-wait opacity-80' : 'cursor-pointer hover:bg-slate-100'
                                }`}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Building2 size={16} className="text-blue-600 flex-shrink-0" />
                                    {customersLoading ? (
                                        <div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
                                            <Loader2 size={13} className="animate-spin text-blue-600" />
                                            <span>得意先一覧を読込中...</span>
                                        </div>
                                    ) : selectedCustomer ? (
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
                                        <span className="text-sm text-gray-400">得意先を選択...</span>
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

                        {/* Direct Destination Selector (得意先の右隣・キーワード検索＋サジェスト) */}
                        <div className="relative w-full sm:w-64 md:w-72">
                            <div
                                onClick={() => {
                                    if (directDests.length > 0) {
                                        setShowDirectDestDropdown(!showDirectDestDropdown);
                                        setShowCustomerDropdown(false);
                                    }
                                }}
                                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border transition-colors shadow-xs ${
                                    directDests.length === 0
                                        ? 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                                        : selectedDirectDest !== 'all'
                                        ? 'bg-indigo-50 border-indigo-300 text-indigo-950 font-semibold cursor-pointer ring-1 ring-indigo-400/50'
                                        : 'bg-slate-50 border-slate-300 hover:bg-slate-100 cursor-pointer text-gray-700'
                                }`}
                                title={directDests.length === 0 ? "この得意先には登録された直送先（納品先）がありません" : "直送先をキーワード検索・選択"}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <MapPin size={16} className={selectedDirectDest !== 'all' ? 'text-indigo-600 flex-shrink-0' : 'text-gray-400 flex-shrink-0'} />
                                    <div className="flex items-center gap-1.5 truncate">
                                        <span className="text-xs font-medium text-gray-500 shrink-0">直送先:</span>
                                        {directDests.length === 0 ? (
                                            <span className="text-xs text-gray-400 truncate">なし (単独納品)</span>
                                        ) : selectedDirectDest === 'all' ? (
                                            <span className="text-xs font-semibold text-gray-700 truncate">
                                                すべて ({directDests.length}箇所)
                                            </span>
                                        ) : (
                                            <span className="text-xs font-bold text-indigo-700 truncate">
                                                {selectedDirectDest}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    {selectedDirectDest !== 'all' && (
                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedDirectDest('all');
                                                setDirectDestQuery('');
                                            }}
                                            className="p-1 hover:bg-indigo-200 text-indigo-700 rounded transition-colors"
                                            title="直送先選択を解除（すべて表示）"
                                        >
                                            <X size={13} />
                                        </button>
                                    )}
                                    {directDests.length > 0 && (
                                        <ChevronDown size={15} className={`text-gray-400 transition-transform ${showDirectDestDropdown ? 'rotate-180' : ''}`} />
                                    )}
                                </div>
                            </div>

                            {/* Direct Destination Suggest Dropdown Modal */}
                            {showDirectDestDropdown && directDests.length > 0 && (
                                <div className="absolute left-0 right-0 top-full mt-1.5 bg-white rounded-xl border border-sf-border shadow-2xl z-50 max-h-80 flex flex-col overflow-hidden animate-fadeIn">
                                    {/* Search Input for Suggestions */}
                                    <div className="p-2.5 bg-slate-50 border-b border-gray-200">
                                        <div className="relative">
                                            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                                            <input
                                                type="text"
                                                value={directDestQuery}
                                                onChange={e => setDirectDestQuery(e.target.value)}
                                                placeholder="直送先名またはコードで検索..."
                                                className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium"
                                                autoFocus
                                            />
                                            {directDestQuery && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDirectDestQuery('')}
                                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                                >
                                                    <X size={12} />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Suggestions List */}
                                    <div className="overflow-y-auto flex-1 divide-y divide-gray-100 max-h-60 text-xs">
                                        {/* Option: すべての直送先 */}
                                        <div
                                            onClick={() => {
                                                setSelectedDirectDest('all');
                                                setShowDirectDestDropdown(false);
                                                setDirectDestQuery('');
                                            }}
                                            className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                                                selectedDirectDest === 'all'
                                                    ? 'bg-indigo-50 text-indigo-900 font-bold border-l-4 border-indigo-600 pl-2'
                                                    : 'hover:bg-gray-50 text-gray-700'
                                            }`}
                                        >
                                            <div className="flex items-center gap-2">
                                                <Building2 size={13} className="text-gray-400" />
                                                <span>すべての直送先を表示</span>
                                            </div>
                                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-mono">
                                                {directDests.length} 箇所
                                            </span>
                                        </div>

                                        {filteredDirectDests.length === 0 ? (
                                            <div className="p-4 text-center text-xs text-gray-400">
                                                「{directDestQuery}」に一致する直送先はありません
                                            </div>
                                        ) : (
                                            filteredDirectDests.map((d, i) => (
                                                <div
                                                    key={i}
                                                    onClick={() => {
                                                        setSelectedDirectDest(d.name);
                                                        setShowDirectDestDropdown(false);
                                                        setDirectDestQuery('');
                                                    }}
                                                    className={`px-3 py-2 flex items-center justify-between cursor-pointer transition-colors ${
                                                        selectedDirectDest === d.name
                                                            ? 'bg-indigo-50 text-indigo-900 font-bold border-l-4 border-indigo-600 pl-2'
                                                            : 'hover:bg-gray-50 text-gray-700'
                                                    }`}
                                                >
                                                    <div className="truncate mr-2">
                                                        <span className="block truncate font-medium text-gray-800">{d.name}</span>
                                                        {d.code && (
                                                            <span className="text-[10px] text-gray-400 font-mono block">CD: {d.code}</span>
                                                        )}
                                                    </div>
                                                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 font-medium shrink-0 font-mono">
                                                        {d.order_count} 件
                                                    </span>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
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
                            value={displayedKeyword}
                            onChange={e => handleKeywordChange(e.target.value)}
                            placeholder="商品名称、銘柄・ブランド、商品コード、受注Noでキーワード検索..."
                            className="w-full pl-10 pr-10 py-2.5 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                        />
                        {isSearching ? (
                            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 flex items-center gap-1" title="検索中...">
                                <Loader2 size={16} className="animate-spin" />
                            </div>
                        ) : displayedKeyword ? (
                            <button
                                onClick={handleClearKeyword}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                title="検索キーワードをクリア"
                            >
                                <X size={16} />
                            </button>
                        ) : null}
                    </div>

                    {/* View Switcher & Action Buttons */}
                    <div className="flex items-center gap-2 w-full md:w-auto justify-end flex-wrap">
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

                        {/* Export Excel Button with Dropdown */}
                        <div className="relative" ref={excelDropdownRef}>
                            <button
                                onClick={() => setShowExcelDropdown(prev => !prev)}
                                className="px-3 py-2 bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
                                title="絞り込んだ商品をExcel出力 (.xlsx)"
                            >
                                <FileSpreadsheet size={15} />
                                <span className="hidden sm:inline">Excel出力</span>
                                <ChevronDown size={14} className={`transition-transform duration-200 ${showExcelDropdown ? 'rotate-180' : ''}`} />
                            </button>

                            {showExcelDropdown && (
                                <div className="absolute right-0 mt-1.5 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-30 animate-fadeIn text-sf-text">
                                    <div className="px-3 py-1.5 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                        Excel出力形式を選択
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowExcelDropdown(false);
                                            exportToExcel(false);
                                        }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-emerald-50/70 flex items-start gap-2.5 transition-colors group"
                                    >
                                        <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors mt-0.5">
                                            <FileSpreadsheet size={16} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-800 group-hover:text-emerald-800 flex items-center">
                                                <span>原価なしで出力</span>
                                                <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">顧客提示用</span>
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-0.5">
                                                単価・仕様・JANコード等の標準一覧
                                            </div>
                                        </div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowExcelDropdown(false);
                                            exportToExcel(true);
                                        }}
                                        className="w-full text-left px-3 py-2.5 hover:bg-blue-50/70 flex items-start gap-2.5 transition-colors group"
                                    >
                                        <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors mt-0.5">
                                            <Lock size={16} />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-gray-800 group-hover:text-blue-800 flex items-center">
                                                <span>原価ありで出力</span>
                                                <span className="ml-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">社内管理用</span>
                                            </div>
                                            <div className="text-[11px] text-gray-500 mt-0.5">
                                                仕入原価・粗利率列を追加した詳細一覧
                                            </div>
                                        </div>
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Cart Button */}
                        <button
                            onClick={() => setShowCartModal(true)}
                            className="relative px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-lg text-xs font-bold flex items-center gap-2 shadow-sm transition-all"
                        >
                            <ShoppingCart size={16} />
                            <span>手配カート</span>
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

                    {/* Reorder Suggestion Filter */}
                    {reorderDueCount > 0 && (
                        <button
                            type="button"
                            onClick={() => setAlertFilter(alertFilter === 'reorder' ? 'all' : 'reorder')}
                            className={`px-2.5 py-1 text-xs rounded-full font-bold transition-all inline-flex items-center gap-1.5 cursor-pointer ${
                                alertFilter === 'reorder'
                                    ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-300'
                                    : 'bg-blue-50 text-blue-800 hover:bg-blue-100 border border-blue-200'
                            }`}
                            title="過去の注文サイクルから、今月再発注・リピートが期待される商品"
                        >
                            <span>📢 そろそろ再発注</span>
                            <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${alertFilter === 'reorder' ? 'bg-blue-800 text-white' : 'bg-blue-200 text-blue-900'}`}>
                                {reorderDueCount}
                            </span>
                        </button>
                    )}

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

                    <div className="ml-auto flex items-center gap-2">
                        {isSearching && (
                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 bg-blue-50 text-blue-700 text-xs font-semibold rounded-full border border-blue-200 animate-pulse">
                                <Loader2 size={12} className="animate-spin text-blue-600" />
                                <span>検索中...</span>
                            </span>
                        )}
                        <span className="text-xs text-gray-400 font-mono">
                            表示中: {filteredProducts.length} 件
                        </span>
                    </div>
                </div>
            </div>

            {/* Products Main View */}
            {loading ? (
                <div className="space-y-4 animate-fadeIn">
                    {/* Loading Status Banner */}
                    <div className="bg-gradient-to-r from-blue-50 via-indigo-50 to-blue-50 border border-blue-200/80 rounded-xl p-4 flex items-center justify-center gap-3 text-blue-800 shadow-xs">
                        <Loader2 size={20} className="animate-spin text-blue-600 shrink-0" />
                        <span className="font-bold text-sm">
                            {selectedCustomer ? `「${selectedCustomer.name}」の商品・売上データを検索・読込中...` : '商品カタログを読み込んでいます...'}
                        </span>
                    </div>

                    {/* Rich Skeleton Placeholders */}
                    {viewMode === 'grid' ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="bg-white rounded-xl border border-sf-border shadow-xs p-4 space-y-3 animate-pulse">
                                    <div className="flex justify-between items-center">
                                        <div className="h-4 bg-gray-200 rounded w-24"></div>
                                        <div className="h-4 bg-gray-100 rounded w-14"></div>
                                    </div>
                                    <div className="h-28 bg-gray-100 rounded-lg flex items-center justify-center">
                                        <ShoppingBag size={28} className="text-gray-200" />
                                    </div>
                                    <div className="space-y-2 pt-1">
                                        <div className="h-4 bg-gray-200 rounded w-4/5"></div>
                                        <div className="h-3 bg-gray-100 rounded w-1/2"></div>
                                    </div>
                                    <div className="pt-3 border-t border-gray-100 flex justify-between items-center">
                                        <div className="h-5 bg-gray-200 rounded w-16"></div>
                                        <div className="h-8 bg-amber-100 rounded-lg w-28"></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white rounded-xl border border-sf-border shadow-xs overflow-hidden">
                            <div className="p-4 bg-gray-50 border-b border-sf-border flex gap-4">
                                <div className="h-4 bg-gray-200 rounded w-12"></div>
                                <div className="h-4 bg-gray-200 rounded w-24"></div>
                                <div className="h-4 bg-gray-200 rounded w-20"></div>
                                <div className="h-4 bg-gray-200 rounded flex-1"></div>
                                <div className="h-4 bg-gray-200 rounded w-24"></div>
                            </div>
                            <div className="divide-y divide-gray-100 p-4 space-y-3">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="flex items-center gap-4 py-2 animate-pulse">
                                        <div className="w-8 h-8 bg-gray-100 rounded shrink-0"></div>
                                        <div className="w-24 h-4 bg-gray-200 rounded"></div>
                                        <div className="w-20 h-4 bg-gray-100 rounded"></div>
                                        <div className="flex-1 h-4 bg-gray-200 rounded"></div>
                                        <div className="w-20 h-4 bg-gray-200 rounded"></div>
                                        <div className="w-16 h-7 bg-amber-100 rounded"></div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
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
                                <div className="flex items-center gap-1">
                                    {p.is_reorder_due && (
                                        <span 
                                            className="inline-flex items-center gap-0.5 px-2 py-0.5 bg-blue-50 text-blue-800 font-bold rounded text-[10px] border border-blue-200"
                                            title={p.reorder_suggest_text || "過去の平均発注サイクルより再発注時期を迎えています"}
                                        >
                                            📢 再発注目安
                                        </span>
                                    )}
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
                                    {(p.classification || p.material_name || p.color_display || p.capacity_display || p.direct_customer_name) && (
                                        <div className="flex flex-wrap items-center gap-1 mt-1.5 text-[10.5px]">
                                            {p.classification && (
                                                <span 
                                                    className="px-1.5 py-0.5 bg-sky-50 text-sky-800 rounded border border-sky-200 font-medium inline-flex items-center gap-0.5" 
                                                    title={`種別: ${p.classification}`}
                                                >
                                                    🏷️ {p.classification}
                                                </span>
                                            )}
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
                                            {p.direct_customer_name && (
                                                <span 
                                                    className="px-1.5 py-0.5 bg-emerald-50 text-emerald-800 rounded border border-emerald-200 font-medium inline-flex items-center gap-0.5 max-w-full truncate" 
                                                    title={`直送先: ${p.direct_customer_name}`}
                                                >
                                                    <MapPin size={10} className="text-emerald-600 flex-shrink-0" />
                                                    <span className="truncate">直送: {p.direct_customer_name}</span>
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Reorder Cycle Suggestion Info */}
                                    {p.reorder_suggest_text && (
                                        <div className="bg-blue-50/70 border border-blue-200/80 rounded px-2 py-1 text-[10.5px] text-blue-800 flex items-center gap-1.5 mt-1.5">
                                            <Sparkles size={11} className="text-blue-600 shrink-0" />
                                            <span className="truncate font-medium">{p.reorder_suggest_text}</span>
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

                                    {/* 印刷代・印刷原価の内訳表示 */}
                                    {((p.print_fee !== undefined && p.print_fee > 0) || (p.print_cost !== undefined && p.print_cost > 0) || p.print_content) && (
                                        <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-[10.5px] space-y-1">
                                            <div className="flex justify-between items-center text-slate-600">
                                                <span>商品本体:</span>
                                                <span className="font-mono font-bold text-slate-800">
                                                    {(p.product_unit_price ?? p.latest_unit_price).toLocaleString()}円
                                                    {p.product_cost_price !== undefined && p.product_cost_price > 0 && (
                                                        <span className="text-gray-400 font-normal ml-1">(原価: {p.product_cost_price.toLocaleString()}円)</span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex justify-between items-center text-indigo-700 font-medium">
                                                <span>印刷代:</span>
                                                <span className="font-mono font-bold text-indigo-900">
                                                    +{(p.print_fee || 0).toLocaleString()}円
                                                    {p.print_cost !== undefined && p.print_cost > 0 && (
                                                        <span className="text-indigo-500 font-normal ml-1">(原価: {p.print_cost.toLocaleString()}円)</span>
                                                    )}
                                                </span>
                                            </div>
                                            {p.print_content && (
                                                <div className="text-[10px] text-gray-500 truncate pt-0.5 border-t border-slate-200" title={p.print_content}>
                                                    🖨️ {p.print_content}
                                                </div>
                                            )}
                                        </div>
                                    )}

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
                                    <span>手配カートに追加</span>
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
                                    <th className="py-3 px-3 font-semibold text-center">手配カート</th>
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
                                            <div className="flex flex-wrap items-center gap-1 mt-0.5">
                                                {p.classification && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-sky-50 text-sky-800 text-[10px] rounded border border-sky-200 font-medium" title={`種別: ${p.classification}`}>
                                                        🏷️ {p.classification}
                                                    </span>
                                                )}
                                                {p.brand_name && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-blue-50 text-blue-700 text-[10px] rounded border border-blue-200">
                                                        🏷️ {p.brand_name}
                                                    </span>
                                                )}
                                                {p.direct_customer_name && (
                                                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 bg-emerald-50 text-emerald-800 text-[10px] rounded border border-emerald-200 font-medium" title={`直送先: ${p.direct_customer_name}`}>
                                                        <MapPin size={9} className="text-emerald-600 flex-shrink-0" />
                                                        直送: {p.direct_customer_name}
                                                    </span>
                                                )}
                                            </div>
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
                                        <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                                            <div className="font-bold text-sf-text">
                                                {p.latest_unit_price.toLocaleString()}円
                                            </div>
                                            {p.print_fee !== undefined && p.print_fee > 0 && (
                                                <div className="text-[10px] text-indigo-600 font-medium">
                                                    本体{(p.product_unit_price ?? p.latest_unit_price).toLocaleString()} + 印刷{p.print_fee.toLocaleString()}
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-right font-mono text-gray-500 whitespace-nowrap">
                                            {p.latest_cost_price > 0 ? (
                                                <div>
                                                    <div>{p.latest_cost_price.toLocaleString()}円</div>
                                                    {p.print_cost !== undefined && p.print_cost > 0 && (
                                                        <div className="text-[10px] text-indigo-500 font-medium">
                                                            本体{(p.product_cost_price ?? p.latest_cost_price).toLocaleString()} + 印刷{p.print_cost.toLocaleString()}
                                                        </div>
                                                    )}
                                                </div>
                                            ) : '-'}
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
                                            {p.is_reorder_due && (
                                                <div className="mt-1">
                                                    <span 
                                                        className="px-2 py-0.5 bg-blue-100 text-blue-900 rounded font-bold text-[10px] border border-blue-200 inline-block"
                                                        title={p.reorder_suggest_text}
                                                    >
                                                        📢 再発注目安 {p.reorder_cycle_days ? `(${p.reorder_cycle_days}日)` : ''}
                                                    </span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="py-2.5 px-3 text-center whitespace-nowrap">
                                            <button
                                                onClick={() => addToCart(p)}
                                                className="px-2.5 py-1 bg-amber-400 hover:bg-amber-500 text-slate-900 font-bold rounded text-xs shadow-sm"
                                            >
                                                + 手配
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
                                <h3 className="font-bold text-base flex flex-wrap items-center gap-1.5">
                                    <span>商品手配カート</span>
                                    <span className="text-[11px] text-amber-300 font-semibold bg-amber-500/20 border border-amber-400/30 px-1.5 py-0.5 rounded">
                                        営業→事務 手配依頼
                                    </span>
                                    <span className="text-xs text-slate-300 font-medium ml-1">
                                        【{cartCustomer ? cartCustomer.name : (selectedCustomer ? selectedCustomer.name : '得意先未選択')} 様】
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
                                    <p className="font-bold text-sm text-gray-600">手配カートに商品が入っていません</p>
                                    <p className="text-xs text-gray-400 mt-1">カタログから手配したい商品を選んで「手配カートに追加」してください</p>
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
                                                    {item.product.classification && (
                                                        <span className="text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded border border-sky-200 text-[11px] font-medium">
                                                            {item.product.classification}
                                                        </span>
                                                    )}
                                                    {item.product.brand_name && <span>🏷️ {item.product.brand_name}</span>}
                                                    {item.product.direct_customer_name && (
                                                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200 text-[11px] font-medium">
                                                            直送: {item.product.direct_customer_name}
                                                        </span>
                                                    )}
                                                    <span>販売単価: <strong>{item.product.latest_unit_price.toLocaleString()}円</strong></span>
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
                                        手配カートをすべて空にする
                                    </button>
                                    <div className="text-right">
                                        <span className="text-xs text-gray-500 mr-2">手配合計金額 ({cart.length}品目):</span>
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
                                {/* Cart Excel Export Button with Dropdown */}
                                <div className="relative w-full sm:w-auto" ref={cartExcelDropdownRef}>
                                    <button
                                        onClick={() => setShowCartExcelDropdown(prev => !prev)}
                                        className="w-full px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm"
                                        title="手配依頼書Excelの出力形式を選択"
                                    >
                                        <FileSpreadsheet size={15} />
                                        <span>手配依頼書Excel出力</span>
                                        <ChevronDown size={14} className={`transition-transform duration-200 ${showCartExcelDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    {showCartExcelDropdown && (
                                        <div className="absolute right-0 bottom-full mb-1.5 w-64 bg-white rounded-xl shadow-xl border border-gray-200 py-1.5 z-30 animate-fadeIn text-sf-text">
                                            <div className="px-3 py-1.5 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                                                手配依頼書Excel形式を選択
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowCartExcelDropdown(false);
                                                    exportCartToExcel(false);
                                                }}
                                                className="w-full text-left px-3 py-2.5 hover:bg-emerald-50/70 flex items-start gap-2.5 transition-colors group"
                                            >
                                                <div className="p-1.5 rounded-md bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100 group-hover:text-emerald-700 transition-colors mt-0.5">
                                                    <FileSpreadsheet size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-gray-800 group-hover:text-emerald-800 flex items-center">
                                                        <span>原価なしで出力</span>
                                                        <span className="ml-1.5 text-[10px] font-semibold text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">標準・事務手配用</span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 mt-0.5">
                                                        社内事務への通常手配依頼書（原価非表示）
                                                    </div>
                                                </div>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setShowCartExcelDropdown(false);
                                                    exportCartToExcel(true);
                                                }}
                                                className="w-full text-left px-3 py-2.5 hover:bg-blue-50/70 flex items-start gap-2.5 transition-colors group"
                                            >
                                                <div className="p-1.5 rounded-md bg-blue-50 text-blue-600 group-hover:bg-blue-100 group-hover:text-blue-700 transition-colors mt-0.5">
                                                    <Lock size={16} />
                                                </div>
                                                <div>
                                                    <div className="text-xs font-bold text-gray-800 group-hover:text-blue-800 flex items-center">
                                                        <span>原価ありで出力</span>
                                                        <span className="ml-1.5 text-[10px] font-semibold text-blue-600 bg-blue-50 border border-blue-200 px-1.5 py-0.5 rounded">社内稟議用</span>
                                                    </div>
                                                    <div className="text-[11px] text-gray-500 mt-0.5">
                                                        仕入原価・粗利計算付きの社内手配書
                                                    </div>
                                                </div>
                                            </button>
                                        </div>
                                    )}
                                </div>
                                <button
                                    onClick={openEmailInMailer}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-md hover:shadow-lg transition-all"
                                    title="既定のメールソフト（Outlook等）を新規作成ウィンドウで起動し、件名と本文を手配依頼用に自動入力します"
                                >
                                    <Mail size={16} />
                                    <span>メールソフトで開く</span>
                                </button>
                                <button
                                    onClick={copyEmailToClipboard}
                                    className="w-full sm:w-auto px-4 py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold text-xs rounded-xl flex items-center justify-center gap-2 shadow-sm transition-all"
                                    title="手配依頼メールの文章をクリップボードにコピーします"
                                >
                                    {copiedEmail ? <Check size={16} className="text-emerald-600" /> : <Copy size={16} className="text-gray-500" />}
                                    <span>{copiedEmail ? 'コピー完了！' : '文章をコピー'}</span>
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
