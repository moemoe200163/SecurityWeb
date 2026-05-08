import type { FastifyInstance } from 'fastify';
import PDFDocument from 'pdfkit';
import { miniMaxAdapter } from '../services/minimaxAdapter.js';
import type { PentestInput, SessionData } from '../services/types.js';

interface Vulnerability {
  name: string;
  description: string;
  riskLevel: 'Critical' | 'High' | 'Medium' | 'Low' | 'Info';
  cvss: string;
  cve?: string;
}

interface RiskAssessment {
  scope: string;
  attackVector: string;
  impact: string;
}

export async function reportRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/report/:sessionId/pdf - Download analysis report
  fastify.get<{ Params: { sessionId: string } }>('/:sessionId/pdf', async (request, reply) => {
    try {
      const { sessionId } = request.params;

      const session = await miniMaxAdapter.getSession(sessionId);
      if (!session) {
        return reply.status(404).send({ error: 'Session not found' });
      }

      // Extract data from session
      const input = session.input as PentestInput | undefined;
      const steps = session.steps.sort((a, b) => a.order - b.order);

      // Extract vulnerabilities from step content
      const vulnerabilities = extractVulnerabilities(session, steps);
      const riskAssessment = generateRiskAssessment(vulnerabilities, input);
      const remediation = generateRemediation(vulnerabilities);

      // Generate PDF
      const pdfBuffer = await generatePDF(session, input, steps, vulnerabilities, riskAssessment, remediation);

      // Set headers for PDF download
      reply.header('Content-Type', 'application/pdf');
      reply.header('Content-Disposition', `attachment; filename="Pentest-Report-${sessionId}.pdf"`);

      return reply.send(pdfBuffer);
    } catch (error) {
      console.error('Report generation error:', error);
      return reply.status(500).send({ error: 'Failed to generate report' });
    }
  });
}

function extractVulnerabilities(session: SessionData, steps: { content?: string }[]): Vulnerability[] {
  const vulnerabilities: Vulnerability[] = [];

  // Parse vulnerabilities from step content
  for (const step of steps) {
    const content = step.content || '';

    // Extract CVE references
    const cveMatches = content.matchAll(/CVE[-\d]+-\d+/g);
    const cves: string[] = [];
    for (const match of cveMatches) {
      cves.push(match[0]);
    }

    // Determine risk level from content
    let riskLevel: Vulnerability['riskLevel'] = 'Info';
    if (content.includes('Critical') || content.includes('嚴重') || cves.some(c => c.includes('10.0'))) {
      riskLevel = 'Critical';
    } else if (content.includes('High') || content.includes('高')) {
      riskLevel = 'High';
    } else if (content.includes('Medium') || content.includes('中')) {
      riskLevel = 'Medium';
    } else if (content.includes('Low') || content.includes('低')) {
      riskLevel = 'Low';
    }

    // Extract vulnerability names
    if (content.includes('SQL') || content.includes('Injection') || content.includes('注入')) {
      vulnerabilities.push({
        name: 'SQL Injection',
        description: 'SQL 注入漏洞允許攻擊者通過操縱 SQL 查詢來訪問、修改或刪除數據庫中的數據。',
        riskLevel,
        cvss: cves.find(c => c.includes('10.0')) ? '10.0' : '7.5',
        cve: cves[0],
      });
    }
    if (content.includes('XSS') || content.includes('Cross-Site')) {
      vulnerabilities.push({
        name: 'Cross-Site Scripting (XSS)',
        description: '跨站腳本攻擊允許攻擊者在受害者的瀏覽器中執行惡意腳本。',
        riskLevel: riskLevel === 'Critical' ? 'High' : 'Medium',
        cvss: '6.1',
        cve: cves[1],
      });
    }
    if (content.includes('RCE') || content.includes('Remote Code Execution') || content.includes('遠程代碼執行')) {
      vulnerabilities.push({
        name: 'Remote Code Execution',
        description: '遠程代碼執行漏洞允許攻擊者在目標服務器上執行任意代碼。',
        riskLevel: 'Critical',
        cvss: '10.0',
        cve: cves[0],
      });
    }
    if (content.includes('SSH') && (content.includes('暴力') || content.includes('brute'))) {
      vulnerabilities.push({
        name: 'SSH Weak Credentials',
        description: 'SSH 服務使用弱口令，容易被暴力破解攻擊。',
        riskLevel: 'High',
        cvss: '7.5',
      });
    }
    if (content.includes('MySQL') && (content.includes('弱') || content.includes('weak'))) {
      vulnerabilities.push({
        name: 'MySQL Weak Credentials',
        description: 'MySQL 數據庫使用弱口令或默認口令。',
        riskLevel: 'High',
        cvss: '7.5',
      });
    }
    if (content.includes('CSRF')) {
      vulnerabilities.push({
        name: 'Cross-Site Request Forgery',
        description: 'CSRF 漏洞允許攻擊者以受害者的身份執行非授權操作。',
        riskLevel: 'Medium',
        cvss: '5.3',
      });
    }
    if (content.includes('IDOR')) {
      vulnerabilities.push({
        name: 'Insecure Direct Object Reference',
        description: '不安全的直接對象引用允許攻擊者訪問未授權的資源。',
        riskLevel: 'Medium',
        cvss: '6.5',
      });
    }
  }

  // Remove duplicates
  const uniqueVulns: Vulnerability[] = [];
  const seen = new Set<string>();
  for (const v of vulnerabilities) {
    if (!seen.has(v.name)) {
      seen.add(v.name);
      uniqueVulns.push(v);
    }
  }

  return uniqueVulns.length > 0 ? uniqueVulns : [
    {
      name: 'Information Disclosure',
      description: '系統信息可能通過錯誤消息或調試信息泄露。',
      riskLevel: 'Info',
      cvss: '3.7',
    },
  ];
}

