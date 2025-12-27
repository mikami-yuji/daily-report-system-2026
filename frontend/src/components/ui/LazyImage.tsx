'use client';

import React, { useState, memo } from 'react';

type LazyImageProps = {
    src: string;
    alt: string;
    className?: string;
};

// 遅延読み込み画像コンポーネント（スケルトンUI付き）
const LazyImage = memo(function LazyImage({ src, alt, className = '' }: LazyImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [hasError, setHasError] = useState(false);

    return (
        <div className="relative w-full h-full">
            {/* スケルトンUI */}
            {!isLoaded && !hasError && (
                <div className="absolute inset-0 bg-gray-200 animate-pulse flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-gray-300 border-t-gray-500 rounded-full animate-spin" />
                </div>
            )}

            {/* エラー時の表示 */}
            {hasError && (
                <div className="absolute inset-0 bg-gray-100 flex items-center justify-center text-gray-400">
                    <div className="text-center">
                        <svg className="w-8 h-8 mx-auto mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <span className="text-xs">読込失敗</span>
                    </div>
                </div>
            )}

            {/* 実際の画像 */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src}
                alt={alt}
                className={`${className} ${isLoaded ? 'opacity-100' : 'opacity-0'} transition-opacity duration-300`}
                loading="lazy"
                onLoad={() => setIsLoaded(true)}
                onError={() => setHasError(true)}
            />
        </div>
    );
});

export default LazyImage;
