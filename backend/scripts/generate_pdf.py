#!/usr/bin/env python3
"""
PDF Generator using Playwright
Generates professional PDF reports from HTML content with full Chinese and CSS support.
"""

import sys
import json
import argparse
import os
from pathlib import Path
from datetime import datetime
from playwright.sync_api import sync_playwright


# HTML Template for the report
HTML_TEMPLATE = '''<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <title>Penetration Test Report</title>
    <style>
        @page {
            size: A4;
            margin: 20mm;
        }

        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: "Noto Sans CJK SC", "Source Han Sans SC", "Microsoft JhengHei", sans-serif;
            font-size: 11px;
            line-height: 1.6;
            color: #2d3748;
            background: white;
        }

        /* Cover Page */
        .cover-page {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            height: 100vh;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            page-break-after: always;
        }

        .cover-title {
            font-size: 36px;
            font-weight: bold;
            color: #1a365d;
            letter-spacing: 4px;
            margin-bottom: 10px;
        }

        .cover-subtitle {
            font-size: 24px;
            color: #2b6cb0;
            margin-top: 20px;
        }

        .cover-meta {
            margin-top: 80px;
            color: #718096;
            font-size: 12px;
        }

        .cover-footer {
            position: absolute;
            bottom: 40px;
            color: #a0aec0;
            font-size: 10px;
            text-align: center;
        }

        /* Content Pages */
        h1 {
            font-size: 20px;
            color: #1a365d;
            border-bottom: 3px solid #1a365d;
            padding-bottom: 5px;
            margin-bottom: 15px;
        }

        h2 {
            font-size: 14px;
            color: #1a365d;
            margin: 15px 0 10px 0;
        }

        h3 {
            font-size: 12px;
            color: #2d3748;
            margin: 10px 0 5px 0;
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }

        th {
            background: #edf2f7;
            color: #1a365d;
            padding: 8px 12px;
            text-align: left;
            font-weight: bold;
            font-size: 10px;
        }

        td {
            padding: 8px 12px;
            border-bottom: 1px solid #e2e8f0;
            font-size: 10px;
        }

        .critical { color: #c53030; font-weight: bold; }
        .high { color: #dd6b20; font-weight: bold; }
        .medium { color: #d69e2e; font-weight: bold; }
        .low { color: #38a169; font-weight: bold; }
        .info { color: #3182ce; }

        /* Vulnerabilities */
        .vuln-item {
            border-left: 4px solid #e2e8f0;
            padding: 12px 15px;
            margin: 10px 0;
            page-break-inside: avoid;
        }

        .vuln-item.critical { border-left-color: #c53030; background: #fff5f5; }
        .vuln-item.high { border-left-color: #dd6b20; background: #fffaf0; }
        .vuln-item.medium { border-left-color: #d69e2e; background: #fffff0; }
        .vuln-item.low { border-left-color: #38a169; background: #f0fff4; }

        .vuln-title {
            font-size: 12px;
            font-weight: bold;
            color: #1a365d;
        }

        .vuln-badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 3px;
            font-size: 9px;
            font-weight: bold;
            color: white;
            margin-left: 10px;
        }

        .vuln-badge.critical { background: #c53030; }
        .vuln-badge.high { background: #dd6b20; }
        .vuln-badge.medium { background: #d69e2e; }
        .vuln-badge.low { background: #38a169; }

        .vuln-meta {
            font-size: 10px;
            color: #718096;
            margin-top: 5px;
        }

        .vuln-desc {
            margin-top: 8px;
            font-size: 10px;
        }

        /* Recommendations */
        .rec-item {
            padding: 8px 0;
            font-size: 10px;
            border-bottom: 1px solid #e2e8f0;
        }

        .rec-item::before {
            content: "• ";
            color: #2b6cb0;
        }

        /* Section */
        .section {
            margin: 20px 0;
            page-break-before: always;
        }
    </style>
</head>
<body>
    <!-- Cover Page -->
    <div class="cover-page">
        <div class="cover-title">PENETRATION TEST</div>
        <div class="cover-title" style="margin-top: -10px;">REPORT</div>
        <div class="cover-subtitle">安全滲透測試報告</div>
        <div class="cover-meta">
            <p>Report ID: {{ session_id }}</p>
            <p>Generated: {{ generated_date }}</p>
        </div>
        <div class="cover-footer">
            <p>SecurityWeb Multi-Agent System</p>
            <p>All Rights Reserved</p>
        </div>
    </div>

    <!-- Executive Summary -->
    <div class="page">
        <h1>1. EXECUTIVE SUMMARY</h1>

        <h2>1.1 Test Target</h2>
        <table>
            <tr><th>Property</th><th>Value</th></tr>
            <tr><td>Target</td><td>{{ target }}</td></tr>
            <tr><td>URL</td><td>{{ url }}</td></tr>
            <tr><td>Scope</td><td>{{ scope }}</td></tr>
            <tr><td>Test Type</td><td>{{ test_type }}</td></tr>
        </table>

        <h2>1.2 Results Overview</h2>
        <table>
            <tr><th>Severity</th><th>Count</th><th>CVSS Range</th><th>Risk Level</th></tr>
            <tr><td class="critical">Critical</td><td>{{ summary.critical }}</td><td>9.0-10.0</td><td>Extreme</td></tr>
            <tr><td class="high">High</td><td>{{ summary.high }}</td><td>7.0-8.9</td><td>High</td></tr>
            <tr><td class="medium">Medium</td><td>{{ summary.medium }}</td><td>4.0-6.9</td><td>Medium</td></tr>
            <tr><td class="low">Low</td><td>{{ summary.low }}</td><td>0.1-3.9</td><td>Low</td></tr>
            <tr><td class="info">Info</td><td>{{ summary.info }}</td><td>0.0</td><td>Info</td></tr>
        </table>
    </div>

    <!-- Discovered Vulnerabilities -->
    <div class="page">
        <h1>2. DISCOVERED VULNERABILITIES</h1>

        {% for vuln in vulnerabilities %}
        <div class="vuln-item {{ vuln.risk_level|lower }}">
            <div class="vuln-title">
                2.{{ loop.index }} {{ vuln.name }}
                <span class="vuln-badge {{ vuln.risk_level|lower }}">{{ vuln.risk_level }}</span>
            </div>
            <div class="vuln-meta">
                CVSS: {{ vuln.cvss }}{% if vuln.cve %} | CVE: {{ vuln.cve }}{% endif %}
            </div>
            <div class="vuln-desc">{{ vuln.description }}</div>
        </div>
        {% endfor %}
    </div>

    <!-- Risk Assessment -->
    <div class="page">
        <h1>3. RISK ASSESSMENT</h1>

        <h2>3.1 Impact Scope</h2>
        <p>{{ risk_assessment.scope }}</p>

        <h2>3.2 Attack Vector</h2>
        <p>{{ risk_assessment.attack_vector }}</p>

        <h2>3.3 Impact Description</h2>
        <p>{{ risk_assessment.impact }}</p>
    </div>

    <!-- Remediation -->
    <div class="page">
        <h1>4. REMEDIATION RECOMMENDATIONS</h1>

        <h2>4.1 Short-term Recommendations (Immediate)</h2>
        {% for rec in remediation.short_term %}
        <div class="rec-item">{{ rec }}</div>
        {% endfor %}

        <h2>4.2 Long-term Recommendations (Strategic)</h2>
        {% for rec in remediation.long_term %}
        <div class="rec-item">{{ rec }}</div>
        {% endfor %}
    </div>
</body>
</html>
'''


