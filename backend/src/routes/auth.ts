import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../db';
import { config } from '../config';
import { AuthenticatedRequest, authenticateToken } from '../middleware/auth';

const router = Router();

// Register patient or clinician
router.post('/register', async (req: any, res: Response) => {
  const { name, email, password, dob, sex, insuranceProvider, insurancePolicy, role } = req.body;

  if (!name || !email || !password || !dob || !sex) {
    res.status(400).json({ error: 'Name, email, password, dob, and sex are required.' });
    return;
  }

  const userRole = role === 'clinician' ? 'clinician' : 'patient';

  try {
    // Check if user exists
    const userExists = await pool.query('SELECT 1 FROM patients WHERE email = $1', [email]);
    if (userExists.rowCount && userExists.rowCount > 0) {
      res.status(400).json({ error: 'A user with this email already exists.' });
      return;
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Save user
    const result = await pool.query(
      `INSERT INTO patients (name, email, password_hash, dob, sex, insurance_provider, insurance_policy)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, name, email`,
      [name, email, passwordHash, dob, sex, insuranceProvider || null, insurancePolicy || null]
    );

    const newUser = result.rows[0];

    // Log audit action
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [newUser.id, 'user_register', JSON.stringify({ role: userRole })]
    );

    // Generate JWT
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, role: userRole },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      token,
      user: {
        id: newUser.id,
        name: newUser.name,
        email: newUser.email,
        role: userRole,
      },
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed. Please try again.' });
  }
});

// Login
router.post('/login', async (req: any, res: Response) => {
  const { email, password, role } = req.body;

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required.' });
    return;
  }

  const requestedRole = role === 'clinician' ? 'clinician' : 'patient';

  try {
    const result = await pool.query(
      'SELECT id, name, email, password_hash FROM patients WHERE email = $1',
      [email]
    );

    if (result.rowCount === 0) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    const user = result.rows[0];

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      res.status(401).json({ error: 'Invalid email or password.' });
      return;
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user.id, email: user.email, role: requestedRole },
      config.jwtSecret,
      { expiresIn: '24h' }
    );

    // Log audit
    await pool.query(
      `INSERT INTO audit_logs (user_id, action, details)
       VALUES ($1, $2, $3)`,
      [user.id, 'user_login', JSON.stringify({ role: requestedRole })]
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: requestedRole,
      },
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed. Please try again.' });
  }
});

// Get current user details
router.get('/me', authenticateToken as any, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const result = await pool.query(
      'SELECT id, name, email, dob, sex, insurance_provider as "insuranceProvider", insurance_policy as "insurancePolicy" FROM patients WHERE id = $1',
      [req.user.id]
    );

    if (result.rowCount === 0) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    res.json({
      ...result.rows[0],
      role: req.user.role,
    });
  } catch (err) {
    console.error('Get user error:', err);
    res.status(500).json({ error: 'Failed to retrieve user info.' });
  }
});

export default router;
