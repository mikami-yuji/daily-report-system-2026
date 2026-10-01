/**
 * frontend/src/lib/catalogExport.ts
 * 商品カタログおよび手配カートの Excel 出力処理
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import toast from 'react-hot-toast';
import { ProductItem, CartItem, CustomerOption } from '@/types/catalog';

// 顧客名称のクリーンアップヘルパー
export const getCleanCompanyName = (name?: string): string => {
    if (!name) return '取扱商品一覧';
    return name.replace(/[(（]株[)）]/g, '株式会社').trim();
};

export const getFileSafeCompanyName = (name?: string): string => {
    if (!name) return '商品一覧';
    return name.replace(/[(（]株[)）]/g, '').replace(/[\\/:*?"<>|]/g, '_').trim();
};

// 種別の正規化ヘルパー
export const getDisplayClassification = (p: ProductItem): string => {
    if (p.classification_display) return p.classification_display;
    const cRaw = (p.classification || '').trim();
    const cNorm = cRaw.replace(/（/g, '(').replace(/）/g, ')');
    if (cNorm.includes('シルク')) return 'シルク';
    if (/3F|３Ｆ|ロールフレキソ|SP|ＳＰ/i.test(cNorm)) return 'SP';
    if (cNorm.includes('オクダ・ヌマタオフセット版') || cNorm.includes('オフセット')) return 'オフセット';
    if (cNorm.includes('プレコレ') || cNorm.includes('インクジェット')) return 'プレコレ・インクジェット';
    if (cNorm.includes('シール(フルオーダー)') || cNorm.includes('別注シール')) return '別注シール';
    if (cNorm.includes('シール(セミオーダー)') || cNorm === 'シール') return 'シール';
    if (cNorm.includes('ポリ別注')) return 'ポリ別注';
    if (cNorm.includes('別注')) return '別注';
    if (cNorm.includes('既製品')) return '既製品';
    return cRaw;
};

// 種別の優先順位（1: 別注, 2: ポリ別注, 3: SP, 4: シルク, 5: オフセット, 5.5: プレコレ, 6: 既製品, 7: 別注シール, 8: シール）
const getClassificationOrder = (cls: string): number => {
    const orderMap: Record<string, number> = {
        '別注': 1,
        '別注品': 1,
        'ポリ別注': 2,
        'SP': 3,
        'シルク': 4,
        'オフセット': 5,
        'オクダ・ヌマタオフセット版': 5,
        'プレコレ・インクジェット': 5.5,
        'プレコレ': 5.5,
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

/**
 * 1. カタログ取扱商品一覧 Excel出力 (.xlsx)
 */
export async function exportCatalogToExcel(
    customer: CustomerOption,
    products: ProductItem[],
    repName: string = '',
    includeCost: boolean = false
): Promise<void> {
    if (!customer || products.length === 0) {
        toast.error('エクスポート対象の商品がありません');
        return;
    }

    try {
        const compName = getCleanCompanyName(customer.name);
        const fileSafeComp = getFileSafeCompanyName(customer.name);
        const today = new Date();
        const dateStr = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日`;
        const fileDateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

        // 並び替え: ①種別順 → ②材質順 → ③重量順（昇順/小さい順） → ④色数順（昇順/小さい順）
        const sortedForExport = [...products].sort((a, b) => {
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

        // 1行目: タイトルバー
        ws.mergeCells(`A1:${titleEndCol}1`);
        const titleCell = ws.getCell('A1');
        titleCell.value = includeCost
            ? `【${customer.code} ${compName}　　様】取扱商品一覧（社内用・原価付き）`
            : `【${customer.code} ${compName}　　様】取扱商品一覧`;
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

            const isBetchu = dispClass === '別注' || dispClass === 'ポリ別注';
            const formattedCode = isBetchu
                ? ''
                : (p.product_code ? p.product_code.padStart(9, '0') : '');

            const orderNoStr = dispClass === '既製品'
                ? ''
                : (p.order_no_display && p.order_no_display !== '-'
                    ? p.order_no_display
                    : (p.latest_order_no ? String(p.latest_order_no) : ''));

            const weightVal = getWeightNumber(p);
            const rawMat = p.material_name || p.material_short || '';
            const formattedMat = formatMaterial(rawMat);
            const colorVal = p.color_display || (p.colors_total ? `${p.colors_total}色` : '');
            const directDestVal = p.direct_customer_name || '';

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

                if (includeCost) {
                    if ([1, 3, 4, 5, 7, 8, 10, 17, 18].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if ([2, 6, 9, 16].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                    } else if ([11, 12, 13, 14].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;""';
                    } else if (colNumber === 15) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '0.0%';
                    }

                    if (colNumber === 5 || colNumber === 17) {
                        cell.numFmt = '@';
                    }
                } else {
                    if ([1, 3, 4, 5, 7, 8, 10, 14, 15].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if ([2, 6, 9, 13].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                    } else if (colNumber === 11 || colNumber === 12) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;""';
                    }

                    if (colNumber === 5 || colNumber === 14) {
                        cell.numFmt = '@';
                    }
                }
            });
        });

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
}

/**
 * 2. カート商品手配依頼リスト Excel出力 (.xlsx)
 */
export async function exportCartToExcel(
    cart: CartItem[],
    customer: CustomerOption | null,
    cartCustomer: { code: string; name: string } | null,
    repName: string = '',
    includeCost: boolean = false
): Promise<void> {
    if (cart.length === 0) {
        toast.error('手配カートに商品が入っていません');
        return;
    }

    try {
        const custTargetName = cartCustomer?.name || (customer ? customer.name : '手配依頼');
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
        const cartTotalAmount = cart.reduce((sum, item) => sum + (item.quantity * item.product.latest_unit_price), 0);
        ws.mergeCells(`A2:${lastColLetter}2`);
        const metaCell = ws.getCell('A2');
        metaCell.value = `出力日: ${dateStr}  |  得意先コード: ${customer?.code || '-'}  |  手配品目数: ${cart.length}品目  |  合計金額: ¥${Math.round(cartTotalAmount).toLocaleString()}${repName ? `  |  担当営業: ${repName}` : ''}`;
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
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if ([4, 5].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                    } else if (colNumber === 7) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '#,##0';
                        cell.font = { name: 'Meiryo', size: 10, bold: true };
                    } else if (colNumber === 10 || colNumber === 11) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;"-"';
                    } else if (colNumber === 12 || colNumber === 13 || colNumber === 15) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0;[Red]-¥#,##0;"-"';
                        if (colNumber === 15) {
                            cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FF065F46' } };
                        }
                    } else if (colNumber === 14) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '0.0%';
                    }
                } else {
                    if ([1, 2, 3, 6, 8, 9, 12].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'center' };
                    } else if ([4, 5].includes(colNumber)) {
                        cell.alignment = { vertical: 'middle', horizontal: 'left', indent: 0.5 };
                    } else if (colNumber === 7) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '#,##0';
                        cell.font = { name: 'Meiryo', size: 10, bold: true };
                    } else if (colNumber === 10) {
                        cell.alignment = { vertical: 'middle', horizontal: 'right' };
                        cell.numFmt = '¥#,##0.00;[Red]-¥#,##0.00;"-"';
                    } else if (colNumber === 11) {
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
}
