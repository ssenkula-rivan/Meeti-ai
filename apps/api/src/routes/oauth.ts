import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import axios from 'axios';
import {
  Database,
  Queryable,
  UserRepository,
  IUserIdentityRepository,
  IUserProfileRepository,
} from '@meeti/database';
import { config } from '../config';
import { AppError } from '../middleware/error-handler';
import { authenticate, AuthRequest } from '../middleware/auth';
import jwt from 'jsonwebtoken';
import { encryptSecret } from '../lib/crypto';

const router = Router();
const db: Queryable = new Database(config.database);
const userRepo: IUserIdentityRepository & Pick<IUserProfileRepository, 'createProfile'> =
  new UserRepository(db);

// Google OAuth configuration
const googleClient = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// Google OAuth - Get authorization URL
router.get('/google/url', (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    throw new AppError(500, 'Google OAuth not configured');
  }

  const state = Math.random().toString(36).substring(2, 15);
  const requestedScopes = req.query.scopes as string || 'basic';
  
  let scopes = [
    'https://www.googleapis.com/auth/userinfo.email',
    'https://www.googleapis.com/auth/userinfo.profile',
  ];
  
  if (requestedScopes === 'full' || requestedScopes === 'drive') {
    scopes.push('https://www.googleapis.com/auth/drive.file');
  }
  if (requestedScopes === 'full' || requestedScopes === 'gmail') {
    scopes.push('https://www.googleapis.com/auth/gmail.send');
  }
  if (requestedScopes === 'full' || requestedScopes === 'calendar') {
    scopes.push('https://www.googleapis.com/auth/calendar.events');
  }
  
  const authUrl = googleClient.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    state,
  });

  res.json({ authUrl, state });
});

// Google OAuth - Handle callback
router.post('/google/callback', async (req, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      throw new AppError(400, 'Authorization code is required');
    }

    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      throw new AppError(500, 'Google OAuth not configured');
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info from Google
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const googleUser = userInfoResponse.data;
    const email = googleUser.email;
    const googleId = googleUser.id;

    // Check if user exists with this Google account
    const existingOAuth = await db.queryOne(
      'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2',
      ['google', googleId]
    );

    // Encrypt OAuth tokens at rest before persisting (never store raw credentials).
    tokens.access_token = encryptSecret(tokens.access_token) as string;
    if (tokens.refresh_token) tokens.refresh_token = encryptSecret(tokens.refresh_token) as string;

    let user;
    let isNewUser = false;

    if (existingOAuth) {
      // User already exists, log them in
      user = await userRepo.findById(existingOAuth.user_id);
      if (!user) {
        throw new AppError(404, 'User not found');
      }

      // Update OAuth tokens
      await db.query(
        `UPDATE oauth_accounts 
         SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
         WHERE id = $4`,
        [tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null, existingOAuth.id]
      );
    } else {
      // Check if user exists with this email
      const existingUser = await userRepo.findByEmail(email);
      
      if (existingUser) {
        // Link Google account to existing user
        user = existingUser;
        await db.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, access_token, refresh_token, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, 'google', googleId, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
        );
      } else {
        // Create new user
        user = await userRepo.create(email);
        isNewUser = true;

        // Create profile
        await userRepo.createProfile(user.id, {
          full_name: googleUser.name,
          user_id: user.id,
          preferred_language: 'en',
          output_language: 'en',
          date_format: 'YYYY-MM-DD',
          time_format: '24h',
        });

        // Create OAuth account
        await db.query(
          `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, access_token, refresh_token, expires_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [user.id, 'google', googleId, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
        );

        // Mark email as verified
        await db.query('UPDATE users SET email_verified = true WHERE id = $1', [user.id]);
      }
    }

    await userRepo.updateLastActive(user.id);

    const token = jwt.sign({ userId: user.id }, config.jwt.secret, { expiresIn: '7d' });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        emailVerified: user.email_verified,
      },
      token,
      isNewUser,
    });
  } catch (error) {
    console.error('Google OAuth error:', error);
    next(error);
  }
});

// Connect Google account to existing user
router.post('/google/connect', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const { code } = req.body;

    if (!code) {
      throw new AppError(400, 'Authorization code is required');
    }

    // Exchange code for tokens
    const { tokens } = await googleClient.getToken(code);
    googleClient.setCredentials(tokens);

    // Get user info from Google
    const userInfoResponse = await axios.get(
      'https://www.googleapis.com/oauth2/v2/userinfo',
      {
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );

    const googleUser = userInfoResponse.data;
    const googleId = googleUser.id;

    // Check if this Google account is already linked to another user
    const existingOAuth = await db.queryOne(
      'SELECT * FROM oauth_accounts WHERE provider = $1 AND provider_user_id = $2',
      ['google', googleId]
    );

    if (existingOAuth && existingOAuth.user_id !== req.userId) {
      throw new AppError(400, 'This Google account is already linked to another user');
    }

    // Encrypt OAuth tokens at rest before persisting (never store raw credentials).
    tokens.access_token = encryptSecret(tokens.access_token) as string;
    if (tokens.refresh_token) tokens.refresh_token = encryptSecret(tokens.refresh_token) as string;

    if (existingOAuth) {
      // Update existing OAuth account
      await db.query(
        `UPDATE oauth_accounts 
         SET access_token = $1, refresh_token = $2, expires_at = $3, updated_at = NOW()
         WHERE id = $4`,
        [tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null, existingOAuth.id]
      );
    } else {
      // Create new OAuth account
      await db.query(
        `INSERT INTO oauth_accounts (user_id, provider, provider_user_id, access_token, refresh_token, expires_at)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [req.userId, 'google', googleId, tokens.access_token, tokens.refresh_token, tokens.expiry_date ? new Date(tokens.expiry_date) : null]
      );
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Google connect error:', error);
    next(error);
  }
});

// Disconnect Google account
router.delete('/google', authenticate, async (req: AuthRequest, res, next) => {
  try {
    await db.query(
      'DELETE FROM oauth_accounts WHERE user_id = $1 AND provider = $2',
      [req.userId, 'google']
    );

    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

// Get connected OAuth accounts
router.get('/accounts', authenticate, async (req: AuthRequest, res, next) => {
  try {
    const accounts = await db.query(
      'SELECT provider, provider_user_id, created_at FROM oauth_accounts WHERE user_id = $1',
      [req.userId]
    );

    res.json({ accounts });
  } catch (error) {
    next(error);
  }
});

export { router as oauthRouter };