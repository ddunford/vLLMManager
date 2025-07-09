# Production Deployment Guide

This guide covers deploying vLLM Manager in production environments with security and scalability considerations.

## Prerequisites

### System Requirements

- **Operating System**: Ubuntu 20.04+ or similar Linux distribution
- **Docker**: Version 20.10+ with Docker Compose v2
- **Hardware**: 
  - Minimum: 4GB RAM, 2 CPU cores, 50GB storage
  - Recommended: 16GB+ RAM, 8+ CPU cores, 100GB+ SSD storage
- **Network**: Open ports 3001 (application), 8001-9000 (vLLM instances)

### GPU Support (Optional)

For GPU acceleration:
- NVIDIA GPU with CUDA support
- NVIDIA Container Toolkit installed
- Driver version 470.57.02 or newer

## Environment Configuration

### 1. Create Environment File

Copy the example environment file and customize:

```bash
cp .env.example .env
```

### 2. Configure Environment Variables

Edit `.env` with your production settings:

```bash
# Server Configuration
NODE_ENV=production
PORT=3001
DEFAULT_HOSTNAME=your-server-ip-or-domain

# HuggingFace Configuration
HF_TOKEN=your_huggingface_token_here

# Security Settings
JWT_SECRET=your_jwt_secret_here_minimum_32_characters
SESSION_SECRET=your_session_secret_here_minimum_32_characters

# CORS Configuration
FRONTEND_URL=https://your-frontend-domain.com

# Logging
LOG_LEVEL=info

# Port Range for vLLM Instances
MIN_PORT=8001
MAX_PORT=9000
```

### 3. Database Configuration

The application uses SQLite by default. For production, consider:

```bash
# SQLite (default)
DB_PATH=./server/data/vllm.db

# For high availability, consider migrating to PostgreSQL
```

## Deployment Methods

### Method 1: Docker Compose (Recommended)

#### Production Deployment

1. **Build and start services:**
```bash
docker compose -f docker-compose.prod.yml up -d
```

2. **Verify deployment:**
```bash
curl -f http://localhost:3001/api/health
```

3. **View logs:**
```bash
docker compose logs -f vllm-manager
```

#### Development Deployment

```bash
docker compose up -d
```

### Method 2: Direct Installation

1. **Install dependencies:**
```bash
npm run install:all
```

2. **Build frontend:**
```bash
npm run build
```

3. **Start application:**
```bash
npm start
```

## Security Configuration

### 1. Reverse Proxy Setup (Nginx)

Create `/etc/nginx/sites-available/vllm-manager`:

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/your/certificate.pem;
    ssl_certificate_key /path/to/your/private.key;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=general:10m rate=5r/s;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Rate limiting
        limit_req zone=general burst=20 nodelay;
    }

    location /api/ {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # API rate limiting
        limit_req zone=api burst=50 nodelay;
    }
}
```

### 2. Firewall Configuration

```bash
# Allow SSH, HTTP, HTTPS, and application ports
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3001/tcp
ufw allow 8001:9000/tcp
ufw enable
```

### 3. SSL/TLS Certificate

Using Let's Encrypt:

```bash
certbot --nginx -d your-domain.com
```

## Monitoring and Logging

### 1. Log Management

Logs are stored in:
- Application logs: `server/logs/`
- Container logs: `docker compose logs`

### 2. Log Rotation

Add to `/etc/logrotate.d/vllm-manager`:

```
/path/to/vllm-manager/server/logs/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 vllm vllm
    postrotate
        docker compose restart vllm-manager
    endscript
}
```

### 3. Health Monitoring

Set up health checks:

```bash
# Add to crontab
*/5 * * * * curl -f http://localhost:3001/api/health || systemctl restart vllm-manager
```

## Backup and Recovery

### 1. Database Backup

```bash
# Create backup
cp server/data/vllm.db backups/vllm-$(date +%Y%m%d-%H%M%S).db

# Automated backup script
#!/bin/bash
BACKUP_DIR="/path/to/backups"
mkdir -p $BACKUP_DIR
cp server/data/vllm.db $BACKUP_DIR/vllm-$(date +%Y%m%d-%H%M%S).db
find $BACKUP_DIR -name "vllm-*.db" -mtime +30 -delete
```

### 2. Configuration Backup

```bash
# Backup configuration files
tar -czf config-backup-$(date +%Y%m%d).tar.gz \
  docker-compose.yml \
  docker-compose.prod.yml \
  .env \
  server/data/ \
  --exclude=server/data/*.db-wal \
  --exclude=server/data/*.db-shm
```

## Performance Optimization

### 1. Resource Limits

Configure Docker resource limits:

```yaml
# In docker-compose.prod.yml
services:
  vllm-manager:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 8G
        reservations:
          cpus: '2.0'
          memory: 4G
```

### 2. Caching

Enable Redis for session storage (optional):

```yaml
services:
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis-data:/data
```

## Troubleshooting

### Common Issues

1. **Port conflicts**: Change ports in `.env` file
2. **Permission denied**: Ensure proper file permissions
3. **Database locked**: Check for multiple instances
4. **GPU not detected**: Verify NVIDIA Container Toolkit installation

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug docker compose up -d
```

### Health Checks

```bash
# Check application health
curl http://localhost:3001/api/health

# Check container status
docker compose ps

# View logs
docker compose logs -f vllm-manager
```

## Updates and Maintenance

### 1. Application Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

### 2. Security Updates

```bash
# Update dependencies
npm audit fix

# Update Docker images
docker compose pull
docker compose -f docker-compose.prod.yml up -d
```

## Support

For production support issues:
- Check the logs first
- Review this deployment guide
- Open an issue on GitHub with deployment details
- Contact support with your configuration (remove sensitive data)

## Compliance

This deployment configuration follows:
- Docker security best practices
- OWASP security guidelines
- Production deployment standards
- Container orchestration best practices 