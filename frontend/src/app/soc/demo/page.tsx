'use client';

import { useState } from 'react';
import {
  MessageSquare, Shield, Search, Activity, FileCode, Play, CheckCircle, Clock, AlertTriangle,
  Globe, Database, Server, Lock, Zap, Target, Wifi, FileWarning, Cpu, Terminal
} from 'lucide-react';
import { PageHero } from '@/components/layout/PageHero';

const mockAlert = {
  time: '2025-03-27 23:10:20',
  srcIp: '84.17.51.2',
  dstIp: '45.78.218.192',
  dstPort: '25976',
  attackResult: '成功',
  ruleType: '敏感文件',
  riskLevel: '中危',
  assetName: '多云线上环境-勿动',
  uri: '/flhaagfkjw?cb540194=1',
  httpHeader: 'zzzheadertest: test1\\rtest1',
  country: '英国',
  protocol: 'HTTP',
  appProtocol: 'HTTP',
};

const steps = [
  { id: 1, title: '任务规划', desc: '生成分析计划，多角度分析告警', icon: MessageSquare, status: 'completed' },
  { id: 2, title: '告警分析', desc: '模拟安全运营专家，进行溯源分析', icon: Shield, status: 'completed' },
  { id: 3, title: '威胁情报', desc: '模拟威胁情报专家，收集IOCs信息', icon: Search, status: 'completed' },
  { id: 4, title: '事件分析', desc: '模拟威胁分析专家，评估业务影响', icon: Activity, status: 'completed' },
  { id: 5, title: '代码生成', desc: '模拟编码专家，创建响应脚本', icon: FileCode, status: 'completed' },
  { id: 6, title: '剧本执行', desc: '生成完整响应剧本和事件报告', icon: Play, status: 'completed' },
];

const threatIntel = [
  { source: '微步验证', result: 'IP 84.17.51.2 风险等级(高危)', confidence: '高' },
  { source: 'VirusTotal', result: '检测率 15/70，发现恶意文件', confidence: '中' },
  { source: 'Shodan', result: '目标IP存在HTTP服务(端口25976)', confidence: '低' },
  { source: 'CrowdSec', result: '该IP曾参与自动化扫描活动', confidence: '中' },
];

const iocList = [
  { type: 'IP地址', value: '84.17.51.2', confidence: '85%' },
  { type: 'HTTP URI', value: '/flhaagfkjw?cb540194=1', confidence: '90%' },
  { type: 'HTTP头部', value: 'zzzheadertest: test1\\rtest1', confidence: '95%' },
  { type: '端口', value: '25976/TCP', confidence: '75%' },
  { type: '主机地址', value: '10.211.55.4 (Host头)', confidence: '70%' },
];

const attackChain = [
  { time: '23:10:20', stage: '侦察', ttp: 'T1595', ioc: 'IP: 84.17.51.2', desc: '主动扫描' },
  { time: '23:10:20', stage: '初始访问', ttp: 'T1190', ioc: 'URI: /flhaagfkjw', desc: '利用公共应用漏洞' },
  { time: '23:10:20', stage: '防御规避', ttp: 'T1562.003', ioc: 'HTTP头: zzzheadertest', desc: 'CRLF注入' },
  { time: '23:10:20', stage: '发现', ttp: 'T1083', ioc: 'HTTP状态码: 200', desc: '文件与目录发现' },
  { time: '23:10:20', stage: '收集', ttp: 'T1213', ioc: '攻击结果: 成功', desc: '信息库数据收集' },
];

const responseTracking = [
  { phase: '初始响应', operation: 'network_isolation', system: '边界防火墙', result: '成功' },
  { phase: '取证分析', operation: 'resource_security', system: 'Web服务器', result: '成功' },
  { phase: '详细调查', operation: 'log_collection', system: '日志系统', result: '成功' },
  { phase: '缓解措施', operation: 'resource_hardening', system: 'WAF', result: '成功' },
  { phase: '报告通知', operation: 'threat_reporting', system: 'SOC', result: '成功' },
];

