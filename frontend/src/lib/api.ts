import axios from 'axios';

const API_URL = 'http://localhost:8000';

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
    return response.data;
};

export const addReport = async (report: Omit<Report, '管理番号'>, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await axios.post(`${API_URL}/reports`, report, { params });
    return response.data;
};

export const updateReport = async (managementNumber: number, report: Omit<Report, '管理番号'>, filename?: string) => {
    const params = filename ? { filename } : {};
    const response = await axios.put(`${API_URL}/reports/${managementNumber}`, report, { params });
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

export const getInterviewers = async (customerCode: string, filename?: string): Promise<string[]> => {
    const params: any = { customer_code: customerCode };
    if (filename) params.filename = filename;
    const response = await axios.get(`${API_URL}/interviewers`, { params });
    return response.data;
};

export interface Design {
    デザイン依頼No: number;
    デザイン名: string;
    デザイン種別: string;
    デザイン進捗状況: string;
    デザイン提案有無: string;
}

export const getDesigns = async (customerCd: string, filename?: string): Promise<Design[]> => {
    const params = filename ? { filename } : {};
    const response = await axios.get(`${API_URL}/designs/${customerCd}`, { params });
    return response.data.designs;
};
