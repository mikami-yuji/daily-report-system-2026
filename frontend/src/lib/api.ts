import axios from 'axios';

const API_URL = process.env.NODE_ENV === 'development' ? '/api' : '';

export interface Report {
    管理番号: number;
    日付: string;
    行動内容: string;
    エリア: string;
    得意先CD: string;
    直送先CD: string;
    訪問先名: string;
    直送先名: string;
    重点顧客: string;
    ランク: string;
    得意先目標: string;
    面談者: string;
    滞在時間: string;
    デザイン提案有無: string;
    デザイン種別: string;
    デザイン名: string;
    デザイン進捗状況: string;
    'デザイン依頼No.': string;
    商談内容: string;
    提案物: string;
    次回プラン: string;
    競合他社情報: string;
    上長コメント: string;
    コメント返信欄: string;
    上長: string;
    山澄常務: string;
    岡本常務: string;
    中野次長: string;
    既読チェック: string;
    'システム確認用デザインNo.': string;
    original_values?: { [key: string]: any }; // For optimistic locking
}

export interface ExcelFile {
    name: string;
    size: number;
    modified: string;
}

export const getFiles = async (): Promise<{ files: ExcelFile[]; default: string }> => {
    const response = await axios.get(`${API_URL}/files`);
    return response.data;
};

export const getReports = async (filename?: string): Promise<Report[]> => {
    const params = filename ? { filename } : {};
    const response = await axios.get(`${API_URL}/reports`, { params });
    if (!Array.isArray(response.data)) {
        console.warn('getReports received non-array data:', response.data);
        return [];
    }
    return response.data;
};

export const addReport = async (report: Omit<Report, '管理番号'>, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await axios.post(`${API_URL}/reports`, report, { params });
    return response.data;
};

export const updateReport = async (managementNumber: number, report: Partial<Omit<Report, '管理番号'>>, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await axios.post(`${API_URL}/reports/${managementNumber}`, report, { params });
    return response.data;
};

// シンプルな返信専用API（楽観的ロックなし）
export const updateReportReply = async (managementNumber: number, reply: string, filename?: string): Promise<{ success: boolean }> => {
    const params = filename ? { filename } : {};
    const response = await axios.patch(`${API_URL}/reports/${managementNumber}/reply`, { コメント返信欄: reply }, { params });
    return response.data;
};

export const deleteReport = async (managementNumber: number, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await axios.delete(`${API_URL}/reports/${managementNumber}`, { params });
    return response.data;
};

export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post(`${API_URL}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};

export interface Customer {
    得意先CD: string;
    得意先名: string;
    フリガナ: string;
    直送先CD?: string;
    直送先名?: string;
    エリア: string;
    重点顧客: string;
    ランク: string;
    [key: string]: any;
}

export const getCustomers = async (filename?: string): Promise<Customer[]> => {
    const params = filename ? { filename } : {};
    const response = await axios.get(`${API_URL}/customers`, { params });
    return response.data;
};

export const getInterviewers = async (customerCode: string, filename?: string, customerName?: string, deliveryName?: string): Promise<string[]> => {
    const params: any = {};
    if (filename) params.filename = filename;
    if (customerName) params.customer_name = customerName;
    if (deliveryName) params.delivery_name = deliveryName;

    // Use path parameter for customerCode to match backend
    const response = await axios.get(`${API_URL}/interviewers/${encodeURIComponent(customerCode)}`, { params });
    // Backend returns { customer_cd: ..., interviewers: [...] }
    return response.data.interviewers;
};

export interface Design {
    デザイン依頼No: number;
    デザイン名: string;
    デザイン種別: string;
    デザイン進捗状況: string;
    デザイン提案有無: string;
}

export const getDesigns = async (customerCd: string, filename?: string, deliveryName?: string): Promise<Design[]> => {
    const params: any = {};
    if (filename) params.filename = filename;
    if (deliveryName) params.delivery_name = deliveryName;
    const response = await axios.get(`${API_URL}/designs/${customerCd}`, { params });
    return response.data.designs;
};

// Image Interface
export interface DesignImage {
    name: string;
    path: string;
    folder: string;
}

export const getDesignImages = async (filename: string): Promise<{ images: DesignImage[], folder?: string, message?: string }> => {
    try {
        const response = await axios.get(`${API_URL}/images/list`, {
            params: { filename }
        });
        return response.data;
    } catch (error) {
        console.error('Error fetching design images:', error);
        return { images: [], message: 'Failed to fetch images' };
    }
};

export const searchDesignImages = async (query: string, filename?: string): Promise<{ images: DesignImage[], query?: string, message?: string }> => {
    try {
        const params: any = { query };
        if (filename) {
            params.filename = filename;
        }
        const response = await axios.get(`${API_URL}/images/search`, {
            params
        });
        return response.data;
    } catch (error) {
        console.error('Error searching design images:', error);
        return { images: [], message: 'Failed to search images' };
    }
};

export const getImageUrl = (path: string): string => {
    return `${API_URL}/images/content?path=${encodeURIComponent(path)}`;
};
// ... existing exports ...

export interface SalesData {
    rank: number;
    rank_class: string;
    customer_code: string;
    customer_name: string;
    sales_amount: number;
    gross_profit: number;
    sales_yoy: number;
    sales_last_year: number;
    profit_last_year: number;
    sales_2y_ago: number;
    profit_2y_ago: number;
    area?: string;
}

export const getAllSales = async (): Promise<SalesData[]> => {
    try {
        const response = await axios.get(`${API_URL}/sales/all`);
        if (!Array.isArray(response.data)) {
            console.warn('getAllSales received non-array data:', response.data);
            return [];
        }
        return response.data;
    } catch (error) {
        console.error('Error fetching all sales data:', error);
        return [];
    }
};
