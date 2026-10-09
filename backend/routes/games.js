const express = require('express');
const router = express.Router();
const Game = require('../models/Game');
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const { sendEvent } = require('../sse');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'gametopup',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  }
});
const upload = multer({ storage: storage });

// Get all games
router.get('/', async (req, res) => {
  try {
    const games = await Game.find();
    res.json(games);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get single game by ID
router.get('/:id', async (req, res) => {
  try {
    const game = await Game.findById(req.params.id);
    if (!game) return res.status(404).json({ message: 'Game not found' });
    res.json(game);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new game
router.post('/', async (req, res) => {
  try {
    const newGame = new Game(req.body);
    const savedGame = await newGame.save();
    sendEvent('game_created', savedGame);
    res.status(201).json(savedGame);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Seed some initial games if empty (for testing)
router.post('/seed', async (req, res) => {
  try {
    const count = await Game.countDocuments();
    if (count > 0) return res.json({ message: 'Games already exist' });

    const games = [
      {
        name: 'Mobile Legends',
        publisher: 'Moonton',
        image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?auto=format&fit=crop&q=80&w=600&h=800',
        denominations: [
          { amount: 50, price: 0.99, currencyName: 'Diamonds' },
          { amount: 250, price: 4.99, currencyName: 'Diamonds' },
          { amount: 500, price: 9.99, currencyName: 'Diamonds' }
        ]
      },
      {
        name: 'PUBG Mobile',
        publisher: 'Tencent',
        image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&q=80&w=600&h=800',
        denominations: [
          { amount: 60, price: 0.99, currencyName: 'UC' },
          { amount: 300, price: 4.99, currencyName: 'UC' },
          { amount: 600, price: 9.99, currencyName: 'UC' }
        ]
      }
    ];

    await Game.insertMany(games);
    res.status(201).json({ message: 'Games seeded successfully!' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a game (and optionally upload new image/banner)
router.put('/:id', upload.fields([{ name: 'image', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), async (req, res) => {
  try {
    const { id } = req.params;
    let updateData = { ...req.body };
    
    if (req.files) {
      if (req.files.image && req.files.image[0]) {
        updateData.image = req.files.image[0].path; // Cloudinary URL
      }
      if (req.files.banner && req.files.banner[0]) {
        updateData.banner = req.files.banner[0].path; // Cloudinary URL
      }
    }
    
    // Parse denominations if it's sent as a string (from FormData)
    if (updateData.denominations && typeof updateData.denominations === 'string') {
      try {
        updateData.denominations = JSON.parse(updateData.denominations);
      } catch(e) {
        // ignore
      }
    }

    const updatedGame = await Game.findByIdAndUpdate(id, updateData, { returnDocument: 'after' });
    
    // Notify all connected clients about the update
    sendEvent('game_updated', updatedGame);
    
    res.json(updatedGame);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update custom prices
router.put('/:id/prices', async (req, res) => {
  try {
    const { id } = req.params;
    const { customPrices } = req.body;
    
    const updatedGame = await Game.findByIdAndUpdate(
      id, 
      { $set: { customPrices } }, 
      { returnDocument: 'after' }
    );
    
    sendEvent('prices_updated', updatedGame);
    res.json(updatedGame);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});
// Upload custom image for a specific package
router.post('/:id/packages/:variationId/image', upload.single('image'), async (req, res) => {
  try {
    const { id, variationId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ message: 'No image uploaded' });
    }

    const game = await Game.findById(id);
    if (!game) return res.status(404).json({ message: 'Game not found' });

    // Initialize customImages map if it doesn't exist
    if (!game.customImages) {
      game.customImages = new Map();
    }
    
    // Set the Cloudinary URL for this specific variation
    game.customImages.set(variationId, req.file.path);
    await game.save();

    sendEvent('game_updated', game);
    res.json(game);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