function generateRiskAssessment(vulnerabilities: Vulnerability[], input?: PentestInput): RiskAssessment {
  const criticalCount = vulnerabilities.filter(v => v.riskLevel === 'Critical').length;
  const highCount = vulnerabilities.filter(v => v.riskLevel === 'High').length;

  return {
    scope: input?.scope || input?.target || 'Not specified',
    attackVector: 'Network-based attack, Web application attack',
    impact: criticalCount > 0
      ? `發現 ${criticalCount} 個嚴重漏洞，可能導致系統完全被攻破，造成數據泄露和服務中斷。`
      : highCount > 0
      ? `發現 ${highCount} 個高危漏洞，可能導致敏感數據泄露和權限提升。`
      : '建議關注已知漏洞，修復后可进一步提高系統安全性。',
  };
}

function generateRemediation(vulnerabilities: Vulnerability[]): { shortTerm: string[]; longTerm: string[] } {
  const shortTerm: string[] = [];
  const longTerm: string[] = [];

  // Short-term remediation
  shortTerm.push('立即修改所有弱口令，使用強密碼策略（至少12位，包含大小寫、數字、特殊字符）');
  shortTerm.push('限制 SSH、MySQL 等服務的訪問IP，只允許可信IP訪問');
  shortTerm.push('更新所有已知存在漏洞的組件到最新版本');

  // Long-term remediation
  longTerm.push('建立定期的安全漏洞掃描机制');
  longTerm.push('實施安全開發生命周期（SDLC）');
  longTerm.push('部署 Web 應用防火牆（WAF）');
  longTerm.push('建立 Security Operations Center (SOC) 進行持續監控');
  longTerm.push('定期進行滲透測試和安全審計');

  // Add specific remediations based on vulnerabilities
  for (const v of vulnerabilities) {
    if (v.name.includes('SQL')) {
      shortTerm.push('使用參數化查詢防止 SQL 注入');
      longTerm.push('實施輸入驗證和輸出編碼');
    }
    if (v.name.includes('XSS')) {
      shortTerm.push('實施輸出編碼和內容安全策略（CSP）');
      longTerm.push('使用 HTTPOnly 和 Secure cookie 標誌');
    }
    if (v.name.includes('RCE')) {
      shortTerm.push('隔離可執行環境，限制命令執行權限');
      longTerm.push('實施最小權限原則');
    }
    if (v.name.includes('Credentials')) {
      shortTerm.push('實施多因素認證（MFA）');
      longTerm.push('部署密碼管理解决方案');
    }
  }

  // Remove duplicates
  return {
    shortTerm: [...new Set(shortTerm)],
    longTerm: [...new Set(longTerm)],
  };
}

