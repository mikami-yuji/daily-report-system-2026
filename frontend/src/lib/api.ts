import axios from 'axios';
import toast from 'react-hot-toast';
import {
    Report,
    ExcelFile,
    Customer,
    Design,
    DesignImage,
    DashboardStats,
    MonthlySummaryStats,
    SalesData,
    PriorityCustomer,
    ViewerDesignRequest,
} from '@/types/report';

export type {
    Report,
    ExcelFile,
    Customer,
    Design,
    DesignImage,
    DashboardStats,
    MonthlySummaryStats,
    SalesData,
    PriorityCustomer,
    ViewerDesignRequest,
};

// 常に/apiプレフィックスを使用（EXE版でのルート競合を防ぐため）
const API_URL = '/api';

// タイムアウト設定（ミリ秒）
const DEFAULT_TIMEOUT = 30000; // 30秒
const LONG_TIMEOUT = 60000;    // 60秒（ファイル操作用）

// axiosインスタンス作成（タイムアウト付き）
const api = axios.create({
    timeout: DEFAULT_TIMEOUT,
});

// 長時間操作用インスタンス
const apiLong = axios.create({
    timeout: LONG_TIMEOUT,
});

// エラーハンドリングの共通インターセプター設定
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const handleResponseError = (error: any): Promise<never> => {
    const isProxy401 = error.config?.url?.includes('/proxy/') && error.response?.status === 401;
    let message = error.response?.data?.detail || error.response?.data?.message || error.message || '通信エラーが発生しました';
    console.error('API Error:', error);
    if (isProxy401) {
        const currentHost = typeof window !== 'undefined' ? window.location.hostname : '';
        let redirectNotice = '';
        if (currentHost === 'localhost' || currentHost === '127.0.0.1') {
            redirectNotice = '\n★Cookie共有のため、日報システムへも「http://192.168.1.5:8001」でアクセスし直す必要があります。';
        }
        message = `企画課ビューアへのログインが必要です。下記URLからログインしてください。\nhttp://192.168.1.5:8888/viewer.html${redirectNotice}`;
        toast.error(`通信エラー: ${message}`, {
            duration: 12000, // URLと案内を確認・コピーしやすくするため表示時間を長め(12秒)に設定
        });
    } else {
        toast.error(`通信エラー: ${message}`);
    }
    return Promise.reject(error);
};

api.interceptors.response.use(
    (response) => response,
    handleResponseError
);

apiLong.interceptors.response.use(
    (response) => response,
    handleResponseError
);

export const getFiles = async (): Promise<{ files: ExcelFile[]; default: string }> => {
    const response = await api.get(`${API_URL}/files`);
    return response.data;
};

export const getReports = async (filename?: string): Promise<Report[]> => {
    const params = filename ? { filename } : {};
    const response = await api.get(`${API_URL}/reports`, { params });
    if (!Array.isArray(response.data)) {
        console.warn('getReports received non-array data:', response.data);
        return [];
    }
    return response.data;
};

export const addReport = async (report: Omit<Report, '管理番号'>, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await apiLong.post(`${API_URL}/reports`, report, { params });
    return response.data;
};

export const updateReport = async (managementNumber: number, report: Partial<Omit<Report, '管理番号'>>, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await apiLong.post(`${API_URL}/reports/${managementNumber}`, report, { params });
    return response.data;
};

// シンプルな返信専用API（楽観的ロックなし）
export const updateReportReply = async (managementNumber: number, reply: string, filename?: string): Promise<{ success: boolean }> => {
    const params = filename ? { filename } : {};
    const response = await api.patch(`${API_URL}/reports/${managementNumber}/reply`, { コメント返信欄: reply }, { params });
    return response.data;
};

// コメント更新専用API（上長コメントとコメント返信欄を個別に更新）
export const updateReportComment = async (
    managementNumber: number,
    comment: { 上長コメント?: string; コメント返信欄?: string; original_values?: Record<string, unknown> },
    filename?: string
): Promise<{ success: boolean }> => {
    const params = filename ? { filename } : {};
    const response = await api.patch(`${API_URL}/reports/${managementNumber}/comment`, comment, { params });
    return response.data;
};

