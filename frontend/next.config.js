/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === 'development';

const nextConfig = {
    images: {
        unoptimized: true,
    },
};

if (isDev) {
    nextConfig.rewrites = async () => {
        return [
            {
                source: '/api/:path*',
                destination: 'http://127.0.0.1:8001/api/:path*',
            },
        ];
    };
} else {
    nextConfig.output = 'export';
}

module.exports = nextConfig;
