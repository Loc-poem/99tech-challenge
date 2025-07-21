# Score Board API Service - Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Score Board API Service to production, staging, and development environments.

## Prerequisites

### System Requirements

- **Node.js**: Version 18+ LTS
- **PostgreSQL**: Version 14+
- **Redis**: Version 6+
- **Memory**: Minimum 2GB RAM (4GB+ recommended for production)
- **CPU**: Minimum 2 cores (4+ cores recommended for production)
- **Storage**: Minimum 20GB SSD

### External Services

- **SSL Certificate**: For HTTPS endpoints
- **Load Balancer**: For production deployments
- **Monitoring Service**: Prometheus/Grafana or equivalent
- **Log Management**: ELK Stack or equivalent

## Environment Setup

### Development Environment

1. **Install Dependencies**
   ```bash
   # Install Node.js and npm
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Install PostgreSQL
   sudo apt-get install postgresql postgresql-contrib
   
   # Install Redis
   sudo apt-get install redis-server
   ```

2. **Database Setup**
   ```bash
   # Create database and user
   sudo -u postgres psql
   CREATE DATABASE scoreboard_dev;
   CREATE USER scoreboard_user WITH PASSWORD 'your_password';
   GRANT ALL PRIVILEGES ON DATABASE scoreboard_dev TO scoreboard_user;
   \q
   ```

3. **Redis Configuration**
   ```bash
   # Start Redis service
   sudo systemctl start redis-server
   sudo systemctl enable redis-server
   ```

### Production Environment

#### Docker Deployment

1. **Create Docker Compose Configuration**
   ```yaml
   # docker-compose.prod.yml
   version: '3.8'
   
   services:
     api:
       build:
         context: .
         dockerfile: Dockerfile.prod
       ports:
         - "3000:3000"
       environment:
         - NODE_ENV=production
         - DATABASE_URL=${DATABASE_URL}
         - REDIS_URL=${REDIS_URL}
         - JWT_SECRET=${JWT_SECRET}
       depends_on:
         - postgres
         - redis
       restart: unless-stopped
       healthcheck:
         test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
         interval: 30s
         timeout: 10s
         retries: 3
   
     postgres:
       image: postgres:14-alpine
       environment:
         - POSTGRES_DB=scoreboard
         - POSTGRES_USER=scoreboard_user
         - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
       volumes:
         - postgres_data:/var/lib/postgresql/data
         - ./scripts/init.sql:/docker-entrypoint-initdb.d/init.sql
       restart: unless-stopped
   
     redis:
       image: redis:6-alpine
       command: redis-server --appendonly yes
       volumes:
         - redis_data:/data
       restart: unless-stopped
   
     nginx:
       image: nginx:alpine
       ports:
         - "80:80"
         - "443:443"
       volumes:
         - ./nginx.conf:/etc/nginx/nginx.conf
         - ./ssl:/etc/nginx/ssl
       depends_on:
         - api
       restart: unless-stopped
   
   volumes:
     postgres_data:
     redis_data:
   ```

2. **Create Production Dockerfile**
   ```dockerfile
   # Dockerfile.prod
   FROM node:18-alpine AS builder
   
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production && npm cache clean --force
   
   FROM node:18-alpine AS runtime
   
   # Create app user
   RUN addgroup -g 1001 -S nodejs
   RUN adduser -S nodejs -u 1001
   
   WORKDIR /app
   
   # Copy dependencies
   COPY --from=builder --chown=nodejs:nodejs /app/node_modules ./node_modules
   
   # Copy application code
   COPY --chown=nodejs:nodejs . .
   
   # Build application
   RUN npm run build
   
   USER nodejs
   
   EXPOSE 3000
   
   HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
     CMD node healthcheck.js
   
   CMD ["npm", "start"]
   ```

## Database Migration

### Initial Database Setup

