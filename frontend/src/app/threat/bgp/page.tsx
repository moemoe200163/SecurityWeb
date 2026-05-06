'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type BgpUpdate, type BgpStats } from '@/lib/api';
import { Loader2, Search, RefreshCw, ChevronLeft, ChevronRight } from 'lucide-react';

export default function BgpPage() {
  const [data, setData] = useState<BgpUpdate[]>([]);
  const [stats, setStats] = useState<BgpStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState<'prefix' | 'asn'>('prefix');
  const [searchValue, setSearchValue] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: { prefix?: string; asn?: string; page: number; limit: number } = { page: currentPage, limit };
      if (searchType === 'prefix' && searchValue) {
        params.prefix = searchValue;
      } else if (searchType === 'asn' && searchValue) {
        params.asn = searchValue;
      }

      const [queryRes, statsRes] = await Promise.all([
        api.bgp.query(params),
        api.bgp.stats()
      ]);

      setData(queryRes.data);
      setStats(statsRes);
      setTotal(queryRes.pagination.total);
      setTotalPages(queryRes.pagination.totalPages);
    } catch (err) {
      console.error('Failed to load BGP data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchType, searchValue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    loadData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">BGP Tools</h1>
            <p className="text-sm text-gray-500 mt-1">查詢最近 24 小時的 BGP 路由資料</p>
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
              <p className="text-sm text-gray-500">總更新數</p>
              <p className="text-2xl font-semibold">{stats.totalUpdates.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <p className="text-sm text-emerald-600">Announce</p>
              <p className="text-2xl font-semibold text-emerald-700">{stats.announces.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <p className="text-sm text-red-600">Withdraw</p>
              <p className="text-2xl font-semibold text-red-700">{stats.withdraws.toLocaleString()}</p>
            </div>
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-4">
              <p className="text-sm text-blue-600">Prefix 數</p>
              <p className="text-2xl font-semibold text-blue-700">{stats.uniquePrefixes.toLocaleString()}</p>
            </div>
            <div className="bg-purple-50 rounded-lg border border-purple-200 p-4">
              <p className="text-sm text-purple-600">AS 數</p>
              <p className="text-2xl font-semibold text-purple-700">{stats.uniqueAsns.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-white rounded-lg border p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <select
            value={searchType}
            onChange={e => setSearchType(e.target.value as 'prefix' | 'asn')}
            className="border rounded-lg px-4 py-2 bg-white"
          >
            <option value="prefix">Prefix</option>
            <option value="asn">ASN</option>
          </select>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              placeholder={searchType === 'prefix' ? '例如: 192.168.1.0/24' : '例如: 15169'}
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            查詢
          </button>
        </form>

        {/* Results Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p>沒有找到符合條件的 BGP 記錄</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">時間</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">類型</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prefix</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">AS Path</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Origin ASN</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">國家</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 text-sm text-gray-500">{new Date(item.timestamp).toLocaleString('zh-TW')}</td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${item.type === 'A' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                            {item.type === 'A' ? 'Announce' : 'Withdraw'}
                          </span>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm">{item.prefix}</td>
                        <td className="px-6 py-4 font-mono text-sm text-gray-500 truncate max-w-xs">{item.asPath || '-'}</td>
                        <td className="px-6 py-4 font-mono text-sm">{item.originAsn || '-'}</td>
                        <td className="px-6 py-4 text-sm">{item.country || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex items-center justify-between px-6 py-4 border-t">
                <p className="text-sm text-gray-500">
                  顯示 {(currentPage - 1) * limit + 1} - {Math.min(currentPage * limit, total)}，共 {total} 筆
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
    </div>
  );
}
