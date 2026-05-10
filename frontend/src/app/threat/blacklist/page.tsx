'use client';

import { useState, useEffect, useCallback } from 'react';
import { api, type IpReputationResult, type IpReputationStats, type PaginationInfo } from '@/lib/api';
import { Loader2, Search, Shield, ShieldAlert, ShieldCheck, ShieldQuestion, RefreshCw, ChevronLeft, ChevronRight, X } from 'lucide-react';

// Country code to flag + name mapping
const COUNTRY_DATA: Record<string, { flag: string; name: string }> = {
  'US': { flag: '🇺🇸', name: 'United States' },
  'CN': { flag: '🇨🇳', name: 'China' },
  'JP': { flag: '🇯🇵', name: 'Japan' },
  'KR': { flag: '🇰🇷', name: 'Korea' },
  'DE': { flag: '🇩🇪', name: 'Germany' },
  'FR': { flag: '🇫🇷', name: 'France' },
  'GB': { flag: '🇬🇧', name: 'United Kingdom' },
  'NL': { flag: '🇳🇱', name: 'Netherlands' },
  'RU': { flag: '🇷🇺', name: 'Russia' },
  'IN': { flag: '🇮🇳', name: 'India' },
  'AU': { flag: '🇦🇺', name: 'Australia' },
  'BR': { flag: '🇧🇷', name: 'Brazil' },
  'CA': { flag: '🇨🇦', name: 'Canada' },
  'SG': { flag: '🇸🇬', name: 'Singapore' },
  'HK': { flag: '🇭🇰', name: 'Hong Kong' },
  'TW': { flag: '🇹🇼', name: 'Taiwan' },
  'IT': { flag: '🇮🇹', name: 'Italy' },
  'ES': { flag: '🇪🇸', name: 'Spain' },
  'PL': { flag: '🇵🇱', name: 'Poland' },
  'SE': { flag: '🇸🇪', name: 'Sweden' },
  'CH': { flag: '🇨🇭', name: 'Switzerland' },
  'BE': { flag: '🇧🇪', name: 'Belgium' },
  'AT': { flag: '🇦🇹', name: 'Austria' },
  'NO': { flag: '🇳🇴', name: 'Norway' },
  'DK': { flag: '🇩🇰', name: 'Denmark' },
  'FI': { flag: '🇫🇮', name: 'Finland' },
  'IE': { flag: '🇮🇪', name: 'Ireland' },
  'PT': { flag: '🇵🇹', name: 'Portugal' },
  'CZ': { flag: '🇨🇿', name: 'Czech Republic' },
  'HU': { flag: '🇭🇺', name: 'Hungary' },
  'RO': { flag: '🇷🇴', name: 'Romania' },
  'UA': { flag: '🇺🇦', name: 'Ukraine' },
  'TR': { flag: '🇹🇷', name: 'Turkey' },
  'IL': { flag: '🇮🇱', name: 'Israel' },
  'AE': { flag: '🇦🇪', name: 'UAE' },
  'SA': { flag: '🇸🇦', name: 'Saudi Arabia' },
  'ID': { flag: '🇮🇩', name: 'Indonesia' },
  'TH': { flag: '🇹🇭', name: 'Thailand' },
  'MY': { flag: '🇲🇾', name: 'Malaysia' },
  'PH': { flag: '🇵🇭', name: 'Philippines' },
  'VN': { flag: '🇻🇳', name: 'Vietnam' },
  'NZ': { flag: '🇳🇿', name: 'New Zealand' },
  'ZA': { flag: '🇿🇦', name: 'South Africa' },
  'EG': { flag: '🇪🇬', name: 'Egypt' },
  'NG': { flag: '🇳🇬', name: 'Nigeria' },
  'KE': { flag: '🇰🇪', name: 'Kenya' },
  'AR': { flag: '🇦🇷', name: 'Argentina' },
  'CL': { flag: '🇨🇱', name: 'Chile' },
  'CO': { flag: '🇨🇴', name: 'Colombia' },
  'MX': { flag: '🇲🇽', name: 'Mexico' },
  'PE': { flag: '🇵🇪', name: 'Peru' },
  'VE': { flag: '🇻🇪', name: 'Venezuela' },
};