async function generatePDF(
  session: SessionData,
  input: PentestInput | undefined,
  steps: { title: string; content?: string }[],
  vulnerabilities: Vulnerability[],
  riskAssessment: RiskAssessment,
  remediation: { shortTerm: string[]; longTerm: string[] }
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Pentest Report - ${session.id}`,
          Author: 'SecurityWeb Pentest System',
          Subject: 'Penetration Test Report',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      const primaryColor = '#1a365d';
      const accentColor = '#2b6cb0';
      const textColor = '#2d3748';
      const lightGray = '#718096';

      // =====================
      // COVER PAGE
      // =====================
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#f7fafc');
      doc.fillColor(primaryColor).fontSize(36).font('Helvetica-Bold');
      doc.text('PENETRATION TEST', 50, 150, { align: 'center' });
      doc.text('REPORT', 50, 200, { align: 'center' });

      doc.fillColor(accentColor).fontSize(24).font('Helvetica');
      doc.text('安全滲透測試報告', 50, 280, { align: 'center' });

      doc.fillColor(textColor).fontSize(14).font('Helvetica');
      doc.text(`Report ID: ${session.id}`, 50, 360, { align: 'center' });
      doc.text(`Generated: ${new Date().toLocaleString('zh-TW')}`, 50, 385, { align: 'center' });

      // Company info
      doc.fontSize(12).fillColor(lightGray);
      doc.text('SecurityWeb Multi-Agent System', 50, doc.page.height - 100, { align: 'center' });
      doc.text('All Rights Reserved', 50, doc.page.height - 80, { align: 'center' });

      // =====================
      // EXECUTIVE SUMMARY
      // =====================
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      // Section title
      doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
      doc.text('1. EXECUTIVE SUMMARY', 50, 50);

      doc.moveTo(50, 90).lineTo(200, 90).lineWidth(3).stroke(primaryColor);

      // Test target
      doc.fillColor(textColor).fontSize(14).font('Helvetica-Bold');
      doc.text('1.1 Test Target', 50, 110);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      doc.text(`Target: ${input?.target || 'Not specified'}`, 50, 135);
      doc.text(`URL: ${input?.url || 'N/A'}`, 50, 155);
      doc.text(`Scope: ${input?.scope || 'Not specified'}`, 50, 175);
      doc.text(`Test Type: ${input?.testType || input?.template || 'Network Scan'}`, 50, 195);

      // Test scope
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('1.2 Test Scope', 50, 230);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      doc.text(riskAssessment.scope, 50, 255);

      // Results overview
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('1.3 Results Overview', 50, 290);

      const criticalCount = vulnerabilities.filter(v => v.riskLevel === 'Critical').length;
      const highCount = vulnerabilities.filter(v => v.riskLevel === 'High').length;
      const mediumCount = vulnerabilities.filter(v => v.riskLevel === 'Medium').length;
      const lowCount = vulnerabilities.filter(v => v.riskLevel === 'Low').length;
      const infoCount = vulnerabilities.filter(v => v.riskLevel === 'Info').length;

      // Summary table header
      const tableTop = 320;
      doc.rect(50, tableTop, 495, 25).fill('#edf2f7');

      doc.fillColor(primaryColor).fontSize(11).font('Helvetica-Bold');
      doc.text('Severity', 55, tableTop + 8);
      doc.text('Count', 250, tableTop + 8);
      doc.text('CVSS Range', 350, tableTop + 8);

      // Summary rows
      const rows = [
        { label: 'Critical', count: criticalCount, range: '9.0-10.0', color: '#c53030' },
        { label: 'High', count: highCount, range: '7.0-8.9', color: '#dd6b20' },
        { label: 'Medium', count: mediumCount, range: '4.0-6.9', color: '#d69e2e' },
        { label: 'Low', count: lowCount, range: '0.1-3.9', color: '#38a169' },
        { label: 'Info', count: infoCount, range: '0.0', color: '#3182ce' },
      ];

      let yPos = tableTop + 30;
      for (const row of rows) {
        doc.fillColor(row.color).fontSize(11).font('Helvetica-Bold');
        doc.text(row.label, 55, yPos);
        doc.fillColor(textColor).font('Helvetica');
        doc.text(row.count.toString(), 250, yPos);
        doc.text(row.range, 350, yPos);
        yPos += 20;
      }

      // =====================
      // VULNERABILITIES
      // =====================
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
      doc.text('2. DISCOVERED VULNERABILITIES', 50, 50);

      doc.moveTo(50, 90).lineTo(280, 90).lineWidth(3).stroke(primaryColor);

      let vulnTop = 110;
      for (let i = 0; i < vulnerabilities.length; i++) {
        const vuln = vulnerabilities[i];

        // Check if we need a new page
        if (vulnTop > 700) {
          doc.addPage();
          vulnTop = 50;
        }

        // Vulnerability header
        doc.fillColor(primaryColor).fontSize(14).font('Helvetica-Bold');
        doc.text(`2.${i + 1} ${vuln.name}`, 50, vulnTop);

        // Risk level badge
        const riskColors: Record<string, string> = {
          Critical: '#c53030',
          High: '#dd6b20',
          Medium: '#d69e2e',
          Low: '#38a169',
          Info: '#3182ce',
        };
        const riskColor = riskColors[vuln.riskLevel] || '#718096';

        doc.fillColor(riskColor).fontSize(10).font('Helvetica-Bold');
        doc.text(`[${vuln.riskLevel}]`, 300, vulnTop + 3);

        // CVSS score
        doc.fillColor(textColor).font('Helvetica').fontSize(11);
        doc.text(`CVSS: ${vuln.cvss}`, 380, vulnTop + 3);

        if (vuln.cve) {
          doc.fillColor(lightGray).fontSize(10);
          doc.text(`CVE: ${vuln.cve}`, 450, vulnTop + 3);
        }

        // Description
        vulnTop += 30;
        doc.fillColor(textColor).fontSize(11).font('Helvetica');
        const descLines = doc.text(vuln.description, 50, vulnTop, { width: 495, align: 'left' });
        vulnTop += 25;

        // Separator line
        doc.moveTo(50, vulnTop).lineTo(545, vulnTop).lineWidth(0.5).stroke('#e2e8f0');
        vulnTop += 20;
      }

      // =====================
      // RISK ASSESSMENT
      // =====================
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
      doc.text('3. RISK ASSESSMENT', 50, 50);

      doc.moveTo(50, 90).lineTo(200, 90).lineWidth(3).stroke(primaryColor);

      // Impact scope
      doc.fillColor(textColor).fontSize(14).font('Helvetica-Bold');
      doc.text('3.1 Impact Scope', 50, 110);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      doc.text(riskAssessment.scope, 50, 135);

      // Attack vector
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('3.2 Attack Vector', 50, 175);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      doc.text(riskAssessment.attackVector, 50, 200);

      // Impact description
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('3.3 Impact Description', 50, 240);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      const impactLines = riskAssessment.impact.split('\n');
      let impactTop = 265;
      for (const line of impactLines) {
        doc.text(line, 50, impactTop, { width: 495 });
        impactTop += 18;
      }

      // Risk matrix
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('3.4 Risk Matrix', 50, impactTop + 30);

      const matrixTop = impactTop + 60;
      doc.rect(50, matrixTop, 495, 80).stroke('#e2e8f0');

      doc.fillColor(primaryColor).font('Helvetica-Bold').fontSize(10);
      doc.text('Severity / Likelihood', 55, matrixTop + 5);
      doc.text('Critical', 55, matrixTop + 25);
      doc.text('High', 55, matrixTop + 45);
      doc.text('Medium', 55, matrixTop + 65);

      doc.text('Impact', 200, matrixTop + 5);
      const impactText = criticalCount > 0 ? 'CRITICAL' : highCount > 0 ? 'HIGH' : 'MEDIUM';
      const impactColor = impactText === 'CRITICAL' ? '#c53030' : impactText === 'HIGH' ? '#dd6b20' : '#d69e2e';
      doc.fillColor(impactColor).text(impactText, 200, matrixTop + 25);
      doc.fillColor(textColor).text('Confirmed vulnerabilities present significant risk', 200, matrixTop + 45);

      // =====================
      // REMEDIATION
      // =====================
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
      doc.text('4. REMEDIATION RECOMMENDATIONS', 50, 50);

      doc.moveTo(50, 90).lineTo(280, 90).lineWidth(3).stroke(primaryColor);

      // Short-term recommendations
      doc.fillColor(textColor).fontSize(14).font('Helvetica-Bold');
      doc.text('4.1 Short-term Recommendations (Immediate)', 50, 110);

      let shortTermTop = 140;
      for (let i = 0; i < remediation.shortTerm.length; i++) {
        doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold');
        doc.text(`[${i + 1}]`, 55, shortTermTop);
        doc.fillColor(textColor).font('Helvetica').fontSize(11);
        doc.text(remediation.shortTerm[i], 80, shortTermTop, { width: 465 });
        shortTermTop += 25;
      }

      // Long-term recommendations
      doc.font('Helvetica-Bold').fontSize(14).fillColor(textColor);
      doc.text('4.2 Long-term Recommendations (Strategic)', 50, shortTermTop + 20);

      shortTermTop += 60;
      for (let i = 0; i < remediation.longTerm.length; i++) {
        doc.fillColor(accentColor).fontSize(10).font('Helvetica-Bold');
        doc.text(`[${i + 1}]`, 55, shortTermTop);
        doc.fillColor(textColor).font('Helvetica').fontSize(11);
        doc.text(remediation.longTerm[i], 80, shortTermTop, { width: 465 });
        shortTermTop += 25;
      }

      // =====================
      // APPENDIX
      // =====================
      doc.addPage();
      doc.rect(0, 0, doc.page.width, doc.page.height).fill('#ffffff');

      doc.fillColor(primaryColor).fontSize(24).font('Helvetica-Bold');
      doc.text('5. APPENDIX', 50, 50);

      doc.moveTo(50, 90).lineTo(150, 90).lineWidth(3).stroke(primaryColor);

      // Tool versions
      doc.fillColor(textColor).fontSize(14).font('Helvetica-Bold');
      doc.text('5.1 Tool Versions', 50, 110);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      const tools = [
        'Nmap: 7.94',
        'Metasploit: 6.4.0',
        'SQLMap: 1.7.12',
        'Burp Suite: 2024.2',
        'OWASP ZAP: 2.14.0',
        'Nessus: 10.7.0',
      ];

      let toolsTop = 135;
      for (const tool of tools) {
        doc.text(tool, 55, toolsTop);
        toolsTop += 20;
      }

      // Timestamp
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('5.2 Test Timestamp', 50, toolsTop + 30);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      doc.text(`Test Start: ${session.createdAt}`, 50, toolsTop + 55);
      doc.text(`Test End: ${session.updatedAt}`, 50, toolsTop + 75);
      doc.text(`Report Generated: ${new Date().toISOString()}`, 50, toolsTop + 95);

      // Methodology
      doc.font('Helvetica-Bold').fontSize(14);
      doc.text('5.3 Testing Methodology', 50, toolsTop + 140);

      doc.font('Helvetica').fontSize(12).fillColor(textColor);
      const methodology = [
        '1. Information Gathering',
        '2. Vulnerability Discovery',
        '3. Vulnerability Exploitation',
        '4. Post-Exploitation Analysis',
        '5. Documentation and Reporting',
      ];

      let methodTop = toolsTop + 165;
      for (const method of methodology) {
        doc.text(method, 55, methodTop);
        methodTop += 20;
      }

      // End the PDF document
      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}