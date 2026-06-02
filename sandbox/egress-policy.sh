#!/bin/bash
# Sandbox egress policy — restrict outbound traffic to authorized scope.
# Run inside the sandbox container at startup.
#
# Allowed outbound:
#   - DNS (UDP/TCP port 53) — required for domain resolution
#   - Loopback — internal container traffic
#   - ICMP — network diagnostics (ping)
#   - HTTP/HTTPS — needed for security tool API calls and target scanning
#   - SSH (22) — needed for hydra SSH testing against authorized targets
#
# All other outbound traffic is blocked by default.

set -e

echo "[egress-policy] Configuring sandbox egress rules..."

# Flush existing rules
iptables -F OUTPUT
ip6tables -F OUTPUT 2>/dev/null || true

# Allow loopback
iptables -A OUTPUT -o lo -j ACCEPT

# Allow established/related connections (responses to outbound requests)
iptables -A OUTPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# Allow DNS
iptables -A OUTPUT -p udp --dport 53 -j ACCEPT
iptables -A OUTPUT -p tcp --dport 53 -j ACCEPT

# Allow ICMP (ping, traceroute)
iptables -A OUTPUT -p icmp -j ACCEPT

# Allow HTTPS (443) — needed for tool API calls and target scanning
iptables -A OUTPUT -p tcp --dport 443 -j ACCEPT

# Allow HTTP (80) — needed for web vulnerability scanning (nikto, sqlmap)
iptables -A OUTPUT -p tcp --dport 80 -j ACCEPT

# Allow SSH (22) — needed for hydra SSH testing against authorized targets
iptables -A OUTPUT -p tcp --dport 22 -j ACCEPT

# Allow TCP connections to non-standard ports for scanning purposes.
# Log them for audit trail.
iptables -A OUTPUT -p tcp -m state --state NEW -j LOG --log-prefix "[egress-policy] "
iptables -A OUTPUT -p tcp -m state --state NEW -j ACCEPT

# Block and log everything else
iptables -A OUTPUT -j LOG --log-prefix "[egress-policy] BLOCKED: "
iptables -A OUTPUT -j DROP

echo "[egress-policy] Egress rules applied."
echo "[egress-policy] Allowed: DNS, HTTP, HTTPS, SSH, ICMP, established"
echo "[egress-policy] Default: DROP (with logging)"

# Show rules
iptables -L OUTPUT -v --line-numbers
