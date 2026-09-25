import { useEffect } from 'react';

/**
 * 保存中などの重要な処理中に、ユーザーが誤ってブラウザのタブ・ウィンドウを閉じたり
 * ページを再読み込み・離脱したりするのを防止するカスタムフック
 *
 * @param isPreventing true の間、離脱確認ダイアログ（beforeunload）を表示
 */
export function usePreventUnload(isPreventing: boolean) {
    useEffect(() => {
        if (!isPreventing) return;

        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            // 標準的な離脱防止処理
            e.preventDefault();
            // 一部のブラウザ（Chrome / Edge 等）でダイアログをトリガーするために空文字や戻り値が必要
            e.returnValue = '';
            return '';
        };

        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            window.removeEventListener('beforeunload', handleBeforeUnload);
        };
    }, [isPreventing]);
}
