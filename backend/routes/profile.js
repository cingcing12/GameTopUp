const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// Setup Cloudinary (Replace with real keys in .env!)
// CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || 'demo', 
  api_key: process.env.CLOUDINARY_API_KEY || '12345',
  api_secret: process.env.CLOUDINARY_API_SECRET || 'secret'
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gametopup_profiles',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
  },
});

const upload = multer({ storage: storage });

// Middleware to verify token
const authMiddleware = (req, res, next) => {
    const token = req.header('Authorization')?.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'No token, authorization denied' });

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        res.status(401).json({ message: 'Token is not valid' });
    }
};

// @route PUT /api/profile
// Update profile info (username, email)
router.put('/', authMiddleware, async (req, res) => {
    try {
        const { username, email } = req.body;
        const user = await User.findById(req.user.id);
        
        if (!user) return res.status(404).json({ message: 'User not found' });

        if (username) user.username = username;
        if (email) user.email = email;

        await user.save();
        
        res.json({
            id: user._id,
            username: user.username,
            email: user.email,
            profileImage: user.profileImage,
            balance: user.balance
        });
    } catch (error) {
        console.error("Profile Update Error", error);
        res.status(500).json({ message: 'Server error updating profile' });
    }
});

// @route POST /api/profile/upload
// Upload profile image to Cloudinary
router.post('/upload', authMiddleware, upload.single('profileImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No image uploaded' });
        }

        const user = await User.findById(req.user.id);
        if (!user) return res.status(404).json({ message: 'User not found' });

        // req.file.path contains the secure cloudinary url
        user.profileImage = req.file.path;
        await user.save();

        res.json({
            message: 'Image uploaded successfully',
            profileImage: user.profileImage
        });
    } catch (error) {
        console.error("Image Upload Error", error);
        res.status(500).json({ message: 'Server error uploading image' });
    }
});

module.exports = router;
