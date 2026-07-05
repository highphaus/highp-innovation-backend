const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

// Fetch items for consumer window storefronts
router.get('/:slug', async (req, res) => {
  try {
    const products = await Product.find({ storeSlug: req.params.slug.toLowerCase() });
    res.json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Add Inventory
router.post('/', async (req, res) => {
  try {
    const { storeSlug, name, price, description, image } = req.body;
    const newProduct = await Product.create({
      storeSlug: storeSlug.toLowerCase().trim(),
      name,
      price,
      description,
      image
    });
    res.status(201).json(newProduct);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Remove Inventory
router.delete('/:id', async (req, res) => {
  try {
    const deleted = await Product.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Item not found" });
    res.json({ message: "Product successfully cleared from cluster" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;