1. **Create Migration Scripts**
   ```sql
   -- migrations/001_initial.sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   
   CREATE TABLE users (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     username VARCHAR(50) UNIQUE NOT NULL,
     email VARCHAR(255) UNIQUE NOT NULL,
     password_hash VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE TABLE scores (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     current_score INTEGER DEFAULT 0,
     total_actions INTEGER DEFAULT 0,
     last_action_at TIMESTAMP,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   CREATE TABLE actions (
     id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
     user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     action_type VARCHAR(50) NOT NULL,
     score_value INTEGER NOT NULL,
     action_timestamp TIMESTAMP NOT NULL,
     client_version VARCHAR(20),
     client_platform VARCHAR(50),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );
   
   -- Indexes for performance
   CREATE INDEX idx_scores_current_score ON scores(current_score DESC);
   CREATE INDEX idx_scores_user_id ON scores(user_id);
   CREATE INDEX idx_actions_user_timestamp ON actions(user_id, action_timestamp);
   CREATE UNIQUE INDEX idx_actions_unique ON actions(id, user_id);
   
   -- Triggers for updated_at
   CREATE OR REPLACE FUNCTION update_updated_at_column()
   RETURNS TRIGGER AS $$
   BEGIN
     NEW.updated_at = CURRENT_TIMESTAMP;
     RETURN NEW;
   END;
   $$ language 'plpgsql';
   
   CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
   
   CREATE TRIGGER update_scores_updated_at BEFORE UPDATE ON scores
     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
   ```

2. **Run Migrations**
   ```bash
   # Development
   npm run migrate:dev
   
   # Production
   npm run migrate:prod
   ```

### Data Seeding

1. **Create Seed Data**
   ```sql
   -- seeds/dev.sql
   INSERT INTO users (id, username, email, password_hash) VALUES
   ('550e8400-e29b-41d4-a716-446655440000', 'testuser1', 'test1@example.com', '$2b$10$...'),
   ('550e8400-e29b-41d4-a716-446655440001', 'testuser2', 'test2@example.com', '$2b$10$...'),
   ('550e8400-e29b-41d4-a716-446655440002', 'testuser3', 'test3@example.com', '$2b$10$...');
   
   INSERT INTO scores (user_id, current_score, total_actions) VALUES
   ('550e8400-e29b-41d4-a716-446655440000', 1500, 15),
   ('550e8400-e29b-41d4-a716-446655440001', 1200, 12),
   ('550e8400-e29b-41d4-a716-446655440002', 900, 9);
   ```

## Environment Configuration

### Environment Variables

```env
# Application
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/scoreboard
DATABASE_POOL_SIZE=20
DATABASE_IDLE_TIMEOUT=30000

# Redis
REDIS_URL=redis://localhost:6379
REDIS_KEY_PREFIX=scoreboard:
REDIS_TTL_LEADERBOARD=30
REDIS_TTL_USER_SCORE=300

# JWT
JWT_SECRET=your-super-secure-secret-key-here
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_WINDOW=60000
RATE_LIMIT_MAX=10

# WebSocket
WS_HEARTBEAT_INTERVAL=30000
WS_MAX_CONNECTIONS=10000

# Security
BCRYPT_ROUNDS=12
MAX_SCORE_INCREMENT=1000
MAX_ACTIONS_PER_MINUTE=10

# Monitoring
LOG_LEVEL=info
METRICS_ENABLED=true
HEALTH_CHECK_INTERVAL=30000

# External Services
MONITORING_URL=https://monitoring.company.com
ALERT_WEBHOOK_URL=https://alerts.company.com/webhook
```

## Deployment Steps

### 1. Pre-deployment Checklist

- [ ] Environment variables configured
- [ ] Database migrations ready
- [ ] SSL certificates installed
- [ ] Load balancer configured
- [ ] Monitoring dashboards set up
- [ ] Backup procedures in place
- [ ] Rollback plan prepared

### 2. Blue-Green Deployment

