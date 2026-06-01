import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  // 1. Create default admin user
  const adminApiKey = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
  const admin = await prisma.user.upsert({
    where: { apiKey: adminApiKey },
    update: {},
    create: {
      id: 'admin-default',
      apiKey: adminApiKey,
      role: 'admin',
    },
  });
  console.log(`✅ Admin user created: ${admin.id}`);
  console.log(`   API Key: ${adminApiKey}`);

  // 2. Create default tool templates
  const toolTemplates = [
    {
      id: 'nmap_basic',
      name: 'Nmap 基本掃描',
      tool: 'nmap',
      description: '基本 TCP 連接埠掃描',
      commandTemplate: 'nmap -sT {target}',
      allowedParams: { target: [] },
      riskLevel: 'low',
    },
    {
      id: 'nmap_stealth',
      name: 'Nmap 隱密掃描',
      tool: 'nmap',
      description: 'SYN 隱密掃描',
      commandTemplate: 'nmap -sS {target}',
      allowedParams: { target: [] },
      riskLevel: 'medium',
    },
    {
      id: 'nmap_full',
      name: 'Nmap 完整掃描',
      tool: 'nmap',
      description: '完整版本偵測掃描',
      commandTemplate: 'nmap -sV -sC -O {target}',
      allowedParams: { target: [] },
      riskLevel: 'high',
    },
    {
      id: 'nikto_web',
      name: 'Nikto Web 掃描',
      tool: 'nikto',
      description: 'Web 伺服器漏洞掃描',
      commandTemplate: 'nikto -h {target}',
      allowedParams: { target: [] },
      riskLevel: 'high',
    },
    {
      id: 'sql_basic',
      name: 'SQLMap 基本檢測',
      tool: 'sqlmap',
      description: 'SQL 注入檢測',
      commandTemplate: 'sqlmap -u {url} --batch',
      allowedParams: { url: [] },
      riskLevel: 'high',
    },
    {
      id: 'sql_dump',
      name: 'SQLMap 資料庫匯出',
      tool: 'sqlmap',
      description: 'SQL 注入檢測 + 資料庫匯出（高風險）',
      commandTemplate: 'sqlmap -u {url} --batch --dump',
      allowedParams: { url: [] },
      riskLevel: 'high',
      isEnabled: false, // 高風險工具預設停用
    },
    {
      id: 'hydra_ssh',
      name: 'Hydra SSH 暴力破解',
      tool: 'hydra',
      description: 'SSH 暴力破解攻擊（高風險）',
      commandTemplate: 'hydra -l {user} -p {password} {target} ssh',
      allowedParams: { user: [], password: [], target: [] },
      riskLevel: 'high',
      isEnabled: false,
    },
    {
      id: 'holehe_email',
      name: 'Holehe 郵箱查詢',
      tool: 'holehe',
      description: '查詢郵箱是否在各種網站註冊',
      commandTemplate: 'holehe {email}',
      allowedParams: { email: [] },
      riskLevel: 'medium',
    },
  ];

  for (const template of toolTemplates) {
    await prisma.toolTemplate.upsert({
      where: { id: template.id },
      update: {},
      create: {
        ...template,
        createdBy: admin.id,
        isApproved: true,
        isEnabled: template.isEnabled ?? true,
      },
    });
    console.log(`✅ Tool template created: ${template.id}`);
  }

  // 3. Create demo alerts
  const demoAlerts = [
    {
      source: 'demo',
      title: 'SQL 注入嘗試 - 登入頁面',
      severity: 'high',
      rawContent: JSON.stringify({
        timestamp: new Date().toISOString(),
        source_ip: '192.168.1.100',
        method: 'POST',
        path: '/login',
        body: { username: "admin' OR '1'='1", password: 'anything' },
        user_agent: 'sqlmap/1.5',
      }),
      normalizedFields: {
        attack_type: 'SQL Injection',
        target: '/login',
        indicator: "admin' OR '1'='1",
      },
      aiVerdict: 'attack_attempt',
      status: 'new',
    },
    {
      source: 'demo',
      title: 'XSS 攻擊嘗試 - 搜尋參數',
      severity: 'medium',
      rawContent: JSON.stringify({
        timestamp: new Date().toISOString(),
        source_ip: '10.0.0.50',
        method: 'GET',
        path: '/search',
        query: { q: '<script>alert("XSS")</script>' },
        user_agent: 'Mozilla/5.0',
      }),
      normalizedFields: {
        attack_type: 'XSS',
        target: '/search',
        indicator: '<script>alert("XSS")</script>',
      },
      aiVerdict: 'attack_attempt',
      status: 'new',
    },
    {
      source: 'demo',
      title: '暴力破解登入嘗試',
      severity: 'high',
      rawContent: JSON.stringify({
        timestamp: new Date().toISOString(),
        source_ip: '203.0.113.25',
        method: 'POST',
        path: '/api/auth/login',
        attempts: 15,
        timeframe: '5 minutes',
        user_agent: 'python-requests/2.28',
      }),
      normalizedFields: {
        attack_type: 'Brute Force',
        target: '/api/auth/login',
        attempts: 15,
        source_country: 'XX',
      },
      aiVerdict: 'attack_attempt',
      status: 'new',
    },
    {
      source: 'demo',
      title: '可疑的 LFI 請求',
      severity: 'critical',
      rawContent: JSON.stringify({
        timestamp: new Date().toISOString(),
        source_ip: '198.51.100.10',
        method: 'GET',
        path: '/admin/logs',
        query: { file: '../../../../etc/passwd' },
        user_agent: 'curl/7.68',
      }),
      normalizedFields: {
        attack_type: 'LFI',
        target: '/admin/logs',
        indicator: '../../../../etc/passwd',
      },
      aiVerdict: 'attack_attempt',
      status: 'new',
    },
    {
      source: 'demo',
      title: '正常流量 - 產品頁面瀏覽',
      severity: 'info',
      rawContent: JSON.stringify({
        timestamp: new Date().toISOString(),
        source_ip: '172.16.0.100',
        method: 'GET',
        path: '/products/123',
        user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
      }),
      normalizedFields: {
        attack_type: null,
        target: '/products/123',
      },
      aiVerdict: 'legitimate',
      status: 'resolved',
    },
  ];

  for (const alert of demoAlerts) {
    await prisma.alert.create({
      data: alert,
    });
    console.log(`✅ Demo alert created: ${alert.title}`);
  }

  console.log('\n🎉 Seed completed!');
  console.log('\n📝 Next steps:');
  console.log('1. Run: npx prisma db push (to create tables)');
  console.log('2. Copy the admin API key above for testing');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });