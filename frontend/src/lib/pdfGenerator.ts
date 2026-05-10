import { jsPDF } from 'jspdf';

interface ReportData {
  sessionId: string;
  createdAt: string;
  status: string;
  input: Record<string, string>;
  steps: Array<{ title: string; content: string; status: string }>;
  vulnerabilities: Array<{
    name: string;
    description: string;
    riskLevel: string;
    cvss: string;
    cve?: string;
  }>;
  riskAssessment: {
    scope: string;
    attackVector: string;
    impact: string;
  };
  remediation: {
    shortTerm: string[];
    longTerm: string[];
  };
  summary: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
}

const COLORS = {
  primary: '#1a365d',
  accent: '#2b6cb0',
  text: '#2d3748',
  lightGray: '#718096',
  critical: '#c53030',
  high: '#dd6b20',
  medium: '#d69e2e',
  low: '#38a169',
  info: '#3182ce',
  lightBg: '#f7fafc',
};

const riskColors: Record<string, string> = {
  Critical: COLORS.critical,
  High: COLORS.high,
  Medium: COLORS.medium,
  Low: COLORS.low,
  Info: COLORS.info,
};

export async function generatePentestPDF(data: ReportData): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  let yPos = 0;

  // Helper to add new page
  const addNewPage = () => {
    doc.addPage();
    yPos = margin;
  };

  // Helper to check page overflow
  const checkOverflow = (needed: number) => {
    if (yPos + needed > pageHeight - margin) {
      addNewPage();
    }
  };

  // =====================
  // COVER PAGE
  // =====================
  doc.setFillColor(COLORS.lightBg);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  doc.setTextColor(COLORS.primary);
  doc.setFontSize(36);
  doc.setFont('helvetica', 'bold');
  doc.text('PENETRATION TEST', pageWidth / 2, 60, { align: 'center' });
  doc.text('REPORT', pageWidth / 2, 80, { align: 'center' });

  doc.setTextColor(COLORS.accent);
  doc.setFontSize(24);
  doc.setFont('helvetica', 'normal');
  doc.text('安全滲透測試報告', pageWidth / 2, 110, { align: 'center' });

  doc.setTextColor(COLORS.text);
  doc.setFontSize(12);
  doc.text(`Report ID: ${data.sessionId}`, pageWidth / 2, 150, { align: 'center' });
  doc.text(`Generated: ${new Date(data.createdAt).toLocaleDateString('zh-TW')}`, pageWidth / 2, 160, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(COLORS.lightGray);
  doc.text('SecurityWeb Multi-Agent System', pageWidth / 2, pageHeight - 30, { align: 'center' });
  doc.text('All Rights Reserved', pageWidth / 2, pageHeight - 22, { align: 'center' });

  // =====================
  // EXECUTIVE SUMMARY
  // =====================
  addNewPage();
  yPos = margin;

  doc.setTextColor(COLORS.primary);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('1. EXECUTIVE SUMMARY', margin, yPos);
  yPos += 12;

  doc.setDrawColor(COLORS.primary);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, margin + 50, yPos);
  yPos += 15;

  // Test target
  doc.setTextColor(COLORS.text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('1.1 Test Target', margin, yPos);
  yPos += 8;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Target: ${data.input?.target || data.input?.url || 'Not specified'}`, margin, yPos);
  yPos += 6;
  doc.text(`Scope: ${data.input?.scope || 'Not specified'}`, margin, yPos);
  yPos += 6;
  doc.text(`Test Type: ${data.input?.testType || data.input?.template || 'Network Scan'}`, margin, yPos);
  yPos += 12;

  // Results overview
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('1.2 Results Overview', margin, yPos);
  yPos += 10;

  // Summary table
  const tableWidth = contentWidth;
  const colWidth = tableWidth / 4;

  doc.setFillColor('#edf2f7');
  doc.rect(margin, yPos, tableWidth, 8, 'F');

  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(COLORS.primary);
  doc.text('Severity', margin + 2, yPos + 5);
  doc.text('Count', margin + colWidth + 2, yPos + 5);
  doc.text('CVSS Range', margin + colWidth * 2 + 2, yPos + 5);
  doc.text('Risk Level', margin + colWidth * 3 + 2, yPos + 5);
  yPos += 12;

  const summaryRows = [
    { label: 'Critical', count: data.summary.critical, range: '9.0-10.0', risk: 'Extrem' },
    { label: 'High', count: data.summary.high, range: '7.0-8.9', risk: 'High' },
    { label: 'Medium', count: data.summary.medium, range: '4.0-6.9', risk: 'Medium' },
    { label: 'Low', count: data.summary.low, range: '0.1-3.9', risk: 'Low' },
  ];

  doc.setFont('helvetica', 'normal');
  for (const row of summaryRows) {
    const color = riskColors[row.label] || COLORS.lightGray;
    doc.setTextColor(color);
    doc.text(row.label, margin + 2, yPos + 5);
    doc.setTextColor(COLORS.text);
    doc.text(row.count.toString(), margin + colWidth + 2, yPos + 5);
    doc.text(row.range, margin + colWidth * 2 + 2, yPos + 5);
    doc.text(row.risk, margin + colWidth * 3 + 2, yPos + 5);
    yPos += 8;
  }

  // =====================
  // VULNERABILITIES
  // =====================
  addNewPage();
  yPos = margin;

  doc.setTextColor(COLORS.primary);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('2. DISCOVERED VULNERABILITIES', margin, yPos);
  yPos += 12;
  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 15;

  for (let i = 0; i < data.vulnerabilities.length; i++) {
    const vuln = data.vulnerabilities[i];
    checkOverflow(40);

    doc.setTextColor(COLORS.primary);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text(`2.${i + 1} ${vuln.name}`, margin, yPos);

    // Risk level badge
    const riskColor = riskColors[vuln.riskLevel] || COLORS.lightGray;
    doc.setTextColor(riskColor);
    doc.setFontSize(9);
    doc.text(`[${vuln.riskLevel}]`, margin + 100, yPos);

    doc.setTextColor(COLORS.text);
    doc.text(`CVSS: ${vuln.cvss}`, margin + 130, yPos);

    if (vuln.cve) {
      doc.setTextColor(COLORS.lightGray);
      doc.text(`CVE: ${vuln.cve}`, margin + 155, yPos);
    }

    yPos += 8;

    // Description
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(vuln.description, contentWidth);
    doc.text(descLines, margin, yPos);
    yPos += descLines.length * 5 + 10;

    // Separator
    doc.setDrawColor('#e2e8f0');
    doc.setLineWidth(0.3);
    doc.line(margin, yPos, margin + contentWidth, yPos);
    yPos += 10;
  }

  // =====================
  // REMEDIATION
  // =====================
  addNewPage();
  yPos = margin;

  doc.setTextColor(COLORS.primary);
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('3. REMEDIATION RECOMMENDATIONS', margin, yPos);
  yPos += 12;
  doc.line(margin, yPos, margin + 80, yPos);
  yPos += 15;

  // Short-term recommendations
  doc.setTextColor(COLORS.text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('3.1 Short-term Recommendations (Immediate)', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  for (const rec of data.remediation.shortTerm) {
    checkOverflow(15);
    doc.setTextColor(COLORS.accent);
    doc.text(`• ${rec}`, margin, yPos);
    yPos += 6;
  }

  yPos += 10;

  // Long-term recommendations
  if (data.remediation.longTerm.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(COLORS.text);
    doc.text('3.2 Long-term Recommendations', margin, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    for (const rec of data.remediation.longTerm) {
      checkOverflow(15);
      doc.setTextColor(COLORS.accent);
      doc.text(`• ${rec}`, margin, yPos);
      yPos += 6;
    }
  }

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(COLORS.lightGray);
  doc.text('Generated by SecurityWeb Pentest System', pageWidth / 2, pageHeight - 10, { align: 'center' });

  return doc.output('blob');
}