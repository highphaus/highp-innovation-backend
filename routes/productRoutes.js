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
    const { storeSlug } = req.body;
    if (!storeSlug) return res.status(400).json({ error: "Missing storeSlug parameter." });
    
    const newProduct = await Product.create({
      ...req.body,
      storeSlug: storeSlug.toLowerCase().trim()
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

// Admin Update Inventory (e.g. Price, Name)
router.put('/:id', async (req, res) => {
  try {
    const { name, price, description, image } = req.body;
    const updated = await Product.findByIdAndUpdate(
      req.params.id,
      { name, price, description, image },
      { new: true }
    );
    if (!updated) return res.status(404).json({ message: "Product not found" });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;