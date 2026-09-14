# Production Deployment Checklist

## 🚀 Pre-Deployment

### Environment Variables
```bash
# Required
DATABASE_URL=postgresql://user:password@host:port/db?sslmode=require
NODE_ENV=production

# Security (Highly Recommended)
JWT_SECRET=<generate-with-openssl-rand-base64-32>

# Optional
LOG_LEVEL=error
ALLOWED_ORIGINS=https://yourdomain.com
MAX_REQUEST_SIZE=1mb
```

### Configuration Required for Production

#### 1. Set JWT_SECRET
Authentication is built in (JWT sessions, HTTP-only cookies, bcrypt hashing). Set a strong secret so session tokens can't be forged:

```bash
JWT_SECRET=$(openssl rand -base64 32)
```

#### 2. Configure Next.js Security Headers
**File: `next.config.ts`**

Add:
```typescript
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'on'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          },
          {
            key: 'X-Frame-Options',
            value: 'SAMEORIGIN'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()'
          }
        ]
      }
    ];
  },
  experimental: {
    bodySizeLimit: '1mb',
  }
};
```

#### 3. Upgrade Rate Limiting to Redis

**Install Redis client:**
```bash
npm install ioredis
```

**Create `src/lib/redisRateLimit.ts`:**
```typescript
import Redis from 'ioredis';

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

export async function rateLimit(key: string, limit: number, window: number) {
  const current = await redis.incr(key);
  
  if (current === 1) {
    await redis.expire(key, window);
  }
  
  if (current > limit) {
    const ttl = await redis.ttl(key);
    throw new RateLimitError(ttl);
  }
}
```

### Infrastructure Setup

#### Database
- [ ] PostgreSQL 14+ installed
- [ ] SSL/TLS enabled
- [ ] Automated backups configured
- [ ] Connection pooling enabled
- [ ] Database firewall configured (whitelist app servers only)
- [ ] Regular backup testing

#### Redis (for rate limiting)
- [ ] Redis 6+ installed
- [ ] Password authentication enabled
- [ ] Persistence configured (AOF or RDB)
- [ ] SSL/TLS enabled
- [ ] Firewall configured

#### Application Server
- [ ] Node.js 18+ installed
- [ ] PM2 or similar process manager
- [ ] Auto-restart on failure
- [ ] Log rotation configured
- [ ] Firewall configured (port 3000 or custom)

