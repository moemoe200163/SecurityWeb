'use client';

import { useState, useCallback } from 'react';
import { Loader2, Search, X, Copy, ExternalLink, Globe } from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';
import { api, ApiError, isAuthError, isForbidden } from '@/lib/api';
import { ApiKeyRequired } from '@/components/ui/ApiKeyRequired';

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
  const [authError, setAuthError] = useState<number | false>(false);
  const PREFIX_PAGE_SIZE = 20;

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;

    setLoading(true);
    setHasSearched(true);
    setResult(null);
    setError(null);

    try {
      const [statsData, lookupData] = await Promise.all([
        api.bgp.stats(),
        api.bgp.lookup(query),
      ]);
      setStats(statsData);
      setResult(lookupData);
    } catch (err) {
      if (isForbidden(err)) {
        setAuthError(403);
        return;
      } else if (isAuthError(err)) {
        setAuthError(401);
        return;
      }
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
      const [whoisData, prefixesData] = await Promise.all([
        api.bgp.whois(asn),
        api.bgp.prefixes(asn),
      ]);
      setWhoIsData(whoisData);
      setPrefixes(prefixesData.prefixes || []);
    } catch (err) {
      if (isForbidden(err)) {
        setAuthError(403);
        return;
      } else if (isAuthError(err)) {
        setAuthError(401);
        return;
      }
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

  const getAsnType = (holder: string | null | undefined): { type: string; bgColor: string; textColor: string } => {
    if (!holder) return { type: 'Unknown', bgColor: 'var(--muted)', textColor: 'var(--muted-foreground)' };
    const h = holder.toUpperCase();
    if (h.includes('HOSTING') || h.includes('CLOUD') || h.includes('VPS')) {
      return { type: 'Hosting', bgColor: '#ede9fe', textColor: '#7c3aed' }; // purple-100, purple-700
    }
    if (h.includes('VPN') || h.includes('PROXY') || h.includes('TOR')) {
      return { type: 'VPN/Proxy', bgColor: '#ffedd5', textColor: '#c2410c' }; // orange-100, orange-700
    }
    if (h.includes('ISP') || h.includes('TELECOM') || h.includes('NETWORK')) {
      return { type: 'ISP', bgColor: '#dbeafe', textColor: '#1d4ed8' }; // blue-100, blue-700
    }
    return { type: 'Org', bgColor: 'var(--muted)', textColor: 'var(--muted-foreground)' };
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--background)' }}>
      <PageHero
        icon={<Globe className="h-8 w-8 text-[var(--color-threat)]" />}
        title="BGP ASN 情報查詢"
        subtitle="BGP ROUTING INTELLIGENCE"
        command="bgp-lookup --query-type"
        commandValue={queryType.toUpperCase()}
        accentClassName="text-[var(--color-threat)] bg-[var(--color-threat)]/10"
      />

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {authError !== false && <ApiKeyRequired variant={authError === 403 ? 'forbidden' : 'missing'} />}
        {/* Search Box */}
        <div className="rounded-xl border shadow-sm p-6 mb-6" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
          <div className="flex flex-col md:flex-row gap-4">
            {/* Query Type Toggle */}
            <div className="flex rounded-lg border overflow-hidden p-1" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
              <button
                onClick={() => setQueryType('ip')}
                className={`px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  queryType === 'ip'
                    ? 'bg-[--color-threat] text-white shadow-sm'
                    : 'hover:text-[var(--foreground)]'
                }`}
                style={queryType !== 'ip' ? { color: 'var(--muted-foreground)' } : undefined}
              >
                IP / 前綴
              </button>
              <button
                onClick={() => setQueryType('asn')}
                className={`px-4 py-2.5 text-sm font-medium rounded-md transition-all ${
                  queryType === 'asn'
                    ? 'bg-[--color-threat] text-white shadow-sm'
                    : 'hover:text-[var(--foreground)]'
                }`}
                style={queryType !== 'asn' ? { color: 'var(--muted-foreground)' } : undefined}
              >
                ASN
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: 'var(--muted-foreground)' }} />
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
                className="w-full pl-10 pr-4 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:border-transparent transition-all"
                style={{
                  backgroundColor: 'var(--muted)',
                  color: 'var(--foreground)',
                  borderColor: 'var(--border)',
                  '--tw-ring-color': 'var(--color-threat)'
                } as React.CSSProperties}
              />
            </div>

            {/* Search Button */}
            <button
              onClick={handleSearch}
              disabled={loading || !query.trim()}
              className="px-6 py-2.5 text-white rounded-lg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2 font-medium"
              style={{ backgroundColor: 'var(--color-threat)' }}
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
            <Globe className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--muted-foreground)' }} />
            <h2 className="text-xl font-medium mb-2" style={{ color: 'var(--foreground)' }}>輸入 IP 或 ASN 開始查詢</h2>
            <p style={{ color: 'var(--muted-foreground)' }}>快速取得 BGP 路由資訊與威脅情報</p>
          </div>
        )}

        {hasSearched && loading && (
          <div className="text-center py-16">
            <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin" style={{ color: 'var(--color-threat)' }} />
            <p style={{ color: 'var(--muted-foreground)' }}>查詢中...</p>
          </div>
        )}

        {hasSearched && !loading && error && (
          <div className="text-center py-16">
            <Globe className="h-16 w-16 mx-auto mb-4" style={{ color: 'var(--muted-foreground)' }} />
            <h2 className="text-xl font-medium mb-2" style={{ color: 'var(--foreground)' }}>找不到資料</h2>
            <p style={{ color: 'var(--muted-foreground)' }}>嘗試不同的 IP 或 ASN</p>
          </div>
        )}

        {hasSearched && !loading && result && (
          <>
            {/* Stats Summary */}
            {stats && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="rounded-xl border p-4 shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>資料庫總計</div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stats.totalUpdates.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>24h 更新</div>
                </div>
                <div className="rounded-xl border p-4 shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>唯一 ASN</div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--foreground)' }}>{stats.uniqueAsns.toLocaleString()}</div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>資料庫中</div>
                </div>
                <div className="rounded-xl border p-4 shadow-sm" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
                  <div className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>查詢結果</div>
                  <div className="text-2xl font-bold" style={{ color: 'var(--color-threat)' }}>{result.asns.length}</div>
                  <div className="text-xs" style={{ color: 'var(--muted-foreground)' }}>ASN 記錄</div>
                </div>
              </div>
            )}

            {/* Lookup Result Card */}
            <div className="rounded-xl border shadow-sm overflow-hidden" style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)' }}>
              <div className="px-6 py-4 border-b" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold" style={{ color: 'var(--foreground)' }}>查詢結果</h3>
                    <p className="text-sm font-mono" style={{ color: 'var(--muted-foreground)' }}>{result.resource}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 text-sm font-medium rounded-full" style={result.announced ? { backgroundColor: '#dcfce7', color: '#15803d' } : { backgroundColor: 'var(--muted)', color: 'var(--muted-foreground)' }}>
                      {result.announced ? '已公告' : '未公告'}
                    </span>
                    <span className="px-3 py-1 text-sm font-medium rounded-full" style={{ backgroundColor: '#dbeafe', color: '#1d4ed8' }}>
                      {result.type === '前綴' ? '前綴' : result.type}
                    </span>
                  </div>
                </div>
              </div>

              {/* ASN List */}
              <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {result.asns.length === 0 ? (
                  <div className="px-6 py-12 text-center" style={{ color: 'var(--muted-foreground)' }}>
                    <p>No BGP data found for this resource</p>
                  </div>
                ) : (
                  result.asns.map((asnInfo, index) => {
                    const asnType = getAsnType(asnInfo.holder);
                    return (
                      <div key={index} className="px-6 py-4 transition-colors hover:bg-[var(--accent)]">
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4">
                              <div>
                                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>ASN</p>
                                <button
                                  onClick={(e) => handleAsnClick(String(asnInfo.asn), e)}
                                  className="font-mono text-lg font-bold hover:underline"
                                  style={{ color: 'var(--color-threat)' }}
                                >
                                  AS{asnInfo.asn}
                                </button>
                              </div>
                              <div className="flex-1">
                                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>組織名稱</p>
                                <p className="font-medium" style={{ color: 'var(--foreground)' }}>{asnInfo.holder || '-'}</p>
                              </div>
                              <div>
                                <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>類型</p>
                                <span className="inline-block px-2 py-0.5 text-xs font-medium rounded" style={{ backgroundColor: asnType.bgColor, color: asnType.textColor }}>
                                  {asnType.type}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => handleAsnClick(String(asnInfo.asn), e)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 text-sm rounded-lg transition-colors"
                              style={{ color: 'var(--color-threat)', backgroundColor: 'transparent' }}
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
                <div className="px-6 py-4 border-t" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                  <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>IP 區塊</p>
                  <p className="font-mono text-sm" style={{ color: 'var(--foreground)' }}>
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={handleCloseWhoIsModal}>
          <div className="rounded-xl shadow-2xl max-w-md w-full" style={{ backgroundColor: 'var(--card)' }} onClick={e => e.stopPropagation()}>
            <div className="border-b px-6 py-4 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
              <h2 className="text-lg font-semibold" style={{ color: 'var(--foreground)' }}>ASN 詳細資訊</h2>
              <button onClick={handleCloseWhoIsModal} className="p-1 rounded-lg transition-colors">
                <X className="h-5 w-5" style={{ color: 'var(--muted-foreground)' }} />
              </button>
            </div>
            <div className="p-6">
              {whoIsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin" style={{ color: 'var(--color-threat)' }} />
                </div>
              ) : whoIsData ? (
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>ASN</p>
                      <p className="text-2xl font-bold font-mono" style={{ color: 'var(--foreground)' }}>{whoIsData.asn}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>國家</p>
                      <p className="text-2xl">{getCountryDisplay(whoIsData.country).flag}</p>
                      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{getCountryDisplay(whoIsData.country).name}</p>
                    </div>
                  </div>

                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>組織名稱</p>
                    <p className="font-medium" style={{ color: 'var(--foreground)' }}>{whoIsData.holder || '-'}</p>
                  </div>

                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>IP 區塊</p>
                    <p className="font-mono text-sm rounded-lg px-3 py-2" style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}>{whoIsData.block || '-'}</p>
                  </div>

                  {/* Prefix 列表 */}
                  <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--muted-foreground)' }}>
                      宣告的 Prefix {prefixes.length > 0 && `(${prefixes.length})`}
                    </p>
                    {prefixesLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: 'var(--muted-foreground)' }} />
                      </div>
                    ) : prefixes.length > 0 ? (
                      <div>
                        <div className="max-h-48 overflow-y-auto rounded-lg" style={{ borderColor: 'var(--border)', borderWidth: 1 }}>
                          <table className="w-full text-sm">
                            <thead className="sticky top-0" style={{ backgroundColor: 'var(--muted)' }}>
                              <tr>
                                <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>Prefix</th>
                                <th className="text-right px-3 py-2 font-medium" style={{ color: 'var(--muted-foreground)' }}>Type</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                              {prefixes.slice((prefixPage - 1) * PREFIX_PAGE_SIZE, prefixPage * PREFIX_PAGE_SIZE).map((p, i) => (
                                <tr key={i} className="transition-colors">
                                  <td className="px-3 py-2 font-mono text-xs" style={{ color: 'var(--foreground)' }}>{p.prefix}</td>
                                  <td className="px-3 py-2 text-right">
                                    <span className="text-xs px-2 py-0.5 rounded" style={p.type === 'ipv4' ? { backgroundColor: '#dbeafe', color: '#1d4ed8' } : { backgroundColor: '#ede9fe', color: '#7c3aed' }}>
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
                          <div className="flex items-center justify-between border-t px-3 py-2" style={{ backgroundColor: 'var(--muted)', borderColor: 'var(--border)' }}>
                            <button
                              onClick={() => setPrefixPage(p => Math.max(1, p - 1))}
                              disabled={prefixPage === 1}
                              className="px-3 py-1 text-sm rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderWidth: 1, color: 'var(--foreground)' }}
                            >
                              上一頁
                            </button>
                            <span className="text-sm" style={{ color: 'var(--muted-foreground)' }}>
                              第 {prefixPage} / {Math.ceil(prefixes.length / PREFIX_PAGE_SIZE)} 頁 (共 {prefixes.length} 個)
                            </span>
                            <button
                              onClick={() => setPrefixPage(p => Math.min(Math.ceil(prefixes.length / PREFIX_PAGE_SIZE), p + 1))}
                              disabled={prefixPage >= Math.ceil(prefixes.length / PREFIX_PAGE_SIZE)}
                              className="px-3 py-1 text-sm rounded hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                              style={{ backgroundColor: 'var(--card)', borderColor: 'var(--border)', borderWidth: 1, color: 'var(--foreground)' }}
                            >
                              下一頁
                            </button>
                          </div>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm py-2" style={{ color: 'var(--muted-foreground)' }}>無 prefix 資料</p>
                    )}
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => copyToClipboard(whoIsData.asn)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      <Copy className="h-4 w-4" />
                      複製 ASN
                    </button>
                    <button
                      onClick={() => copyToClipboard(whoIsData.holder || '')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm"
                      style={{ backgroundColor: 'var(--muted)', color: 'var(--foreground)' }}
                    >
                      <Copy className="h-4 w-4" />
                      複製組織
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8" style={{ color: 'var(--muted-foreground)' }}>
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
