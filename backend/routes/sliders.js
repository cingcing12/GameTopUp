const express = require('express');
const router = express.Router();
const Slider = require('../models/Slider');
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
    folder: 'gametopup_sliders',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp']
  }
});

const upload = multer({ storage: storage });

// Get all sliders
router.get('/', async (req, res) => {
  try {
    const sliders = await Slider.find().sort({ order: 1 });
    res.json(sliders);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Create a new slider
router.post('/', upload.single('image'), async (req, res) => {
  try {
    const newSlider = new Slider({
      title: req.body.title,
      subtitle: req.body.subtitle,
      link: req.body.link,
      order: req.body.order || 0,
      isActive: req.body.isActive !== undefined ? req.body.isActive === 'true' || req.body.isActive === true : true,
      image: req.file ? req.file.path : ''
    });

    const savedSlider = await newSlider.save();
    sendEvent('slider_updated', { type: 'created', data: savedSlider });
    res.status(201).json(savedSlider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update a slider
router.put('/:id', upload.single('image'), async (req, res) => {
  try {
    const updateData = { ...req.body };
    if (updateData.isActive !== undefined) {
      updateData.isActive = updateData.isActive === 'true' || updateData.isActive === true;
    }
    if (req.file) {
      updateData.image = req.file.path;
    }

    const updatedSlider = await Slider.findByIdAndUpdate(req.params.id, updateData, { returnDocument: 'after' });
    sendEvent('slider_updated', { type: 'updated', data: updatedSlider });
    res.json(updatedSlider);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a slider
router.delete('/:id', async (req, res) => {
  try {
    await Slider.findByIdAndDelete(req.params.id);
    sendEvent('slider_updated', { type: 'deleted', id: req.params.id });
    res.json({ message: 'Slider deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
