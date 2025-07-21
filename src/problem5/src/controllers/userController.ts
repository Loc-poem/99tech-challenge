import { Request, Response } from 'express';
import { AppDataSource } from '../config/database';
import { User } from '../models/User';
import { validate } from 'class-validator';
import { plainToClass } from 'class-transformer';

const userRepository = AppDataSource.getRepository(User);

// Create a new user
export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const userData = plainToClass(User, req.body);
    const errors = await validate(userData);

    if (errors.length > 0) {
      const errorMessages = errors.map(error => 
        Object.values(error.constraints || {}).join(', ')
      ).join('; ');
      
      res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: errorMessages 
      });
      return;
    }

    const user = userRepository.create(userData);
    const savedUser = await userRepository.save(user);

    // Remove password from response
    const { password: _, ...userResponse } = savedUser;

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: userResponse
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to create user',
      error: error.message
    });
  }
};

// Get all users with optional filters
export const getUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, city, age, page = 1, limit = 10 } = req.query;
    
    const queryBuilder = userRepository.createQueryBuilder('user');
    
    // Apply filters
    if (name) {
      queryBuilder.andWhere('user.name LIKE :name', { name: `%${name}%` });
    }
    if (email) {
      queryBuilder.andWhere('user.email LIKE :email', { email: `%${email}%` });
    }
    if (city) {
      queryBuilder.andWhere('user.city LIKE :city', { city: `%${city}%` });
    }
    if (age) {
      queryBuilder.andWhere('user.age = :age', { age: parseInt(age as string) });
    }

    // Apply pagination
    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    queryBuilder.skip((pageNum - 1) * limitNum).take(limitNum);

    const [users, total] = await queryBuilder.getManyAndCount();

    // Remove passwords from all users in response
    const usersWithoutPasswords = users.map(user => {
      const { password: _, ...userResponse } = user;
      return userResponse;
    });

    res.json({
      success: true,
      data: usersWithoutPasswords,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch users',
      error: error.message
    });
  }
};

// Get user by ID
export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userRepository.findOne({ where: { id: parseInt(id) } });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Remove password from response
    const { password: _, ...userResponse } = user;

    res.json({
      success: true,
      data: userResponse
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch user',
      error: error.message
    });
  }
};

// Update user
export const updateUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userRepository.findOne({ where: { id: parseInt(id) } });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    // Merge the existing user with new data and validate
    const updatedUserData = plainToClass(User, { ...user, ...req.body });
    const errors = await validate(updatedUserData);

    if (errors.length > 0) {
      const errorMessages = errors.map(error => 
        Object.values(error.constraints || {}).join(', ')
      ).join('; ');
      
      res.status(400).json({ 
        success: false, 
        message: 'Validation failed', 
        errors: errorMessages 
      });
      return;
    }

    await userRepository.update(parseInt(id), req.body);
    const updatedUser = await userRepository.findOne({ where: { id: parseInt(id) } });

    // Remove password from response
    const { password: _, ...userResponse } = updatedUser!;

    res.json({
      success: true,
      message: 'User updated successfully',
      data: userResponse
    });
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      res.status(400).json({
        success: false,
        message: 'Email already exists'
      });
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Failed to update user',
      error: error.message
    });
  }
};

// Delete user
export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const user = await userRepository.findOne({ where: { id: parseInt(id) } });

    if (!user) {
      res.status(404).json({
        success: false,
        message: 'User not found'
      });
      return;
    }

    await userRepository.remove(user);

    res.json({
      success: true,
      message: 'User deleted successfully'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete user',
      error: error.message
    });
  }
}; 