// 承認チェック更新専用API（上長、山澄常務、岡本常務、中野次長、既読チェックを個別に更新）
export const updateReportApproval = async (
    managementNumber: number,
    approval: { 上長?: string; 山澄常務?: string; 岡本常務?: string; 中野次長?: string; 既読チェック?: string; original_values?: Record<string, unknown> },
    filename?: string
): Promise<{ success: boolean }> => {
    const params = filename ? { filename } : {};
    const response = await api.patch(`${API_URL}/reports/${managementNumber}/approval`, approval, { params });
    return response.data;
};

export const deleteReport = async (managementNumber: number, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await api.delete(`${API_URL}/reports/${managementNumber}`, { params });
    return response.data;
};



// 重点顧客マスタ取得API（得意先_Listからカラム H が「重点」の顧客を取得）
export const getPriorityCustomers = async (filename?: string): Promise<PriorityCustomer[]> => {
    const params = filename ? { filename } : {};
    const response = await api.get(`${API_URL}/priority-customers`, { params });
    if (!Array.isArray(response.data)) {
        console.warn('getPriorityCustomers received non-array data:', response.data);
        return [];
    }
    return response.data;
};

export const uploadFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiLong.post(`${API_URL}/upload`, formData, {
        headers: {
            'Content-Type': 'multipart/form-data',
        },
    });
    return response.data;
};



export const getCustomers = async (filename?: string): Promise<Customer[]> => {
    const params = filename ? { filename } : {};
    const response = await api.get(`${API_URL}/customers`, { params });
    return response.data;
};

export const getInterviewers = async (customerCode: string, filename?: string, customerName?: string, deliveryName?: string): Promise<string[]> => {
    const params: Record<string, string> = {};
    if (filename) params.filename = filename;
    if (customerName) params.customer_name = customerName;
    if (deliveryName) params.delivery_name = deliveryName;

    // Use path parameter for customerCode to match backend
    const response = await api.get(`${API_URL}/interviewers/${encodeURIComponent(customerCode)}`, { params });
    // Backend returns { customer_cd: ..., interviewers: [...] }
    return response.data.interviewers;
};



export const getDesigns = async (customerCd: string, filename?: string, deliveryName?: string): Promise<Design[]> => {
    const params: Record<string, string> = {};
    if (filename) params.filename = filename;
    if (deliveryName) params.delivery_name = deliveryName;
    const response = await api.get(`${API_URL}/designs/${customerCd}`, { params });
    return response.data.designs;
};

export const getSuggestedArea = async (customerName: string, filename?: string): Promise<{ customer_name: string; suggested_area: string }> => {
    const params: Record<string, string> = { customer_name: customerName };
    if (filename) params.filename = filename;
    const response = await api.get(`${API_URL}/customers/suggest-area`, { params });
    return response.data;
};

// Image Interface

export const getDesignImages = async (filename: string): Promise<{ images: DesignImage[], folder?: string, message?: string }> => {
    try {
        const response = await apiLong.get(`${API_URL}/images/list`, {
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
        const params: Record<string, string> = { query };
        if (filename) {
            params.filename = filename;
        }
        const response = await apiLong.get(`${API_URL}/images/search`, {
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


export const getDashboardStats = async (filename?: string): Promise<DashboardStats> => {
    const params = filename ? { filename } : {};
    const response = await api.get(`${API_URL}/stats/dashboard`, { params });
    return response.data;
};



export const getMonthlySummaryStats = async (filename: string | undefined, month: string): Promise<MonthlySummaryStats> => {
    const params: Record<string, string> = { month };
    if (filename) params.filename = filename;
    const response = await api.get(`${API_URL}/stats/monthly-summary`, { params });
    return response.data;
};



export const getAllSales = async (): Promise<SalesData[]> => {
    try {
        const response = await api.get(`${API_URL}/sales/all`);
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

export const getLatestDesignRequests = async (passcode?: string): Promise<{ documents: ViewerDesignRequest[]; message?: string }> => {
    const params: Record<string, string> = {};
    if (passcode) {
        params.passcode = passcode;
    }
    const response = await api.get(`${API_URL}/proxy/design-requests`, { params });
    return response.data;
};
