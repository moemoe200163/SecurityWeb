-- Pre-approved tool templates
INSERT INTO tool_templates (id, name, tool, command_template, allowed_params, is_approved) VALUES
('nmap_basic', 'Nmap Basic Scan', 'nmap', '/usr/lib/nmap/nmap -sV -p {ports} -oA nmap_scan {target}', '{"ports": ["22", "80", "443", "22,80,443", "1-1000", "1-65535"], "target": []}', true),
('nmap_stealth', 'Nmap Stealth Scan', 'nmap', '/usr/lib/nmap/nmap -sS -p {ports} -oA nmap_scan {target}', '{"ports": ["22", "80", "443", "22,80,443", "1-1000", "1-65535"], "target": []}', true),
('nmap_full', 'Nmap Full Scan', 'nmap', '/usr/lib/nmap/nmap -sV -sC -p- -oA nmap_scan {target}', '{"ports": [], "target": []}', true),
('sql_basic', 'SQLMap Basic Test', 'sqlmap', 'sqlmap -u {url} --batch --dbs', '{"url": []}', true),
('sql_dump', 'SQLMap Data Dump', 'sqlmap', 'sqlmap -u {url} --batch --dump', '{"url": []}', true),
('nikto_web', 'Nikto Web Scan', 'nikto', 'nikto -h {url} -output /tmp/nikto_scan.txt', '{"url": []}', true),
('nikto_ssl', 'Nikto SSL Scan', 'nikto', 'nikto -h {url} -ssl -output /tmp/nikto_scan.txt', '{"url": []}', true),
('hydra_ssh', 'Hydra SSH Brute', 'hydra', 'hydra -l {user} -P {password_list} ssh://{target}', '{"user": [], "password_list": ["/usr/share/wordlists/fasttrack.txt"], "target": []}', true),
('hydra_http', 'Hydra HTTP Brute', 'hydra', 'hydra -l {user} -P {password_list} http-post-form://{target}', '{"user": [], "password_list": ["/usr/share/wordlists/fasttrack.txt"], "target": []}', true)
ON CONFLICT (id) DO NOTHING;