#### Reverse Proxy (Nginx/Caddy)
- [ ] HTTPS/SSL certificates (Let's Encrypt)
- [ ] HTTP to HTTPS redirect
- [ ] Rate limiting at proxy level
- [ ] Request size limits
- [ ] DDoS protection
- [ ] Gzip compression

Example Nginx config:
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    client_max_body_size 1M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 🔧 Deployment Steps

### 1. Build and Test
```bash
# Clean install
rm -rf node_modules package-lock.json
npm install

# Type check
npm run typecheck

# Build
npm run build

# Test production build locally
npm start
```

### 2. Database Migration
```bash
# Backup database first!
pg_dump -U user -d dbname > backup_$(date +%Y%m%d_%H%M%S).sql

# Push schema
npx drizzle-kit push

# Or use migrations
npx drizzle-kit generate
npx drizzle-kit migrate
```

### 3. Deploy Application

#### Using PM2:
```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "lab-asset-app" -- start

# Save PM2 process list
pm2 save

# Setup PM2 to start on boot
pm2 startup
```

#### Using Docker:
```dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
RUN npm ci --only=production
EXPOSE 3000
CMD ["npm", "start"]
```

### 4. Post-Deployment Verification
```bash
# Health check
curl https://yourdomain.com/api/health

# Test GET endpoint (expect 401 without a session cookie)
curl https://yourdomain.com/api/assets

# Test rate limiting
for i in {1..100}; do curl https://yourdomain.com/api/assets; done

# Check logs
pm2 logs lab-asset-app
# or
docker logs <container-id>
```

## 📊 Monitoring & Logging

### Error Tracking
Install Sentry:
```bash
npm install @sentry/nextjs
```

Initialize:
```typescript
// sentry.client.config.ts and sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 1.0,
});
```

### Application Metrics
- Set up New Relic / DataDog / Prometheus
- Monitor:
  - Response times
  - Error rates
  - Memory usage
  - CPU usage
  - Database connection pool
  - Rate limit hits

### Log Aggregation
- Use CloudWatch / Elasticsearch / Grafana Loki
- Centralize logs from all instances
- Set up alerts for errors

## 🔐 Security Hardening

### 1. Secrets Management
- Never commit `.env` to git
- Use AWS Secrets Manager / HashiCorp Vault / Doppler
- Rotate credentials regularly

### 2. Database Security
```sql
-- Create read-only user for reporting
CREATE USER lab_readonly WITH PASSWORD 'secure_password';
GRANT CONNECT ON DATABASE lab_db TO lab_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO lab_readonly;

-- Ensure app user has minimal permissions
REVOKE ALL ON SCHEMA public FROM lab_app;
GRANT USAGE ON SCHEMA public TO lab_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO lab_app;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO lab_app;
```

### 3. Network Security
- Enable VPC/Virtual Network
- Whitelist IPs
- Use WAF (Cloudflare, AWS WAF)
- DDoS protection

### 4. Regular Updates
```bash
# Weekly security check
npm audit
npm audit fix

# Update dependencies quarterly
npm outdated
npm update
```

## 🧪 Testing Production Build

### Security Tests
```bash
# SSL Test
curl -I https://yourdomain.com | grep "Strict-Transport-Security"

# XSS Test
curl -X POST https://yourdomain.com/api/assets \
  -H "Content-Type: application/json" \
  -d '{"name":"<script>alert(1)</script>","location":"lab","category":"other"}'

# SQL Injection Test
curl "https://yourdomain.com/api/assets?search='; DROP TABLE assets; --"

# Rate Limit Test
for i in {1..100}; do 
  curl -o /dev/null -s -w "%{http_code}\n" https://yourdomain.com/api/assets
done
```

### Performance Tests
```bash
# Install Apache Bench
sudo apt-get install apache2-utils

# Load test
ab -n 1000 -c 10 https://yourdomain.com/api/assets
```

## 📱 Client Configuration

The app authenticates with HTTP-only session cookies — no client token code is needed. If the frontend is ever served from a different origin than the API, allow it via CORS in `next.config.ts`:
```typescript
// next.config.ts
headers: async () => [{
  source: '/api/:path*',
  headers: [{ key: 'Access-Control-Allow-Origin', value: 'https://yourdomain.com' }],
}],
```

## 🔄 Rollback Plan

### If deployment fails:
```bash
# PM2
pm2 stop lab-asset-app
pm2 delete lab-asset-app
# Deploy previous version
pm2 start npm --name "lab-asset-app" -- start

# Docker
docker stop <container-id>
docker run <previous-image>

# Database
psql -U user -d dbname < backup_YYYYMMDD_HHMMSS.sql
```

## 📋 Final Checklist

- [ ] All environment variables set (JWT_SECRET, DATABASE_URL)
- [ ] `JWT_SECRET` is a strong random value
- [ ] HTTPS configured and tested
- [ ] Database backups automated
- [ ] Redis configured for rate limiting
- [ ] Security headers configured
- [ ] Error tracking setup (Sentry)
- [ ] Monitoring configured
- [ ] Log aggregation setup
- [ ] Firewall rules configured
- [ ] DDoS protection enabled
- [ ] SSL certificate auto-renewal configured
- [ ] Documentation updated
- [ ] Team trained on monitoring tools
- [ ] Incident response plan documented
- [ ] Backup restoration tested
- [ ] Performance benchmarks established
- [ ] Security scan completed

## 🆘 Support & Maintenance

### Daily
- Check error monitoring dashboard
- Review rate limit hits
- Monitor resource usage

### Weekly
- Review security logs
- Check backup integrity
- Update dependencies with security patches

### Monthly
- Full security audit
- Performance review
- Database optimization
- Update documentation

### Quarterly
- Penetration testing
- Disaster recovery drill
- Infrastructure review
- Dependency updates
