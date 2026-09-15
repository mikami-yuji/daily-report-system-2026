import { Report } from './report';

export type CalendarVisit = {
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
    directDeliveryName?: string;
    directDeliveryCode?: string;
    report?: Report;
};

export type CalendarDay = {
    date: Date;
    dateString: string;
    isCurrentMonth: boolean;
    visits: CalendarVisit[];
};

export type MonthData = {
    year: number;
    month: number;
    days: CalendarDay[];
    totalVisits: number;
    uniqueCustomers: number;
};
