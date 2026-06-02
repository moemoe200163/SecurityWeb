#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

/**
 * Light-mode class scanner - Phase 6: Regression Prevention
 * Scans for banned hardcoded light-mode classes that should use CSS variables instead.
 *
 * Banned patterns:
 * - bg-white, bg-gray-50, bg-gray-100, bg-gray-200, bg-blue-50, bg-red-50, etc.
 * - text-gray-600, text-gray-700, text-gray-900 (only text-[var(--foreground)] allowed)
 * - border-gray-200, border-gray-300 (only border-[var(--border)] allowed)
 * - Any hardcoded palette that doesn't use /10 opacity variants
 */

const BANNED_PATTERNS = [
  // bg- with specific colors (light mode only)
  { pattern: /\bbg-white\b/, reason: 'Use bg-[var(--card)] or bg-[var(--background)]' },
  { pattern: /\bbg-gray-50\b/, reason: 'Use bg-[var(--muted)] or semantic opacity variants' },
  { pattern: /\bbg-gray-100\b/, reason: 'Use bg-[var(--muted)] or semantic opacity variants' },
  { pattern: /\bbg-gray-200\b/, reason: 'Use semantic opacity variants (bg-green-500/10)' },
  { pattern: /\bbg-gray-300\b/, reason: 'Use border-[var(--border)] or semantic opacity' },
  { pattern: /\bbg-blue-50\b/, reason: 'Use bg-blue-500/10 for blue tint backgrounds' },
  { pattern: /\bbg-blue-100\b/, reason: 'Use bg-blue-500/10 for blue tint backgrounds' },
  { pattern: /\bbg-red-50\b/, reason: 'Use bg-red-500/10 for red tint backgrounds' },
  { pattern: /\bbg-red-100\b/, reason: 'Use bg-red-500/10 for red tint backgrounds' },
  { pattern: /\bbg-green-50\b/, reason: 'Use bg-green-500/10 for green tint backgrounds' },
  { pattern: /\bbg-green-100\b/, reason: 'Use bg-green-500/10 for green tint backgrounds' },
  { pattern: /\bbg-yellow-50\b/, reason: 'Use bg-yellow-500/10 for yellow tint backgrounds' },
  { pattern: /\bbg-yellow-100\b/, reason: 'Use bg-yellow-500/10 for yellow tint backgrounds' },
  { pattern: /\bbg-orange-50\b/, reason: 'Use bg-orange-500/10 for orange tint backgrounds' },
  { pattern: /\bbg-purple-50\b/, reason: 'Use bg-purple-500/10 for purple tint backgrounds' },

  // text- with specific grays
  { pattern: /\btext-gray-600\b/, reason: 'Use text-[var(--muted-foreground)]' },
  { pattern: /\btext-gray-700\b/, reason: 'Use text-[var(--foreground)] or text-[var(--muted-foreground)]' },
  { pattern: /\btext-gray-800\b/, reason: 'Use text-[var(--foreground)]' },
  { pattern: /\btext-gray-900\b/, reason: 'Use text-[var(--foreground)]' },
  { pattern: /\btext-gray-500\b/, reason: 'Use text-[var(--muted-foreground)]' },

  // border- with specific grays
  { pattern: /\bborder-gray-200\b/, reason: 'Use border-[var(--border)]' },
  { pattern: /\bborder-gray-300\b/, reason: 'Use border-[var(--border)]' },
  { pattern: /\bborder-gray-400\b/, reason: 'Use semantic opacity variants' },

  // Non-semantic hardcoded colors (without /10 or /20 opacity)
  { pattern: /\bbg-blue-(?!500\/)/, reason: 'Use bg-blue-500/10 or bg-blue-500/20 for semantic tint' },
  { pattern: /\bbg-red-(?!500\/)/, reason: 'Use bg-red-500/10 or bg-red-500/20 for semantic tint' },
  { pattern: /\bbg-green-(?!500\/)/, reason: 'Use bg-green-500/10 or bg-green-500/20 for semantic tint' },
  { pattern: /\bbg-yellow-(?!500\/)/, reason: 'Use bg-yellow-500/10 or bg-yellow-500/20 for semantic tint' },

  // Dark mode class without proper semantic fallback
  { pattern: /\bdark:bg-gray-(?!500\/)/, reason: 'Use semantic CSS variables with .dark class' },
];

const SCAN_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
const SKIP_DIRS = ['node_modules', '.next', '.git', 'dist'];

function scanFile(filePath, results) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');

  lines.forEach((line, index) => {
    BANNED_PATTERNS.forEach(({ pattern, reason }) => {
      if (pattern.test(line)) {
        results.push({
          file: filePath,
          line: index + 1,
          content: line.trim(),
          reason,
        });
      }
    });
  });
}

function scanDirectory(dirPath, results) {
  if (!fs.existsSync(dirPath)) return;

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);

    if (entry.isDirectory()) {
      if (!SKIP_DIRS.includes(entry.name) && !entry.name.startsWith('.')) {
        scanDirectory(fullPath, results);
      }
    } else {
      const ext = path.extname(entry.name);
      if (SCAN_EXTENSIONS.includes(ext)) {
        scanFile(fullPath, results);
      }
    }
  }
}

function main() {
  const srcDir = path.join(__dirname, 'src');
  const results = [];

  console.log('🔍 Scanning for hardcoded light-mode classes...\n');
  console.log('Banned patterns:');
  BANNED_PATTERNS.forEach(({ pattern }) => {
    console.log(`  - ${pattern}`);
  });
  console.log();

  scanDirectory(srcDir, results);

  if (results.length === 0) {
    console.log('✅ No hardcoded light-mode classes found!\n');
    process.exit(0);
  }

  console.log(`❌ Found ${results.length} violation(s):\n`);

  // Group by file
  const byFile = {};
  results.forEach(r => {
    if (!byFile[r.file]) byFile[r.file] = [];
    byFile[r.file].push(r);
  });

  Object.keys(byFile).sort().forEach(file => {
    const violations = byFile[file];
    console.log(`📁 ${path.relative(__dirname, file)}`);
    violations.forEach(v => {
      console.log(`   Line ${v.line}: ${v.content}`);
      console.log(`   → ${v.reason}`);
    });
    console.log();
  });

  console.log('Fix: Replace hardcoded classes with semantic CSS variable equivalents.');
  console.log('See: globals.css for available CSS variables (--card, --border, --foreground, etc.)');

  process.exit(1);
}

main();