```bash
#!/bin/bash
# deploy.sh

set -e

ENVIRONMENT=${1:-staging}
VERSION=${2:-latest}

echo "Deploying version $VERSION to $ENVIRONMENT environment..."

# Build and tag Docker image
docker build -t scoreboard-api:$VERSION -f Dockerfile.prod .
docker tag scoreboard-api:$VERSION scoreboard-api:$ENVIRONMENT

# Deploy to staging first
if [ "$ENVIRONMENT" == "production" ]; then
  echo "Deploying to staging first for validation..."
  docker-compose -f docker-compose.staging.yml up -d
  
  # Run health checks
  echo "Running health checks..."
  sleep 30
  curl -f http://staging.scoreboard.company.com/health || exit 1
  
  # Run integration tests
  echo "Running integration tests..."
  npm run test:integration:staging || exit 1
fi

# Deploy to target environment
echo "Deploying to $ENVIRONMENT..."
docker-compose -f docker-compose.$ENVIRONMENT.yml up -d

# Wait for deployment
echo "Waiting for deployment to complete..."
sleep 60

# Health check
echo "Running post-deployment health checks..."
HEALTH_URL="http://api.scoreboard.company.com/health"
if [ "$ENVIRONMENT" == "staging" ]; then
  HEALTH_URL="http://staging.scoreboard.company.com/health"
fi

curl -f $HEALTH_URL || exit 1

# Database migration
echo "Running database migrations..."
npm run migrate:$ENVIRONMENT

echo "Deployment completed successfully!"
```

## Security Considerations

### 1. Network Security

```nginx
# nginx.conf security headers
server {
    listen 443 ssl http2;
    server_name api.scoreboard.company.com;
    
    # SSL Configuration
    ssl_certificate /etc/nginx/ssl/cert.pem;
    ssl_certificate_key /etc/nginx/ssl/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512;
    
    # Security Headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains";
    add_header Content-Security-Policy "default-src 'self'";
    
    # Rate Limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req zone=api burst=20 nodelay;
    
    location / {
        proxy_pass http://api:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 2. Application Security

```bash
# Security scanning
npm audit
docker scan scoreboard-api:latest

# Secrets management
kubectl create secret generic scoreboard-secret \
  --from-literal=DATABASE_URL=$DATABASE_URL \
  --from-literal=JWT_SECRET=$JWT_SECRET \
  --from-literal=REDIS_URL=$REDIS_URL
```

## Backup and Recovery

### 1. Database Backup

```bash
#!/bin/bash
# backup.sh

BACKUP_DIR="/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
DATABASE_NAME="scoreboard"

# Create backup
pg_dump $DATABASE_URL > $BACKUP_DIR/scoreboard_$TIMESTAMP.sql

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/scoreboard_$TIMESTAMP.sql s3://backups/database/

# Cleanup old backups (keep last 7 days)
find $BACKUP_DIR -name "scoreboard_*.sql" -mtime +7 -delete
```

### 2. Redis Backup

```bash
#!/bin/bash
# redis-backup.sh

BACKUP_DIR="/backups/redis"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Create Redis backup
redis-cli --rdb $BACKUP_DIR/dump_$TIMESTAMP.rdb

# Upload to S3 (optional)
aws s3 cp $BACKUP_DIR/dump_$TIMESTAMP.rdb s3://backups/redis/
```

## Troubleshooting

### Common Issues

1. **High Memory Usage**
   ```bash
   # Check memory usage
   docker stats
   
   # Increase memory limits
   # In docker-compose.yml:
   deploy:
     resources:
       limits:
         memory: 1G
   ```

2. **Database Connection Issues**
   ```bash
   # Check database connectivity
   psql $DATABASE_URL -c "SELECT 1"
   
   # Check connection pool
   docker logs scoreboard-api | grep "connection"
   ```

3. **WebSocket Connection Drops**
   ```bash
   # Check WebSocket metrics
   curl http://localhost:3000/metrics | grep websocket
   
   # Increase heartbeat interval
   WS_HEARTBEAT_INTERVAL=60000
   ```

### Log Analysis

```bash
# View application logs
docker logs -f scoreboard-api

# Search for errors
docker logs scoreboard-api 2>&1 | grep ERROR

# Monitor real-time logs
tail -f /var/log/scoreboard/app.log | jq '.'
```

This deployment guide provides comprehensive instructions for deploying the Score Board API Service across different environments while maintaining security, performance, and reliability standards. 