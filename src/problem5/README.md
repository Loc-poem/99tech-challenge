# Problem 5 - Backend Server with ExpressJS and JWT Authentication

A RESTful API backend server built with Express.js, TypeScript, and TypeORM providing CRUD operations for user management with JWT authentication.

## Features

- ✅ **JWT Authentication**: Secure token-based authentication
- ✅ **Password Hashing**: bcrypt for secure password storage
- ✅ **CRUD Operations**: Create, Read, Update, Delete users
- ✅ **TypeScript**: Full type safety and modern JavaScript features
- ✅ **Database Integration**: SQLite database with TypeORM
- ✅ **Data Validation**: Input validation using class-validator
- ✅ **Filtering & Pagination**: Query users with filters and pagination
- ✅ **Error Handling**: Comprehensive error handling and validation
- ✅ **Security**: Helmet for security headers, CORS enabled
- ✅ **Logging**: Request logging with Morgan

## Prerequisites

- Node.js (v16 or higher)
- npm or yarn

## Installation

1. **Navigate to the project directory:**
   ```bash
   cd src/problem5
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env` file in the project root:
   ```bash
   # JWT Configuration
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   
   # Server Configuration
   PORT=3000
   
   # Database Configuration
   DB_PATH=database.sqlite
   ```

## Running the Application

### Development Mode
```bash
npm run dev
```
This starts the server with hot-reload using ts-node-dev.

### Production Mode
```bash
# Build the TypeScript code
npm run build

# Start the server
npm start
```

The server will start on `http://localhost:3000` by default.

## API Endpoints

### Authentication (Public)

#### Register User
```bash
POST /api/auth/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "password": "password123",
  "age": 30,
  "city": "New York"
}
```

#### Login User
```bash
POST /api/auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "password123"
}
```

#### Get Profile
```bash
GET /api/auth/profile
Authorization: Bearer <your-jwt-token>
```

### Users (Protected - requires JWT token)

All user endpoints require authentication. Include the JWT token in the Authorization header:
```
Authorization: Bearer <your-jwt-token>
```

#### Get All Users
```bash
GET /api/users
Authorization: Bearer <your-jwt-token>

# With filters and pagination
GET /api/users?name=John&age=30&page=1&limit=10
```

#### Get User by ID
```bash
GET /api/users/:id
Authorization: Bearer <your-jwt-token>
```

#### Create User
```bash
POST /api/users
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123",
  "age": 25,
  "city": "Boston"
}
```

#### Update User
```bash
PUT /api/users/:id
Authorization: Bearer <your-jwt-token>
Content-Type: application/json

{
  "name": "John Smith",
  "city": "Los Angeles"
}
```

#### Delete User
```bash
DELETE /api/users/:id
Authorization: Bearer <your-jwt-token>
```

### Health Check (Public)
```bash
GET /health
```

## Authentication Flow

1. **Register**: POST `/api/auth/register` with user details
2. **Login**: POST `/api/auth/login` with email/password
3. **Receive JWT**: Both register and login return a JWT token
4. **Access Protected Routes**: Include `Authorization: Bearer <token>` header
5. **Token Validation**: Middleware validates token on each protected request

## User Entity Schema

```typescript
{
  id: number;           // Auto-generated primary key
  name: string;         // Required, min 2 characters
  email: string;        // Required, unique, valid email format
  password: string;     // Required, min 6 characters (hashed)
  age?: number;         // Optional
  city?: string;        // Optional
  createdAt: Date;      // Auto-generated
  updatedAt: Date;      // Auto-generated
}
```

## Project Structure

```
src/problem5/
├── src/
│   ├── config/
│   │   └── database.ts        # Database configuration
│   ├── controllers/
│   │   ├── userController.ts  # User CRUD operations
│   │   └── authController.ts  # Authentication handlers
│   ├── middleware/
│   │   └── auth.ts           # JWT authentication middleware
│   ├── models/
│   │   └── User.ts           # User entity model
│   ├── routes/
│   │   ├── userRoutes.ts     # Protected user routes
│   │   └── authRoutes.ts     # Authentication routes
│   ├── app.ts                # Express app setup
│   └── server.ts             # Server entry point
├── package.json
├── tsconfig.json
└── README.md
```

## Security Features

- **JWT Authentication**: Token-based authentication with 24-hour expiration
- **Password Hashing**: bcrypt with salt rounds for secure password storage
- **Protected Routes**: All user operations require authentication
- **Input Validation**: Prevents invalid data
- **Security Headers**: Helmet middleware for security headers
- **CORS**: Cross-origin requests handling

## Technologies Used

- **Express.js**: Web framework
- **TypeScript**: Type-safe JavaScript
- **TypeORM**: Object-Relational Mapping
- **SQLite**: Database
- **JWT**: JSON Web Tokens for authentication
- **bcryptjs**: Password hashing
- **class-validator**: Input validation
- **class-transformer**: Object transformation
- **Helmet**: Security middleware
- **CORS**: Cross-origin resource sharing
- **Morgan**: HTTP request logger

## Error Handling

The API returns consistent error responses:

```json
{
  "success": false,
  "message": "Error description",
  "error": "Detailed error information"
}
```

## Testing the API

1. **Start the server**: `npm run dev`
2. **Register a user**: POST to `/api/auth/register`
3. **Login**: POST to `/api/auth/login` to get JWT token
4. **Use protected endpoints**: Include `Authorization: Bearer <token>` header

## License

This project is licensed under the ISC License. 