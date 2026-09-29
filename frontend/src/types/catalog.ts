/**
 * frontend/src/types/catalog.ts
 * 商品カタログ画面に関する型定義
 */

export interface CustomerOption {
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

export interface ProductItem {
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

export interface CartItem {
    product: ProductItem;
    quantity: number;
    customer_code?: string;
    customer_name?: string;
}

export interface DirectDestination {
    name: string;
    code: string;
    sample_customer?: string;
    order_count: number;
}