def generate_html(data: dict) -> str:
    """Generate HTML from report data."""
    from jinja2 import Template

    context = {
        'session_id': data.get('session_id', 'N/A'),
        'generated_date': datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
        'target': data.get('input', {}).get('target', 'Not specified'),
        'url': data.get('input', {}).get('url', 'N/A'),
        'scope': data.get('input', {}).get('scope', 'Not specified'),
        'test_type': data.get('input', {}).get('testType', data.get('input', {}).get('template', 'Network Scan')),
        'summary': data.get('summary', {}),
        'vulnerabilities': data.get('vulnerabilities', []),
        'risk_assessment': data.get('risk_assessment', {}),
        'remediation': data.get('remediation', {}),
    }

    template = Template(HTML_TEMPLATE)
    return template.render(**context)


def generate_pdf(input_file: str, output_file: str):
    """Generate PDF from JSON data using Playwright."""

    # Read JSON data
    with open(input_file, 'r', encoding='utf-8') as f:
        data = json.load(f)

    # Generate HTML
    html_content = generate_html(data)

    # Generate PDF with Playwright
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.set_content(html_content)

        # Generate PDF with print settings
        page.pdf(
            path=output_file,
            format='A4',
            print_background=True,
            margin={
                'top': '20mm',
                'bottom': '20mm',
                'left': '20mm',
                'right': '20mm',
            }
        )

        browser.close()

    print(f"PDF generated: {output_file}")


def main():
    parser = argparse.ArgumentParser(description='Generate PDF report using Playwright')
    parser.add_argument('input', help='Input JSON file')
    parser.add_argument('-o', '--output', help='Output PDF file', default='output.pdf')

    args = parser.parse_args()

    try:
        generate_pdf(args.input, args.output)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    main()