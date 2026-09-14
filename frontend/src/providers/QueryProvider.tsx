'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// QueryClientのデフォルト設定
function makeQueryClient(): QueryClient {
    return new QueryClient({
        defaultOptions: {
            queries: {
                // データの新鮮さを5分間維持（5分以内は再取得しない）
                staleTime: 5 * 60 * 1000,
                // キャッシュは30分間保持
                gcTime: 30 * 60 * 1000,
                // 失敗時のリトライ回数
                retry: 2,
                // ウィンドウフォーカス時の自動再取得を無効化
                refetchOnWindowFocus: false,
            },
        },
    });
}

let browserQueryClient: QueryClient | undefined = undefined;

function getQueryClient(): QueryClient {
    if (typeof window === 'undefined') {
        // サーバーサイド: 常に新しいQueryClientを作成
        return makeQueryClient();
    } else {
        // ブラウザサイド: シングルトンを使用
        if (!browserQueryClient) browserQueryClient = makeQueryClient();
        return browserQueryClient;
    }
}

type Props = {
    children: React.ReactNode;
};

export default function QueryProvider({ children }: Props): React.ReactNode {
    const queryClient = getQueryClient();

    return (
        <QueryClientProvider client={queryClient}>
            {children}
        </QueryClientProvider>
    );
}
