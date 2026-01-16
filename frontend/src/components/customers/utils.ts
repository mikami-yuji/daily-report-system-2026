import { Report, Customer } from '@/lib/api';
import { CustomerSummary } from './types';

// 得意先マスタから現目標を取得するためのマップを作成
export const createCustomerTargetMap = (customers: Customer[]): Map<string, string> => {
    const map = new Map<string, string>();
    customers.forEach(customer => {
        const code = String(customer.得意先CD || '');
        const ddCode = customer.直送先CD ? String(customer.直送先CD) : '';
        const target = String(customer['現目標'] || '');

        if (code && target) {
            // 直送先コードがある場合は得意先CD-直送先CDをキーにする
            const key = ddCode ? `${code}-${ddCode}` : code;
            map.set(key, target);
        }
    });
    return map;
};

export const processCustomers = (data: Report[], customerTargetMap?: Map<string, string>): CustomerSummary[] => {
    const customerMap = new Map<string, CustomerSummary>();

    // Create base stats object
    const createStats = (code: string, name: string, area: string, rank: string, isPriority: boolean, isDD: boolean = false, ddCode: string = '', ddName: string = '') => {
        const key = isDD ? `${code}-${ddCode}` : code;
        return {
            id: key,
            code,
            name,
            area,
            totalActivities: 0,
            visits: 0,
            calls: 0,
            designRequests: 0,
            designNos: new Set<string>(),  // ユニークなデザインNo.を追跡
            isPriority: isPriority,
            lastActivity: '',
            rank,
            currentTarget: customerTargetMap?.get(key) || '',  // 得意先マスタから現目標を取得
            isDirectDelivery: isDD,
            directDeliveryCode: ddCode,
            directDeliveryName: ddName,
            subItems: isDD ? undefined : []
        };
    };

    data.forEach(report => {
        const code = String(report.得意先CD || '');
        const name = String(report.訪問先名 || '').split('　')[0]; // Extract main customer name if concatenated

        if (!code) return;

        // Ensure Parent Exists
        if (!customerMap.has(code)) {
            customerMap.set(code, createStats(
                code,
                name,
                String(report.エリア || ''),
                String(report.ランク || ''),
                !!(report.重点顧客 && report.重点顧客 !== '-' && report.重点顧客 !== '')
            ));
        }

        const parent = customerMap.get(code)!;

        // Check for Direct Delivery
        const ddCode = report.直送先CD ? String(report.直送先CD) : '';
        const ddName = report.直送先名 ? String(report.直送先名) : '';
        const isPriorityReport = !!(report.重点顧客 && report.重点顧客 !== '-' && report.重点顧客 !== '');

        let target = parent; // Defaults to updating parent

        if (ddCode) {
            // It's a Direct Delivery activity
            // Find or create SubItem
            let sub = parent.subItems?.find(s => s.directDeliveryCode === ddCode);
            if (!sub) {
                sub = createStats(
                    code,
                    name,
                    String(report.エリア || ''),
                    String(report.ランク || ''),
                    isPriorityReport,  // 直送先も重点顧客をチェック
                    true,
                    ddCode,
                    ddName
                );
                parent.subItems?.push(sub);
            } else {
                // 既存の直送先でも、重点顧客フラグを更新（一度でも重点顧客なら維持）
                if (isPriorityReport) {
                    sub.isPriority = true;
                }
            }
            target = sub;
        }

        // Update Stats for Target (DD or Parent)
        target.totalActivities++;
        if (report.行動内容 && report.行動内容.includes('訪問')) target.visits++;
        if (report.行動内容 && report.行動内容.includes('電話')) target.calls++;
        const designNo = report['システム確認用デザインNo.'];
        if (designNo && !isNaN(Number(designNo)) && target.designNos) {
            target.designNos.add(String(designNo));
        }
        const reportDate = String(report.日付 || '');
        if (!target.lastActivity || reportDate > target.lastActivity) {
            target.lastActivity = reportDate;
            // 最新のレポートからランクを更新（空でない場合）
            const reportRank = String(report.ランク || '').trim();
            if (reportRank && reportRank !== '-') {
                target.rank = reportRank;
            }
        }

        // Update Parent Stats (Aggregate)
        if (target !== parent) {
            parent.totalActivities++;
            if (report.行動内容 && report.行動内容.includes('訪問')) parent.visits++;
            if (report.行動内容 && report.行動内容.includes('電話')) parent.calls++;
            if (designNo && !isNaN(Number(designNo)) && parent.designNos) {
                parent.designNos.add(String(designNo));
            }
            if (!parent.lastActivity || reportDate > parent.lastActivity) parent.lastActivity = reportDate;
        }
    });

    // Setからユニークなデザイン数を計算して返す
    return Array.from(customerMap.values())
        .map(customer => ({
            ...customer,
            designRequests: customer.designNos?.size || 0,
            subItems: customer.subItems?.map(sub => ({
                ...sub,
                designRequests: sub.designNos?.size || 0
            }))
        }))
        .sort((a, b) => b.totalActivities - a.totalActivities);
};
