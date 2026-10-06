const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { OAuth2Client } = require('google-auth-library');

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID || '865703162705-abofmbgpggv7h8jmepjnpa0ee3qk3885.apps.googleusercontent.com');

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// @route POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        // Check existing user
        const existingUser = await User.findOne({ $or: [{ email }, { username }] });
        if (existingUser) {
            return res.status(400).json({ message: 'User with this email or username already exists' });
        }

        // Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        // Create user
        const newUser = new User({
            username,
            email,
            password: hashedPassword
        });

        await newUser.save();

        // Sign token
        const token = jwt.sign({ id: newUser._id, role: newUser.role }, JWT_SECRET, { expiresIn: '1d' });

        res.status(201).json({
            token,
            user: {
                id: newUser._id,
                username: newUser.username,
                email: newUser.email,
                profileImage: newUser.profileImage,
                balance: newUser.balance,
                role: newUser.role
            }
        });
    } catch (error) {
        console.error("Registration Error", error);
        res.status(500).json({ message: 'Server error during registration' });
    }
});

// @route POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid email or password' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid email or password' });

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                balance: user.balance,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Login Error", error);
        res.status(500).json({ message: 'Server error during login' });
    }
});

// @route GET /api/auth/me
// Verify token and get user info
router.get('/me', async (req, res) => {
    try {
        const token = req.header('Authorization')?.split(' ')[1];
        if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

        const decoded = jwt.verify(token, JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');
        
        if (!user) return res.status(404).json({ message: 'User not found' });

        res.json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                balance: user.balance,
                role: user.role
            }
        });
    } catch (error) {
        res.status(401).json({ message: 'Token is not valid' });
    }
});

// @route POST /api/auth/google
router.post('/google', async (req, res) => {
    try {
        const { credential } = req.body;
        const ticket = await googleClient.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID || '865703162705-abofmbgpggv7h8jmepjnpa0ee3qk3885.apps.googleusercontent.com'
        });
        const payload = ticket.getPayload();
        const { email, name, picture } = payload;
        
        let user = await User.findOne({ email });
        
        if (!user) {
            const randomPassword = Math.random().toString(36).slice(-10) + Math.random().toString(36).slice(-10);
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash(randomPassword, salt);
            
            user = new User({
                username: name.replace(/\s+/g, '_').toLowerCase() + Math.floor(Math.random() * 1000),
                email,
                password: hashedPassword,
                profileImage: picture
            });
            await user.save();
        }

        const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: '1d' });
        
        res.status(200).json({
            token,
            user: {
                id: user._id,
                username: user.username,
                email: user.email,
                profileImage: user.profileImage,
                balance: user.balance,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Google login error:", error);
        res.status(400).json({ message: "Google login failed: " + (error.message || "Unknown error") });
    }
});

module.exports = router;
