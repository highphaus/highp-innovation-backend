const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

router.get('/:slug', async (req, res) => {
  try {
    const slug = req.params.slug.toLowerCase().trim();
    const products = await Product.find({
      $or: [
        { storeSlug: slug },
        { storeSlug: new RegExp(`^${slug}$`, 'i') },
        { storeSlug: 'taste-n-park' }
      ]
    });
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

// Admin Update Inventory
router.put('/:id', async (req, res) => {
  try {
    const existingProduct = await Product.findById(req.params.id);
    if (!existingProduct) return res.status(404).json({ message: "Product not found" });

    const updateData = { ...req.body };
    delete updateData._id;
    delete updateData.__v;
    delete updateData.createdAt;
    delete updateData.updatedAt;
    updateData.storeSlug = existingProduct.storeSlug;

    const updated = await Product.findByIdAndUpdate(req.params.id, updateData, { new: true, runValidators: true });
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Toggle Stock Status (In Stock vs Out of Stock)
router.patch('/:id/toggle-stock', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: "Product not found" });

    const newInStock = req.body.inStock !== undefined ? Boolean(req.body.inStock) : (product.inStock === false || product.isOutOfStock === true ? true : false);
    product.inStock = newInStock;
    product.isOutOfStock = !newInStock;
    await product.save();

    res.json(product);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;