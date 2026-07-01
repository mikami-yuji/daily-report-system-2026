export type CalendarDay = {
    date: Date;
    dateString: string;
    isCurrentMonth: boolean;
    visits: {
        customerName: string;
        action: string;
        managementNumber: number;
        hasDesign: boolean;
        // 追加フィールド
        interviewer?: string;
        stayTime?: string;
        commercialContent?: string;
        designType?: string;
        designName?: string;
    }[];
};

export type MonthData = {
    year: number;
    month: number;
    days: CalendarDay[];
    totalVisits: number;
    uniqueCustomers: number;
};
