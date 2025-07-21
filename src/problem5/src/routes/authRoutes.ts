import { Router } from 'express';
import { register, login, getProfile } from '../controllers/authController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// POST /api/auth/register - Register a new user
router.post('/register', register);

// POST /api/auth/login - Login user
router.post('/login', login);

// GET /api/auth/profile - Get current user profile (protected)
router.get('/profile', authenticateToken, getProfile);

export default router; 