/**
 * React Query カスタムフック
 * データ取得を統一的に管理し、キャッシュを活用
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useFile } from '@/context/FileContext';
import {
    getReports,
    getFiles,
    getCustomers,
    getAllSales,
    addReport,
    updateReport,
    deleteReport
} from '@/lib/api';
import {
    Report,
    ExcelFile,
    Customer,
    SalesData
} from '@/types/report';
import toast from 'react-hot-toast';

// クエリキー定数
export const queryKeys = {
    reports: (filename?: string) => ['reports', filename] as const,
    files: ['files'] as const,
    customers: (filename?: string) => ['customers', filename] as const,
    sales: ['sales'] as const,
};

/**
 * 日報データ取得フック
 */
export function useReports(filename?: string) {
    return useQuery({
        queryKey: queryKeys.reports(filename),
        queryFn: () => getReports(filename),
        enabled: !!filename, // ファイル名がある場合のみ実行
    });
}

/**
 * Excelファイル一覧取得フック
 */
export function useFiles() {
    return useQuery({
        queryKey: queryKeys.files,
        queryFn: getFiles,
    });
}

/**
 * 顧客一覧取得フック
 */
export function useCustomers(filename?: string) {
    return useQuery({
        queryKey: queryKeys.customers(filename),
        queryFn: () => getCustomers(filename),
        enabled: !!filename,
    });
}

/**
 * 売上データ取得フック
 */
export function useSales() {
    return useQuery({
        queryKey: queryKeys.sales,
        queryFn: getAllSales,
    });
}

/**
 * 日報追加ミューテーション
 */
export function useAddReport() {
    const queryClient = useQueryClient();
    const { selectedFile } = useFile();

    return useMutation({
        mutationFn: (report: Omit<Report, '管理番号'>) => addReport(report, selectedFile || undefined),
        onSuccess: () => {
            // キャッシュを無効化して再取得
            queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
            toast.success('日報を追加しました');
        },
        onError: (error: Error) => {
            toast.error(`日報の追加に失敗しました: ${error.message}`);
        },
    });
}

/**
 * 日報更新ミューテーション
 */
export function useUpdateReport() {
    const queryClient = useQueryClient();
    const { selectedFile } = useFile();

    return useMutation({
        mutationFn: ({ managementNumber, report }: { managementNumber: number; report: Partial<Omit<Report, '管理番号'>> }) =>
            updateReport(managementNumber, report, selectedFile || undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
            toast.success('日報を更新しました');
        },
        onError: (error: Error) => {
            toast.error(`日報の更新に失敗しました: ${error.message}`);
        },
    });
}

/**
 * 日報削除ミューテーション
 */
export function useDeleteReport() {
    const queryClient = useQueryClient();
    const { selectedFile } = useFile();

    return useMutation({
        mutationFn: (managementNumber: number) => deleteReport(managementNumber, selectedFile || undefined),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: queryKeys.reports(selectedFile || undefined) });
            toast.success('日報を削除しました');
        },
        onError: (error: Error) => {
            toast.error(`日報の削除に失敗しました: ${error.message}`);
        },
    });
}
