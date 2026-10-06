const express = require('express');
const router = express.Router();
const Page = require('../models/Page');
const { requireAuth } = require('../middleware/auth');

// GET a page by slug (public access)
router.get('/:slug', async (req, res) => {
  try {
    const page = await Page.findOne({ slug: req.params.slug });
    if (!page) {
      // Return a blank template if not customized yet
      return res.json({ 
        slug: req.params.slug, 
        title: req.params.slug.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()), 
        content: 'Content coming soon...' 
      });
    }
    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET all pages (admin only)
router.get('/', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Denied' });
  try {
    const pages = await Page.find().sort({ createdAt: -1 });
    res.json(pages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// PUT update/create page (admin only)
router.put('/:slug', requireAuth, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ message: 'Denied' });
  try {
    const { title, content } = req.body;
    let page = await Page.findOne({ slug: req.params.slug });
    if (!page) {
      page = new Page({ slug: req.params.slug, title, content });
    } else {
      page.title = title;
      page.content = content;
    }
    await page.save();
    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
