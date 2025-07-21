# Score Board API Service Module Specification

## Overview

This document specifies the backend API service module for a real-time score board system that displays the top 10 users' scores with live updates. The system is designed to handle user score updates securely while preventing unauthorized manipulation.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [System Requirements](#system-requirements)
3. [API Endpoints](#api-endpoints)
4. [Real-time Communication](#real-time-communication)
5. [Data Models](#data-models)
6. [Security & Authentication](#security--authentication)
7. [Database Schema](#database-schema)
8. [Technical Implementation](#technical-implementation)
9. [Deployment Considerations](#deployment-considerations)
10. [Improvement Recommendations](#improvement-recommendations)

## Architecture Overview

The score board API service follows a microservice architecture pattern with the following components:

- **Authentication Service**: Handles user authentication and JWT token management
- **Score Management Service**: Processes score updates and maintains user scores
- **Leaderboard Service**: Manages and caches top 10 user rankings
- **WebSocket Service**: Provides real-time score board updates

## System Requirements
- **Rate Limiting Service**: Prevents abuse and malicious requests

### Functional Requirements

1. **Score Board Display**: System must display top 10 users ranked by score
2. **Real-time Updates**: Score board must update in real-time when scores change
3. **Score Updates**: Users can perform actions that increase their scores
4. **Secure Updates**: Only authorized users can update their own scores
5. **Anti-fraud Protection**: Prevent malicious score manipulation

### Non-Functional Requirements

1. **Performance**: API response time < 200ms for score updates
2. **Scalability**: Support 10,000+ concurrent users
3. **Availability**: 99.9% uptime SLA
4. **Security**: JWT-based authentication with request validation
5. **Real-time**: WebSocket updates delivered within 100ms

## API Endpoints

### Authentication Endpoints

```
POST /api/v1/auth/login
POST /api/v1/auth/refresh
POST /api/v1/auth/logout
```

### Score Management Endpoints

```
GET    /api/v1/scores/leaderboard     # Get top 10 scores
POST   /api/v1/scores/update          # Update user score
GET    /api/v1/scores/user/{userId}   # Get specific user score
GET    /api/v1/scores/my-score        # Get current user's score
```

### WebSocket Endpoints

```
WS /api/v1/ws/leaderboard    # Real-time leaderboard updates
```

## API Specification Details

### GET /api/v1/scores/leaderboard

**Description**: Retrieve the current top 10 users' scores

**Response**:
```json
{
  "success": true,
  "data": {
    "leaderboard": [
      {
        "rank": 1,
        "userId": "user123",
        "username": "player1",
        "score": 15420,
        "lastUpdated": "2024-01-15T10:30:00Z"
      }
    ],
    "lastUpdated": "2024-01-15T10:30:00Z"
  }
}
```

### POST /api/v1/scores/update

**Description**: Update user's score after completing an action

**Headers**:
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "actionType": "task_completion",
  "actionId": "action_12345",
  "scoreIncrement": 100,
  "metadata": {
    "timestamp": "2024-01-15T10:30:00Z",
    "clientVersion": "1.0.0"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "newScore": 1520,
    "scoreIncrement": 100,
    "newRank": 5,
    "previousRank": 7
  }
}
```

## Real-time Communication

### WebSocket Implementation

The system uses WebSocket connections for real-time score board updates:

1. **Connection**: Clients connect to `/api/v1/ws/leaderboard`
2. **Authentication**: JWT token passed via query parameter or header
3. **Message Types**:
   - `leaderboard_update`: Broadcast when top 10 changes
   - `score_update`: Individual user score changes
   - `rank_change`: User rank position changes

### WebSocket Message Format

```json
{
  "type": "leaderboard_update",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "leaderboard": [...],
    "changedUsers": ["user123", "user456"]
  }
}
```

## Data Models

### User Model
```typescript
interface User {
  id: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
}
```

### Score Model
```typescript
interface Score {
  id: string;
  userId: string;
  currentScore: number;
  totalActions: number;
  lastActionAt: Date;
  createdAt: Date;
  updatedAt: Date;
}
```

### Action Model
```typescript
interface Action {
  id: string;
  userId: string;
  actionType: string;
  scoreValue: number;
  timestamp: Date;
  clientInfo: {
    version: string;
    platform: string;
  };
}
```

## Security & Authentication

### JWT Authentication

1. **Token Structure**: Standard JWT with user ID, role, and expiration
2. **Token Expiry**: Access tokens expire in 15 minutes
3. **Refresh Tokens**: Valid for 7 days, stored securely
4. **Token Validation**: All protected endpoints validate JWT signature

### Score Update Security

1. **Action Validation**: Each action must be validated before score update
2. **Rate Limiting**: Maximum 10 score updates per minute per user
3. **Duplicate Prevention**: Action IDs must be unique to prevent replay attacks
4. **Score Limits**: Maximum score increment per action is 1000 points
5. **Anomaly Detection**: Flag users with suspicious scoring patterns

### Concurrent Request Protection (Anti-Cheat Measures)

To prevent users from calling the increment API multiple times for the same action (e.g., completing one task but sending two API calls to get double points), implement the following multi-layered protection:

#### 1. Unique Action ID with Database Constraints

```sql
-- Ensure action IDs are unique per user
CREATE UNIQUE INDEX idx_actions_unique_per_user ON actions(action_id, user_id);

-- Alternative: Global unique action IDs
ALTER TABLE actions ADD CONSTRAINT unique_action_id UNIQUE (action_id);
```

#### 2. Redis-Based Distributed Locking

```typescript
interface ActionLockService {
  async acquireLock(userId: string, actionId: string, ttl: number = 30): Promise<boolean>;
  async releaseLock(userId: string, actionId: string): Promise<void>;
}

// Implementation
class RedisActionLockService implements ActionLockService {
  async acquireLock(userId: string, actionId: string, ttl: number = 30): Promise<boolean> {
    const lockKey = `action_lock:${userId}:${actionId}`;
    const result = await redis.set(lockKey, '1', 'EX', ttl, 'NX');
    return result === 'OK';
  }

  async releaseLock(userId: string, actionId: string): Promise<void> {
    const lockKey = `action_lock:${userId}:${actionId}`;
    await redis.del(lockKey);
  }
}
```

#### 3. Idempotency Implementation

```typescript
// Score update endpoint with idempotency protection
app.post('/api/v1/scores/update', async (req, res) => {
  const { actionId, actionType, scoreIncrement } = req.body;
  const userId = req.user.id;
  
  // Step 1: Acquire distributed lock
  const lockAcquired = await actionLockService.acquireLock(userId, actionId, 30);
  if (!lockAcquired) {
    return res.status(409).json({
      success: false,
      error: {
        code: 'CONCURRENT_REQUEST',
        message: 'Another request for this action is being processed'
      }
    });
  }

  try {
    // Step 2: Check if action already exists
    const existingAction = await db.query(
      'SELECT id FROM actions WHERE action_id = $1 AND user_id = $2',
      [actionId, userId]
    );

    if (existingAction.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ACTION',
          message: 'This action has already been processed'
        }
      });
    }

    // Step 3: Process action with database transaction
    await db.query('BEGIN');
    
    // Insert action record first (will fail if duplicate due to unique constraint)
    await db.query(
      'INSERT INTO actions (action_id, user_id, action_type, score_value, action_timestamp) VALUES ($1, $2, $3, $4, $5)',
      [actionId, userId, actionType, scoreIncrement, new Date()]
    );
    
    // Update user score
    const result = await db.query(
      'UPDATE scores SET current_score = current_score + $1, total_actions = total_actions + 1, last_action_at = $2 WHERE user_id = $3 RETURNING current_score, total_actions',
      [scoreIncrement, new Date(), userId]
    );
    
    await db.query('COMMIT');
    
    // Step 4: Success response
    res.json({
      success: true,
      data: {
        newScore: result.rows[0].current_score,
        scoreIncrement,
        actionProcessed: true
      }
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    
    if (error.constraint === 'unique_action_id') {
      return res.status(409).json({
        success: false,
        error: {
          code: 'DUPLICATE_ACTION',
          message: 'This action has already been processed'
        }
      });
    }
    
    throw error;
  } finally {
    // Step 5: Always release lock
    await actionLockService.releaseLock(userId, actionId);
  }
});
```

#### 4. Client-Side Action ID Generation

```typescript
// Client should generate unique action IDs
interface ActionRequest {
  actionId: string; // UUID v4 + timestamp + user action
  actionType: string;
  scoreIncrement: number;
  timestamp: number;
  nonce: string; // Additional randomness
}

// Example client-side generation
function generateActionId(userId: string, actionType: string): string {
  const timestamp = Date.now();
  const nonce = Math.random().toString(36).substring(2);
  return `${userId}_${actionType}_${timestamp}_${nonce}`;
}
```

#### 5. Rate Limiting Per Action Type

```typescript
// Enhanced rate limiting per action type
const actionRateLimits = {
  'task_completion': { window: 60000, max: 5 },    // 5 task completions per minute
  'achievement_unlock': { window: 300000, max: 2 }, // 2 achievements per 5 minutes
  'bonus_action': { window: 3600000, max: 10 }      // 10 bonus actions per hour
};

// Rate limiting middleware
async function actionRateLimit(req: Request, res: Response, next: NextFunction) {
  const { actionType } = req.body;
  const userId = req.user.id;
  const limits = actionRateLimits[actionType];
  
  if (!limits) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_ACTION_TYPE', message: 'Invalid action type' }
    });
  }
  
  const key = `rate_limit:${actionType}:${userId}`;
  const current = await redis.get(key);
  
  if (current && parseInt(current) >= limits.max) {
    return res.status(429).json({
      success: false,
      error: {
        code: 'ACTION_RATE_LIMIT',
        message: `Too many ${actionType} actions. Try again later.`
      }
    });
  }
  
  // Increment counter
  await redis.multi()
    .incr(key)
    .expire(key, Math.ceil(limits.window / 1000))
    .exec();
  
  next();
}
```

#### 6. Action Verification Service

```typescript
// Separate service to verify action legitimacy
interface ActionVerificationService {
  verifyAction(userId: string, actionType: string, metadata: any): Promise<boolean>;
}

class GameActionVerifier implements ActionVerificationService {
  async verifyAction(userId: string, actionType: string, metadata: any): Promise<boolean> {
    switch (actionType) {
      case 'task_completion':
        return this.verifyTaskCompletion(userId, metadata.taskId);
      case 'achievement_unlock':
        return this.verifyAchievement(userId, metadata.achievementId);
      default:
        return false;
    }
  }
  
  private async verifyTaskCompletion(userId: string, taskId: string): Promise<boolean> {
    // Verify with game state or external service
    // Check if user actually completed the task
    const gameState = await this.getGameState(userId);
    return gameState.completedTasks.includes(taskId);
  }
}
```

#### 7. Database Transaction with Pessimistic Locking

```sql
-- Alternative approach using database-level locking
BEGIN;

-- Lock the user's score record for update
SELECT current_score FROM scores WHERE user_id = $1 FOR UPDATE;

-- Check for duplicate action
SELECT id FROM actions WHERE action_id = $2 AND user_id = $1;

-- If no duplicate, insert action and update score
INSERT INTO actions (action_id, user_id, action_type, score_value, action_timestamp) 
VALUES ($2, $1, $3, $4, NOW());

UPDATE scores 
SET current_score = current_score + $4, 
    total_actions = total_actions + 1,
    last_action_at = NOW()
WHERE user_id = $1;

COMMIT;
```

#### 8. Monitoring and Alerting for Suspicious Activity

```typescript
// Monitor for suspicious patterns
interface SecurityMonitor {
  flagSuspiciousActivity(userId: string, pattern: string): Promise<void>;
}

// Patterns to detect:
// - Multiple identical action IDs
// - Rapid succession of high-value actions
// - Unusual scoring patterns
// - Failed duplicate action attempts

async function monitorUserActivity(userId: string, actionType: string, scoreIncrement: number) {
  const recentActions = await redis.lrange(`user_actions:${userId}`, 0, 9);
  
  // Check for rapid high-value actions
  const highValueCount = recentActions.filter(action => {
    const parsed = JSON.parse(action);
    return parsed.scoreIncrement > 500 && 
           (Date.now() - parsed.timestamp) < 60000; // Last minute
  }).length;
  
  if (highValueCount > 3) {
    await securityMonitor.flagSuspiciousActivity(userId, 'RAPID_HIGH_VALUE_ACTIONS');
  }
  
  // Store current action
  await redis.lpush(`user_actions:${userId}`, JSON.stringify({
    actionType,
    scoreIncrement,
    timestamp: Date.now()
  }));
  await redis.ltrim(`user_actions:${userId}`, 0, 9); // Keep last 10 actions
}
```

#### Summary of Protection Layers

1. **Application Level**: Redis distributed locking + idempotency checks
2. **Database Level**: Unique constraints + transactions + pessimistic locking
3. **Rate Limiting**: Per-action-type limits to prevent spam
4. **Action Verification**: Validate actions against game state
5. **Monitoring**: Real-time detection of suspicious patterns
6. **Client Integration**: Proper action ID generation

This multi-layered approach ensures that even if one protection mechanism fails, others will catch the duplicate request and prevent point manipulation.

### Request Signing (Recommended)

For additional security, implement request signing:

```typescript
interface SignedRequest {
  payload: ScoreUpdateRequest;
  signature: string; // HMAC-SHA256 of payload + timestamp + secret
  timestamp: number;
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

### Scores Table
```sql
CREATE TABLE scores (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  current_score INT DEFAULT 0,
  total_actions INT DEFAULT 0,
  last_action_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  INDEX idx_current_score (current_score DESC),
  INDEX idx_user_id (user_id)
);
```

### Actions Table
```sql
CREATE TABLE actions (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  action_type VARCHAR(50) NOT NULL,
  score_value INT NOT NULL,
  action_timestamp TIMESTAMP NOT NULL,
  client_version VARCHAR(20),
  client_platform VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id),
  UNIQUE KEY unique_action (id, user_id),
  INDEX idx_user_timestamp (user_id, action_timestamp)
);
```

## Technical Implementation

### Technology Stack Recommendations

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js or Fastify
- **Database**: PostgreSQL with Redis for caching
- **WebSocket**: Socket.io or native WebSocket
- **Authentication**: jsonwebtoken library
- **Validation**: Joi or Zod
- **Rate Limiting**: express-rate-limit with Redis store

### Caching Strategy

1. **Leaderboard Cache**: Redis cache for top 10 users (TTL: 30 seconds)
2. **User Score Cache**: Cache individual user scores (TTL: 5 minutes)
3. **Cache Invalidation**: Invalidate on score updates
4. **Cache Warming**: Pre-populate cache during deployment

### Error Handling

```typescript
interface APIError {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
  };
  timestamp: string;
}
```

### Common Error Codes

- `AUTH_001`: Invalid or expired token
- `SCORE_001`: Invalid score increment value
- `SCORE_002`: Rate limit exceeded
- `SCORE_003`: Duplicate action ID
- `SCORE_004`: Action validation failed

## Deployment Considerations

### Environment Configuration

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/scoreboard
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=your-secret-key
JWT_EXPIRY=15m
REFRESH_TOKEN_EXPIRY=7d

# Rate Limiting
RATE_LIMIT_WINDOW=60000  # 1 minute
RATE_LIMIT_MAX=10        # 10 requests per minute

# WebSocket
WS_HEARTBEAT_INTERVAL=30000  # 30 seconds
WS_MAX_CONNECTIONS=10000
```

### Health Check Endpoints

```
GET /health          # Basic health check
GET /health/detailed # Detailed health including DB connectivity
```

### Monitoring & Logging

1. **Metrics**: Track API response times, WebSocket connections, score update frequency
2. **Logging**: Structured logging with correlation IDs
3. **Alerting**: Set up alerts for high error rates or unusual scoring patterns

## Improvement Recommendations

### Phase 1 Improvements (Essential)

1. **Action Validation Service**: Implement a separate service to validate actions before score updates
2. **Audit Trail**: Log all score changes for debugging and fraud detection
3. **Backup Leaderboard**: Maintain hourly/daily leaderboard snapshots
4. **Input Sanitization**: Sanitize all user inputs to prevent injection attacks

### Phase 2 Improvements (Performance)

1. **Database Sharding**: Shard user data across multiple databases for scalability
2. **CDN Integration**: Use CDN for static leaderboard data
3. **Message Queuing**: Implement async processing for score updates using Redis/RabbitMQ
4. **Read Replicas**: Use database read replicas for leaderboard queries

### Phase 3 Improvements (Advanced Features)

1. **Machine Learning Fraud Detection**: Implement ML models to detect suspicious scoring patterns
2. **Leaderboard Variants**: Support different leaderboard types (daily, weekly, monthly)
3. **Achievement System**: Extend to support achievements and badges
4. **Analytics Dashboard**: Admin dashboard for monitoring user behavior and system performance

### Phase 4 Improvements (Enterprise)

1. **Multi-region Deployment**: Deploy across multiple regions for low latency
2. **Event Sourcing**: Implement event sourcing for complete action history
3. **GraphQL API**: Provide GraphQL interface for flexible data queries
4. **Microservices Architecture**: Split into dedicated microservices for each domain

### Security Enhancements

1. **API Gateway**: Implement an API gateway for centralized security and rate limiting
2. **Request Signing**: Add HMAC request signing for critical operations
3. **IP Whitelisting**: Allow IP whitelisting for additional security
4. **Penetration Testing**: Regular security audits and penetration testing

### Performance Optimizations

1. **Database Indexing**: Optimize database indexes for leaderboard queries
2. **Connection Pooling**: Implement database connection pooling
3. **Compression**: Enable response compression for API calls
4. **Lazy Loading**: Implement lazy loading for non-critical data

## Conclusion

This specification provides a comprehensive foundation for implementing a secure, scalable, and real-time score board API service. The modular design allows for incremental implementation and future enhancements while maintaining security and performance standards.

The implementation team should prioritize Phase 1 improvements during initial development and plan for subsequent phases based on user growth and system requirements. 