export default function SOCDemoPage() {
  const [expandedSteps, setExpandedSteps] = useState<number[]>([1, 2, 3, 4, 5, 6]);

  const toggleStep = (id: number) => {
    setExpandedSteps(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  return (
    <div className="min-h-screen bg-[var(--muted)] text-[var(--foreground)]">
      <PageHero
        icon={<Shield className="h-8 w-8 text-[var(--terminal-green)]" />}
        title="SOC 告警分析"
        subtitle="SECURITY EVENT ANALYSIS DEMO"
        command="soc-demo --status"
        commandValue="completed"
        actions={(
          <span className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full text-sm font-medium border border-emerald-500/30">
            <CheckCircle className="h-4 w-4" />
            分析完成
          </span>
        )}
      />

      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Alert Info Banner */}
        <div className="relative overflow-hidden rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-5">
          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent" />
          <div className="relative flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Clock className="h-4 w-4" />
              <span>{mockAlert.time}</span>
            </div>
            <div className="w-px h-4 bg-[var(--border)] hidden sm:block" />
            <div className="flex items-center gap-2 text-[var(--muted-foreground)]">
              <Globe className="h-4 w-4" />
              <span>{mockAlert.country}</span>
            </div>
            <div className="w-px h-4 bg-[var(--border)] hidden sm:block" />
            <div className="flex items-center gap-2 font-mono">
              <Target className="h-4 w-4 text-blue-500" />
              <span className="text-blue-600 dark:text-blue-400">{mockAlert.srcIp}</span>
              <span className="text-[var(--muted-foreground)]">→</span>
              <span>{mockAlert.dstIp}:{mockAlert.dstPort}</span>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <span className="px-2.5 py-1 bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400 rounded text-xs font-medium">
                {mockAlert.riskLevel}
              </span>
              <span className="px-2.5 py-1 bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400 rounded text-xs font-medium">
                {mockAlert.attackResult}
              </span>
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-6">
          <h2 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider mb-4">分析步骤</h2>
          <div className="space-y-2">
            {steps.map((step) => {
              const Icon = step.icon;
              const isExpanded = expandedSteps.includes(step.id);
              return (
                <div
                  key={step.id}
                  className="group relative overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--muted)] transition-all hover:border-blue-200 dark:hover:border-blue-800"
                >
                  <button
                    onClick={() => toggleStep(step.id)}
                    className="w-full flex items-center gap-4 p-4 text-left hover:bg-[var(--accent)] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900/50 flex items-center justify-center">
                      <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <Icon className="h-5 w-5 text-[var(--muted-foreground)]" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[var(--foreground)]">{step.title}</div>
                      <div className="text-xs text-[var(--muted-foreground)]">{step.desc}</div>
                    </div>
                    <div className={`w-4 h-4 rounded-full border-2 transition-transform ${isExpanded ? 'rotate-90 border-blue-500 border-t-transparent' : 'border-[var(--border)]'}`} />
                  </button>
                  {isExpanded && (
                    <div className="px-4 pb-4 pt-0 border-t border-[var(--border)] mt-0">
                      <div className="mt-3 text-sm text-[var(--muted-foreground)]">
                        ✓ 步骤{step.id}已完成 - {step.desc}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Two Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Threat intel */}
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">威胁情报分析</h2>
            </div>
            <div className="space-y-2">
              {threatIntel.map((item, idx) => (
                <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-[var(--muted)] border border-[var(--border)]">
                  <div className="w-8 h-8 rounded bg-[var(--card)] border border-[var(--border)] flex items-center justify-center">
                    <Cpu className="h-4 w-4 text-[var(--muted-foreground)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--foreground)] truncate">{item.source}</div>
                    <div className="text-xs text-[var(--muted-foreground)] truncate">{item.result}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded ${
                    item.confidence === '高' ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' :
                    item.confidence === '中' ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400' :
                    'bg-[var(--muted)] text-[var(--muted-foreground)]'
                  }`}>
                    {item.confidence}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* IOC table */}
          <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-4 w-4 text-blue-500" />
              <h2 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">IOC 清单</h2>
            </div>
            <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
              <table className="w-full text-sm">
                <thead className="bg-[var(--muted)]">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">类型</th>
                    <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">值</th>
                    <th className="text-right px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">置信度</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)]">
                  {iocList.map((ioc, idx) => (
                    <tr key={idx} className="hover:bg-[var(--accent)] transition-colors">
                      <td className="px-3 py-2.5 text-[var(--muted-foreground)]">{ioc.type}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-blue-600 dark:text-blue-400 truncate max-w-[180px]">{ioc.value}</td>
                      <td className="px-3 py-2.5 text-right">
                        <span className={`text-xs px-2 py-0.5 rounded ${
                          Number(ioc.confidence.replace('%', '')) >= 85 ? 'bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400' :
                          Number(ioc.confidence.replace('%', '')) >= 70 ? 'bg-orange-100 text-orange-600 dark:bg-orange-950/50 dark:text-orange-400' :
                          'bg-[var(--muted)] text-[var(--muted-foreground)]'
                        }`}>
                          {ioc.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Attack chain */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">攻击链分析 (ATT&CK)</h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">时间</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">阶段</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">TTP</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">IOC</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">描述</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {attackChain.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[var(--accent)] transition-colors">
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)] font-mono">{item.time}</td>
                    <td className="px-3 py-2.5 text-[var(--foreground)]">{item.stage}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-blue-600 dark:text-blue-400">{item.ttp}</td>
                    <td className="px-3 py-2.5 font-mono text-xs text-[var(--muted-foreground)]">{item.ioc}</td>
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)] text-xs">{item.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Response tracking */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-6">
          <div className="flex items-center gap-2 mb-4">
            <Terminal className="h-4 w-4 text-green-500" />
            <h2 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">处置追踪</h2>
          </div>
          <div className="overflow-x-auto rounded-lg border border-[var(--border)]">
            <table className="w-full text-sm">
              <thead className="bg-[var(--muted)]">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">阶段</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">操作</th>
                  <th className="text-left px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">系统</th>
                  <th className="text-right px-3 py-2 font-medium text-[var(--muted-foreground)] text-xs uppercase">结果</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {responseTracking.map((item, idx) => (
                  <tr key={idx} className="hover:bg-[var(--accent)] transition-colors">
                    <td className="px-3 py-2.5 text-[var(--foreground)]">{item.phase}</td>
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)] font-mono text-xs">{item.operation}</td>
                    <td className="px-3 py-2.5 text-[var(--muted-foreground)]">{item.system}</td>
                    <td className="px-3 py-2.5 text-right">
                      <span className="inline-flex items-center gap-1 text-green-600 dark:text-green-400">
                        <CheckCircle className="h-3.5 w-3.5" />
                        {item.result}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary Report */}
        <div className="rounded-xl bg-[var(--card)] border border-[var(--border)] shadow-sm p-6">
          <div className="flex items-center gap-2 mb-6">
            <FileWarning className="h-4 w-4 text-amber-500" />
            <h2 className="text-sm font-medium text-[var(--muted-foreground)] uppercase tracking-wider">安全事件分析报告</h2>
          </div>

          <div className="space-y-6">
            <section>
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3">一、事件概要</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-[var(--muted)]">
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">首次发现时间</div>
                  <div className="text-sm text-[var(--foreground)]">2025-03-27 23:10:20</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">当前状态</div>
                  <div className="text-sm text-green-600 dark:text-green-400">已遏制</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">事件类型</div>
                  <div className="text-sm text-[var(--foreground)]">HTTP头部注入</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">事件严重性</div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">中危 (CVSS 5.3)</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3">二、事件详细描述</h3>
              <p className="text-sm text-[var(--muted-foreground)] leading-relaxed p-4 rounded-lg bg-[var(--muted)]">
                本次安全事件捕获到一个来自英国IP地址(<span className="text-red-600 dark:text-red-400">84.17.51.2</span>)对多云线上环境资产(
                <span className="text-blue-600 dark:text-blue-400">45.78.218.192</span>)发起的可疑HTTP请求。
                请求包含明显的CRLF注入尝试，通过在HTTP头部&quot;zzzheadertest&quot;中插入单个回车符试图拆分HTTP头，
                这是典型的HTTP头部注入攻击特征。请求针对非常规路径，且服务器返回了HTTP 200状态码，
                表明请求&quot;成功&quot;，可能导致敏感文件被未授权访问。
              </p>
            </section>

            <section>
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3">三、影响评估</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 rounded-lg bg-[var(--muted)]">
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">受影响资产</div>
                  <div className="text-sm text-[var(--foreground)]">多云线上环境</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">资产重要性</div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">高（生产环境）</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">数据泄露风险</div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">中等</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--muted-foreground)] mb-1">扩散风险</div>
                  <div className="text-sm text-orange-600 dark:text-orange-400">中等</div>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-sm font-medium text-blue-600 dark:text-blue-400 mb-3">四、安全建议</h3>
              <ol className="text-sm text-[var(--muted-foreground)] space-y-2 p-4 rounded-lg bg-[var(--muted)] list-decimal list-inside">
                <li>对Web服务器进行安全配置审查，特别是HTTP协议处理机制</li>
                <li>实施严格的HTTP头部验证，拒绝处理包含CRLF注入的请求</li>
                <li>对敏感路径实施访问控制，定期扫描识别未授权访问的资源</li>
                <li>加强Host头验证，防止Host头注入和SSRF攻击</li>
                <li>部署专用WAF规则拦截类似的HTTP头部注入尝试</li>
              </ol>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
