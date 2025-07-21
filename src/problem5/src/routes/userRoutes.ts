import { Router } from 'express';
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser
} from '../controllers/userController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Apply JWT authentication middleware to all routes
router.use(authenticateToken);

// POST /api/users - Create a new user
router.post('/', createUser);

// GET /api/users - Get all users with optional filters
router.get('/', getUsers);

// GET /api/users/:id - Get user by ID
router.get('/:id', getUserById);

// PUT /api/users/:id - Update user
router.put('/:id', updateUser);

// DELETE /api/users/:id - Delete user
router.delete('/:id', deleteUser);

export default router; 