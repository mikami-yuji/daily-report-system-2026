
export interface CustomerSummary {
    id: string; // Unique ID for React Key (e.g. code or code-ddCode)
    code: string;
    name: string;
    area: string;
    totalActivities: number;
    visits: number;
    calls: number;
    designRequests: number;
    designNos?: Set<string>;  // 内部追跡用（ユニークなデザインNo.）
    isPriority: boolean;
    lastActivity: string;
    rank: string;
    currentTarget?: string;  // 得意先_Listの「現目標」(カラムJ)
    // Shared fields for Direct Delivery
    isDirectDelivery?: boolean;
    directDeliveryCode?: string;
    directDeliveryName?: string;
    subItems?: CustomerSummary[];
}