export default function BlacklistPage() {
  const [data, setData] = useState<IpReputationResult[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<IpReputationStats | null>(null);
  const [filter, setFilter] = useState<'all' | 'malicious' | 'suspicious'>('all');
  const [searchIp, setSearchIp] = useState('');
  const [selectedIp, setSelectedIp] = useState<IpReputationResult | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'updatedAt' | 'totalReports'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const limit = 50;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [blacklistRes, statsRes] = await Promise.all([
        api.ip.blacklist({
          page: currentPage,
          limit,
          status: filter,
          search: searchIp || undefined,
          sortBy: sortField,
          sortOrder,
        }),
        api.ip.stats()
      ]);
      setData(blacklistRes.data);
      setPagination(blacklistRes.pagination);
      setStats(statsRes);
    } catch (err) {
      console.error('Failed to load blacklist:', err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, filter, searchIp, sortField, sortOrder]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'malicious':
        return <ShieldAlert className="h-5 w-5 text-red-500" />;
      case 'suspicious':
        return <Shield className="h-5 w-5 text-yellow-500" />;
      case 'normal':
        return <ShieldCheck className="h-5 w-5 text-emerald-500" />;
      default:
        return <ShieldQuestion className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'malicious':
        return <span className="px-2 py-1 bg-red-500 text-white text-xs font-medium rounded-full">惡意</span>;
      case 'suspicious':
        return <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-medium rounded-full">可疑</span>;
      case 'normal':
        return <span className="px-2 py-1 bg-emerald-500 text-white text-xs font-medium rounded-full">良性</span>;
      default:
        return <span className="px-2 py-1 bg-gray-500 text-white text-xs font-medium rounded-full">未知</span>;
    }
  };

  const getCountryDisplay = (countryCode: string | undefined) => {
    if (!countryCode) return '-';
    const data = COUNTRY_DATA[countryCode.toUpperCase()];
    return data ? `${data.flag} ${data.name}` : countryCode;
  };

  const handleSort = (field: 'updatedAt' | 'totalReports') => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
    setCurrentPage(1);
  };

  const totalPages = pagination?.totalPages || 1;

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handleFilterChange = (newFilter: typeof filter) => {
    setFilter(newFilter);
    setCurrentPage(1);
  };

  const handleSearchChange = (value: string) => {
    setSearchIp(value);
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">IP 黑名單</h1>
            <p className="text-sm text-gray-500 mt-1">已收錄的威脅 IP 列表</p>
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-white rounded-lg border p-4">
              <p className="text-sm text-gray-500">總數</p>
              <p className="text-2xl font-semibold text-gray-900">{stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-red-50 rounded-lg border border-red-200 p-4">
              <p className="text-sm text-red-600">惡意 IP</p>
              <p className="text-2xl font-semibold text-red-700">{stats.malicious.toLocaleString()}</p>
            </div>
            <div className="bg-yellow-50 rounded-lg border border-yellow-200 p-4">
              <p className="text-sm text-yellow-600">可疑 IP</p>
              <p className="text-2xl font-semibold text-yellow-700">{stats.suspicious.toLocaleString()}</p>
            </div>
            <div className="bg-emerald-50 rounded-lg border border-emerald-200 p-4">
              <p className="text-sm text-emerald-600">良性 IP</p>
              <p className="text-2xl font-semibold text-emerald-700">{stats.normal.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="bg-white rounded-lg border p-4 mb-6 flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={searchIp}
              onChange={e => {
                setSearchIp(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="搜尋 IP 地址..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={filter}
            onChange={e => {
              setFilter(e.target.value as typeof filter);
              setCurrentPage(1);
            }}
            className="border rounded-lg px-4 py-2 bg-white"
          >
            <option value="all">全部</option>
            <option value="malicious">惡意</option>
            <option value="suspicious">可疑</option>
          </select>
        </div>

        {/* Blacklist Table */}
        <div className="bg-white rounded-lg border overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
            </div>
          ) : data.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Shield className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>沒有找到符合條件的 IP</p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px]">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">狀態</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">IP 地址</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">國家</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ISP</th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('totalReports')}
                      >
                        舉報次數 {sortField === 'totalReports' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort('updatedAt')}
                      >
                        更新時間 {sortField === 'updatedAt' && (sortOrder === 'desc' ? '↓' : '↑')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {data.map((item) => (
                      <tr
                        key={item.ip}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => setSelectedIp(item)}
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {getStatusIcon(item.status)}
                            {getStatusBadge(item.status)}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono text-sm">{item.ip}</td>
                        <td className="px-6 py-4 text-sm">{getCountryDisplay(item.countryCode)}</td>
                        <td className="px-6 py-4 text-sm truncate max-w-xs">{item.isp || '-'}</td>
                        <td className="px-6 py-4 text-sm">{item.totalReports?.toLocaleString() ?? '-'}</td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {new Date(item.updatedAt).toLocaleString('zh-TW')}
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
      {selectedIp && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedIp(null)}>
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">IP 詳細資料</h2>
              <button onClick={() => setSelectedIp(null)} className="p-1 hover:bg-gray-100 rounded">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xl">{selectedIp.ip}</span>
                {getStatusBadge(selectedIp.status)}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-500">國家</p>
                  <p className="font-medium">{selectedIp.countryName || selectedIp.countryCode || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500"> ISP</p>
                  <p className="font-medium">{selectedIp.isp || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">信心分數</p>
                  <p className="font-medium">{selectedIp.confidenceScore !== null ? `${selectedIp.confidenceScore}%` : '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">舉報次數</p>
                  <p className="font-medium">{selectedIp.totalReports?.toLocaleString() ?? '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">使用類型</p>
                  <p className="font-medium">{selectedIp.usageType || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">網域</p>
                  <p className="font-medium">{selectedIp.domain || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">白名單</p>
                  <p className="font-medium">{selectedIp.isWhitelisted ? '是' : '否'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-500">威脅等級</p>
                  <p className="font-medium">{selectedIp.threatLevel || '-'}</p>
                </div>
              </div>

              {selectedIp.sources && selectedIp.sources.length > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-sm text-gray-500 mb-2">資料來源</p>
                  <div className="space-y-2">
                    {selectedIp.sources.map((source, i) => (
                      <div key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-lg">
                        <span className="font-medium">{source.name}</span>
                        <span className="text-sm text-gray-500">
                          出現在 {'listCount' in source ? source.listCount : source.totalReports || source.pulseCount || '-'} 個黑名單
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="pt-4 border-t">
                <p className="text-sm text-gray-500">更新時間</p>
                <p className="text-sm">{new Date(selectedIp.updatedAt).toLocaleString('zh-TW')}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
