# Nginx Reverse Proxy Setup

## Overview
Nginx container provides SSL/TLS termination, WAF protection, and HTTP→HTTPS redirect.

## Architecture
```
Internet → Nginx:443 → Frontend:3000
                       → Backend:4000
         Nginx:80 → HTTP 自動重定向到 HTTPS
```

## Ports
- `80` - HTTP (auto-redirects to 443)
- `443` - HTTPS

## SSL Certificate
Self-signed certificate. Browser will show security warning.

## WAF Rules
- ModSecurity with OWASP Core Rule Set v3.3
- Custom rules for pentest traffic
- Rate limiting enabled

## API Endpoints
All /api/* requests routed to backend service.

## Direct Port Access
Frontend (3000) and Backend (4000) ports are no longer directly exposed.
All traffic must go through nginx reverse proxy.