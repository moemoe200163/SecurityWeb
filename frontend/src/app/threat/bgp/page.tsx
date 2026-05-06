'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type BgpUpdate, type BgpStats, type PaginationInfo } from '@/lib/api';
import { Loader2, Search, Network, RefreshCw, ChevronLeft, ChevronRight, X, ArrowUp, ArrowDown, Globe } from 'lucide-react';

export default function BgpPage() {
  const [data, setData] = useState<BgpUpdate[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<BgpStats | null>(null);
  const [searchPrefix, setSearchPrefix] = useState('');
  const [searchAsn, setSearchAsn] = useState('');
  const [selectedRecord, setSelectedRecord] = useState<BgpUpdate | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [queryRes, statsRes] = await Promise.all([
        api.bgp.query({
          page: currentPage,
          limit,
          prefix: searchPrefix || undefined,
          asn: searchAsn || undefined,
        }),
        api.bgp.stats()
      ]);
      setData(queryRes.data);
      setPagination(queryRes.pagination);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load BGP data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchPrefix, searchAsn]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getTypeBadge = (type: 'A' | 'W') => {
    if (type === 'A') {
      return <span className="px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
        <ArrowUp className="h-3 w-3" /> 公告
      </span>;
    } else {
      return <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full flex items-center gap-1">
        <ArrowDown className="h-3 w-3" /> 撤回
      </span>;
    }
  };

  const handleSearch = () => {
    setCurrentPage(1);
    loadData();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePageChange = (page: number) => {
    const totalPages = pagination?.totalPages || 1;
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleClearFilters = () => {
    setSearchPrefix('');
    setSearchAsn('');
    setCurrentPage(1);
  };

  const totalPages = pagination?.totalPages || 1;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">BGP 路由查詢</h1>
            <p className="text-sm text-gray-500 mt-1">查詢網路前缀與自治系統號 (ASN) 路由變更</p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            重新整理
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">24小時更新總數</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.totalUpdates.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <p className="text-sm text-emerald-600">公告 (Announce)</p>
              <p className="text-2xl font-semibold text-emerald-700">{stats.announces.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <p className="text-sm text-red-600">撤回 (Withdraw)</p>
              <p className="text-2xl font-semibold text-red-700">{stats.withdraws.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <p className="text-sm text-blue-600">唯一前綴</p>
              <p className="text-2xl font-semibold text-blue-700">{stats.uniquePrefixes.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <p className="text-sm text-purple-600">唯一 ASN</p>
              <p className="text-2xl font-semibold text-purple-700">{stats.uniqueAsns.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-lg border p-4 mb-6">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchPrefix}
                onChange={e => setSearchPrefix(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="搜尋前缀 (例如：1.1.1.0/24)..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="relative flex-1">
              <Network className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchAsn}
                onChange={e => setSearchAsn(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="搜尋 ASN (例如：15169)..."
                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSearch}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Search className="h-4 w-4" />
                搜尋
              </button>
              {(searchPrefix || searchAsn) && (
                <button
                  onClick={handleClearFilters}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
                >
                  <X className="h-4 w-4" />
                  清除
                </button>
              )}
            </div>
          </div>
        </div>

        {/* BGP Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Globe className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>沒有找到符合條件的 BGP 記錄</p>
              <p className="text-sm mt-2">嘗試調整搜尋條件</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">前缀</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">原始 ASN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AS 路徑</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">對等 ASN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">來源</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">國家</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedRecord(item)}
                      >
                        <td className="px-6 py-4">
                          {getTypeBadge(item.type)}
                        </td>
                        <td className="px-6 py-4 font-mono text-sm">{item.prefix}</td>
                        <td className="px-6 py-4 font-mono text-sm text-blue-600">{item.originAsn || '-'}</td>
                        <td className="px-6 py-4 font-mono text-sm text-gray-600 truncate max-w-xs">{item.asPath || '-'}</td>
                        <td className="px-6 py-4 font-mono text-sm text-gray-500">{item.peerAsn || '-'}</td>
                        <td className="px-6 py-4 text-sm">{item.source || '-'}</td>
                        <td className="px-6 py-4 text-sm">{item.country || '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(item.timestamp).toLocaleString('zh-TW')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-gray-500">
                  顯示 {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, pagination?.total || 0)}，共 {pagination?.total || 0} 筆
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <span className="text-sm">
                    第 {currentPage} / {totalPages} 頁
                  </span>
                  <button
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                    className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedRecord(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">BGP 詳細資料</h2>
              <button onClick={() => setSelectedRecord(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xl">{selectedRecord.prefix}</span>
                {getTypeBadge(selectedRecord.type)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">原始 ASN</p>
                  <p className="font-medium font-mono">{selectedRecord.originAsn || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">對等 ASN</p>
                  <p className="font-medium font-mono">{selectedRecord.peerAsn || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">來源</p>
                  <p className="font-medium">{selectedRecord.source || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">國家</p>
                  <p className="font-medium">{selectedRecord.country || '-'}</p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-500 mb-2">AS 路徑</p>
                <p className="font-mono text-sm bg-gray-50 p-3 rounded-lg break-all">
                  {selectedRecord.asPath || '-'}
                </p>
              </div>

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">時間戳</p>
                <p className="text-sm">{new Date(selectedRecord.timestamp).toLocaleString('zh-TW')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
