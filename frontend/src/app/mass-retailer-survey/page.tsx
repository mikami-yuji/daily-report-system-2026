'use client';

import { useEffect, useState } from 'react';
import { useFile } from '@/context/FileContext';
import { getReports, Report } from '@/lib/api';
import { Search, MapPin, Calendar, Building2 } from 'lucide-react';

export default function MassRetailerSurveyPage() {
    const { selectedFile } = useFile();
    const [reports, setReports] = useState<Report[]>([]);
    const [filteredReports, setFilteredReports] = useState<Report[]>([]);
    const [loading, setLoading] = useState(true);
    const [keyword, setKeyword] = useState('');
    const [selectedArea, setSelectedArea] = useState<string>('all');
    const [areas, setAreas] = useState<string[]>([]);

    useEffect(() => {
        loadReports();
    }, [selectedFile]);

    useEffect(() => {
        filterReports();
    }, [reports, keyword, selectedArea]);

    const loadReports = async () => {
        if (!selectedFile) return;
        try {
            setLoading(true);
            const data = await getReports(selectedFile);

            // Filter for mass retailer survey reports (行動内容：量販店調査)
            const surveyReports = data.filter(report => {
                const action = String(report.行動内容 || '');
                return action.includes('量販店調査');
            });

            setReports(surveyReports);

            // Extract unique areas
            const uniqueAreas = Array.from(new Set(
                surveyReports
                    .map(r => r.エリア)
                    .filter(area => area && area !== '')
            )).sort();
            setAreas(uniqueAreas);
        } catch (error) {
            console.error('Failed to load reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const filterReports = () => {
        let filtered = [...reports];

        // Apply keyword filter
        if (keyword.trim()) {
            const lowerKeyword = keyword.toLowerCase();
            filtered = filtered.filter(report => {
                const searchText = [
                    report.訪問先名,
                    report.コメント,
                    report.エリア,
                    report.行動内容
                ].join(' ').toLowerCase();
                return searchText.includes(lowerKeyword);
            });
        }

        // Apply area filter
        if (selectedArea !== 'all') {
            filtered = filtered.filter(report => report.エリア === selectedArea);
        }

        // Sort by date (newest first)
        filtered.sort((a, b) => {
            const dateA = a.日付 || '';
            const dateB = b.日付 || '';
            return dateB.localeCompare(dateA);
        });

        setFilteredReports(filtered);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen flex-col">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sf-light-blue mx-auto mb-4"></div>
                    <p className="text-sf-text-weak">データを読み込んでいます...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">量販店調査検索</h1>
                <p className="text-gray-600">量販店調査レポートの検索と閲覧</p>
            </div>

            {/* Search and Filter Controls */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Keyword Search */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            キーワード検索
                        </label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <input
                                type="text"
                                value={keyword}
                                onChange={(e) => setKeyword(e.target.value)}
                                placeholder="訪問先名、コメント等で検索..."
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sf-light-blue focus:border-sf-light-blue outline-none"
                            />
                        </div>
                    </div>

                    {/* Area Filter */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            エリア
                        </label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                            <select
                                value={selectedArea}
                                onChange={(e) => setSelectedArea(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sf-light-blue focus:border-sf-light-blue outline-none appearance-none bg-white"
                            >
                                <option value="all">すべてのエリア</option>
                                {areas.map(area => (
                                    <option key={area} value={area}>{area}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Results Count */}
                <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-sm text-gray-600">
                        <span className="font-semibold text-sf-light-blue">{filteredReports.length}</span> 件の調査レポート
                    </p>
                </div>
            </div>

            {/* Timeline Display */}
            <div className="space-y-4">
                {filteredReports.length === 0 ? (
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                        <Building2 className="mx-auto text-gray-400 mb-4" size={48} />
                        <p className="text-gray-600">該当する調査レポートがありません</p>
                        <p className="text-sm text-gray-500 mt-2">検索条件を変更してください</p>
                    </div>
                ) : (
                    filteredReports.map((report, index) => (
                        <div
                            key={index}
                            className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                        {report.訪問先名 || '訪問先不明'}
                                    </h3>
                                    <div className="flex items-center gap-4 text-sm text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Calendar size={14} />
                                            <span>{report.日付}</span>
                                        </div>
                                        {report.エリア && (
                                            <div className="flex items-center gap-1">
                                                <MapPin size={14} />
                                                <span>{report.エリア}</span>
                                            </div>
                                        )}
                                        {report.面談者 && (
                                            <span className="text-gray-500">担当: {report.面談者}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <span className="inline-block px-3 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                        量販店調査
                                    </span>
                                    {report.管理番号 && (
                                        <p className="text-xs text-gray-500 mt-1">No. {report.管理番号}</p>
                                    )}
                                </div>
                            </div>

                            {/* Content */}
                            {report.コメント && (
                                <div className="mb-3">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">コメント</h4>
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.コメント}</p>
                                    </div>
                                </div>
                            )}

                            {/* 商談内容 */}
                            {report.商談内容 && (
                                <div className="mb-3">
                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">商談内容</h4>
                                    <div className="bg-blue-50 rounded-lg p-4 border border-blue-100">
                                        <p className="text-sm text-gray-700 whitespace-pre-wrap">{report.商談内容}</p>
                                    </div>
                                </div>
                            )}

                            {/* Additional Info */}
                            <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                                {report.ランク && (
                                    <div>
                                        <span className="text-gray-500">ランク:</span>
                                        <span className="ml-2 font-medium text-gray-900">{report.ランク}</span>
                                    </div>
                                )}
                                {report.重点顧客 && report.重点顧客 !== '-' && (
                                    <div>
                                        <span className="text-gray-500">重点顧客:</span>
                                        <span className="ml-2 font-medium text-orange-600">{report.重点顧客}</span>
                                    </div>
                                )}
                                {report.デザイン提案有無 && (
                                    <div>
                                        <span className="text-gray-500">デザイン提案:</span>
                                        <span className={`ml-2 font-medium ${report.デザイン提案有無 === 'あり' ? 'text-purple-600' : 'text-gray-600'}`}>
                                            {report.デザイン提案有無}
                                        </span>
                                    </div>
                                )}
                                {report.デザイン進捗状況 && (
                                    <div>
                                        <span className="text-gray-500">進捗:</span>
                                        <span className="ml-2 font-medium text-gray-900">{report.デザイン進捗状況}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
