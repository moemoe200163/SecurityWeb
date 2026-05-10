'use client';

import { useState, useCallback } from 'react';
import { Loader2, Search, Shield, X, Copy, ExternalLink, AlertTriangle, Globe } from 'lucide-react';

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

interface LookupResult {
  resource: string;
  type: string;
  announced: boolean;
  asns: { asn: number; holder: string; country?: string }[];
  block: { resource: string; desc: string } | null;
}

interface WhoIsResult {
  asn: string;
  holder: string;
  country: string;
  block: string;
}

interface PrefixInfo {
  prefix: string;
  type: 'ipv4' | 'ipv6';
}

export default function BgpPage() {
  const [query, setQuery] = useState('');
  const [queryType, setQueryType] = useState<'ip' | 'asn'>('ip');
  const [result, setResult] = useState<LookupResult | null>(null);
  const [stats, setStats] = useState<{totalUpdates: number; uniqueAsns: number} | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedAsn, setSelectedAsn] = useState<string | null>(null);
  const [whoIsData, setWhoIsData] = useState<WhoIsResult | null>(null);
  const [whoIsLoading, setWhoIsLoading] = useState(false);
  const [prefixes, setPrefixes] = useState<PrefixInfo[]>([]);
  const [prefixesLoading, setPrefixesLoading] = useState(false);
  const [prefixPage, setPrefixPage] = useState(1);
  const PREFIX_PAGE_SIZE = 20;

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResult(null);
    setError(null);

    try {
      // Fetch stats and lookup in parallel
      const [statsRes, lookupRes] = await Promise.all([
        fetch('/api/bgp/stats'),
        fetch(`/api/bgp/lookup?resource=${encodeURIComponent(query)}`)
      ]);

      const statsData = await statsRes.json();
      setStats(statsData);

      if (!lookupRes.ok) {
        const err = await lookupRes.json();
        setError(err.error || 'No BGP data found');
        return;
      }

      const lookupData = await lookupRes.json();
      setResult(lookupData);
    } catch (err) {
      console.error('Failed to search:', err);
      setError('查詢失敗');
    } finally {
      setLoading(false);
    }
  }, [query]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleAsnClick = async (asn: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedAsn(asn);
    setWhoIsLoading(true);
    setPrefixesLoading(true);
    setWhoIsData(null);
    setPrefixes([]);
    try {
      // 并行获取 WHOIS 和 prefixes
      const [whoisRes, prefixesRes] = await Promise.all([
        fetch(`/api/bgp/whois/${asn}`),
        fetch(`/api/bgp/prefixes/${asn}`),
      ]);
      if (whoisRes.ok) {
        const data = await whoisRes.json();
        setWhoIsData(data);
      }
      if (prefixesRes.ok) {
        const data = await prefixesRes.json();
        setPrefixes(data.prefixes || []);
      }
    } catch (err) {
      console.error('Failed to fetch ASN data:', err);
    } finally {
      setWhoIsLoading(false);
      setPrefixesLoading(false);
    }
  };

  const handleCloseWhoIsModal = () => {
    setSelectedAsn(null);
    setWhoIsData(null);
    setWhoIsLoading(false);
    setPrefixPage(1);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getCountryDisplay = (country: string | null | undefined) => {
    if (!country) return { flag: '-', name: '' };
    const data = COUNTRY_DATA[country.toUpperCase()];
    return data ? { flag: data.flag, name: data.name } : { flag: country, name: country };
  };

  const getAsnType = (holder: string | null | undefined): { type: string; color: string } => {
    if (!holder) return { type: 'Unknown', color: 'bg-gray-100 text-gray-600' };
    const h = holder.toUpperCase();
    if (h.includes('HOSTING') || h.includes('CLOUD') || h.includes('VPS')) {
      return { type: 'Hosting', color: 'bg-purple-100 text-purple-700' };
    }
    if (h.includes('VPN') || h.includes('PROXY') || h.includes('TOR')) {
      return { type: 'VPN/Proxy', color: 'bg-orange-100 text-orange-700' };
    }
    if (h.includes('ISP') || h.includes('TELECOM') || h.includes('NETWORK')) {
      return { type: 'ISP', color: 'bg-blue-100 text-blue-700' };
    }
    return { type: 'Org', color: 'bg-gray-100 text-gray-600' };
  };


  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
              <Shield className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">BGP ASN 情報查詢</h1>
              <p className="text-sm text-gray-500">查詢 IP 或 ASN 所屬的 BGP 路由與威脅情報</p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Search Box */}
        <div className="bg-white dark:bg-gray-800 rounded-xl border shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Query Type Toggle */}
            <div className="flex rounded-lg border overflow-hidden bg-gray-100 dark:bg-gray-700 p-1">
              <button
                onClick={() => setQueryType('ip')}
                className={`px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  queryType === 'ip'
                    ? 'bg-[--color-threat] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                IP / 前綴
              </button>
              <button
                onClick={() => setQueryType('asn')}
                className={`px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  queryType === 'asn'
                    ? 'bg-[--color-threat] text-white shadow-sm'
                    : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'
                }`}
              >
                ASN
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={query}
                onChange={e => setQuery(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder={
                  queryType === 'ip'
                    ? '輸入 IP 地址或前綴 (例如：1.1.1.0/24)'
                    : '輸入 ASN 號碼 (例如：15169 或 AS15169)'
                }
                className="w-full pl-10 pr-4 py-2.5 border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[--color-threat] focus:border-transparent focus:bg-white dark:focus:bg-gray-800 transition-all"
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-6 py-2.5 bg-[--color-threat] text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              查詢
            </button>
          </div>
        </div>

        {/* Results */}
        {!hasSearched && (
          <div className="text-center py-16">
            <Globe className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-medium text-gray-700 mb-2">輸入 IP 或 ASN 開始查詢</h2>
            <p className="text-gray-500">快速取得 BGP 路由資訊與威脅情報</p>
          </div>
        )}

        {hasSearched && loading && (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-blue-500" />
            <p className="text-gray-500">查詢中...</p>
          </div>
        )}

        {hasSearched && !loading && error && (
          <div className="text-center py-16">
            <Globe className="h-16 w-16 mx-auto mb-4 text-gray-300" />
            <h2 className="text-xl font-medium text-gray-700 mb-2">找不到資料</h2>
            <p className="text-gray-500">嘗試不同的 IP 或 ASN</p>
          </div>
        )}

        {hasSearched && !loading && result && (
          <>
            {/* Stats Summary */}
            {stats && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-xl border p-4 shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">資料庫總計</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.totalUpdates.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">24h 更新</div>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">唯一 ASN</div>
                  <div className="text-2xl font-bold text-gray-900">{stats.uniqueAsns.toLocaleString()}</div>
                  <div className="text-xs text-gray-400">資料庫中</div>
                </div>
                <div className="bg-white rounded-xl border p-4 shadow-sm">
                  <div className="text-sm text-gray-500 mb-1">查詢結果</div>
                  <div className="text-2xl font-bold text-blue-600">{result.asns.length}</div>
                  <div className="text-xs text-gray-400">ASN 記錄</div>
                </div>
              </div>
            )}

            {/* Lookup Result Card */}
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b bg-gray-50">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-gray-900">查詢結果</h3>
                    <p className="text-sm text-gray-500 font-mono">{result.resource}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-sm font-medium rounded-full ${
                      result.announced ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                    }`}>
                      {result.announced ? '已公告' : '未公告'}
                    </span>
                    <span className="px-3 py-1 text-sm font-medium rounded-full bg-blue-100 text-blue-700">
                      {result.type === 'prefix' ? '前綴' : result.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* ASN List */}
              <div className="divide-y">
                {result.asns.length === 0 ? (
                  <div className="px-6 py-12 text-center text-gray-500">
                    <p>No BGP data found for this resource</p>
                  </div>
                ) : (
                  result.asns.map((asnInfo, index) => {
                    const asnType = getAsnType(asnInfo.holder);
                    return (
                      <div key={index} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-sm text-gray-500 mb-1">ASN</p>
                                <button
                                  onClick={(e) => handleAsnClick(String(asnInfo.asn), e)}
                                  className="font-mono text-lg font-bold text-blue-600 hover:text-blue-800 hover:underline"
                                >
                                  AS{asnInfo.asn}
                                </button>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm text-gray-500 mb-1">組織名稱</p>
                                <p className="font-medium text-gray-900">{asnInfo.holder || '-'}</p>
                              </div>
                              <div>
                                <p className="text-sm text-gray-500 mb-1">類型</p>
                                <span className={`inline-block px-2 py-0.5 text-xs font-medium rounded ${asnType.color}`}>
                                  {asnType.type}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleAsnClick(String(asnInfo.asn), e)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            >
                              <ExternalLink className="h-4 w-4" />
                              WHOIS
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Block Info */}
              {result.block && (
                <div className="px-6 py-4 border-t bg-gray-50">
                  <p className="text-sm text-gray-500 mb-1">IP 區塊</p>
                  <p className="font-mono text-sm text-gray-700">
                    {result.block.resource}
                    {result.block.desc && ` - ${result.block.desc}`}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* WHOIS Modal */}
      {selectedAsn && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={handleCloseWhoIsModal}>
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full" onClick={e => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">ASN 詳細資訊</h2>
              <button onClick={handleCloseWhoIsModal} className="p-1 hover:bg-gray-100 rounded-lg transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-6">
              {whoIsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                </div>
              ) : whoIsData ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">ASN</p>
                      <p className="text-2xl font-bold font-mono">{whoIsData.asn}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-500 mb-1">國家</p>
                      <p className="text-2xl">{getCountryDisplay(whoIsData.country).flag}</p>
                      <p className="text-xs text-gray-500">{getCountryDisplay(whoIsData.country).name}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">組織名稱</p>
                    <p className="font-medium text-gray-900">{whoIsData.holder || '-'}</p>
                  </div>

                  <div>
                    <p className="text-sm text-gray-500 mb-1">IP 區塊</p>
                    <p className="font-mono text-sm bg-gray-100 px-3 py-2 rounded-lg">{whoIsData.block || '-'}</p>
                  </div>

                  {/* Prefix 列表 */}
                  <div>
                    <p className="text-sm text-gray-500 mb-1">
                      宣告的 Prefix {prefixes.length > 0 && `(${prefixes.length})`}
                    </p>
                    {prefixesLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    ) : prefixes.length > 0 ? (
                      <div>
                        <div className="max-h-48 overflow-y-auto border rounded-lg">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 sticky top-0">
                              <tr>
                                <th className="text-left px-3 py-2 font-medium text-gray-500">Prefix</th>
                                <th className="text-right px-3 py-2 font-medium text-gray-500">Type</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y">
                              {prefixes.slice((prefixPage - 1) * PREFIX_PAGE_SIZE, prefixPage * PREFIX_PAGE_SIZE).map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50">
                                  <td className="px-3 py-2 font-mono text-xs">{p.prefix}</td>
                                  <td className="px-3 py-2 text-right">
                                    <span className={`text-xs px-2 py-0.5 rounded ${
                                      p.type === 'ipv4' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                    }`}>
                                      {p.type.toUpperCase()}
                                    </span>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        {/* Pagination */}
                        {prefixes.length > PREFIX_PAGE_SIZE && (
                          <div className="flex items-center justify-between border-t px-3 py-2 bg-gray-50">
                            <button
                              onClick={() => setPrefixPage(p => Math.max(1, p - 1))}
                              disabled={prefixPage === 1}
                              className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              上一頁
                            </button>
                            <span className="text-sm text-gray-500">
                              第 {prefixPage} / {Math.ceil(prefixes.length / PREFIX_PAGE_SIZE)} 頁 (共 {prefixes.length} 個)
                            </span>
                            <button
                              onClick={() => setPrefixPage(p => Math.min(Math.ceil(prefixes.length / PREFIX_PAGE_SIZE), p + 1))}
                              disabled={prefixPage >= Math.ceil(prefixes.length / PREFIX_PAGE_SIZE)}
                              className="px-3 py-1 text-sm bg-white border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              下一頁
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-400 py-2">無 prefix 資料</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => copyToClipboard(whoIsData.asn)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      <Copy className="h-4 w-4" />
                      複製 ASN
                    </button>
                    <button
                      onClick={() => copyToClipboard(whoIsData.holder || '')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm"
                    >
                      <Copy className="h-4 w-4" />
                      複製組織
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>無法載入 WHOIS 資料</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
