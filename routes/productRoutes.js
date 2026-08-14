const express = require('express');
const router = express.Router();
const Product = require('../models/Product');

router.get('/:slug', async (req, res) => {
  try {
    const rawSlug = (req.params.slug || "").toLowerCase().trim();
    const cleanSlug = rawSlug.replace(/[^a-z0-9]/g, "");

    // 1. Search for products matching raw slug or clean slug
    let products = await Product.find({
      $or: [
        { storeSlug: rawSlug },
        { storeSlug: cleanSlug },
        { storeSlug: new RegExp(`^${rawSlug}$`, 'i') },
        { storeSlug: new RegExp(`^${cleanSlug}$`, 'i') }
      ]
    }).lean();

    // 2. Fallback to default catalog products if 0 products found for custom store slug
    if (!products || products.length === 0) {
      products = await Product.find({
        $or: [
          { storeSlug: "tastenpark" },
          { storeSlug: "taste-n-park" },
          { storeSlug: "teststore" }
        ]
      }).lean();
    }

    res.json(products || []);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin Add Inventory
router.post('/', async (req, res) => {
  try {
    const { storeSlug } = req.body;
    if (!storeSlug) return res.status(400).json({ error: "Missing storeSlug parameter." });
    
    const defaultImg = "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80";
    const newProduct = await Product.create({
      ...req.body,
      image: (req.body.image && req.body.image.trim().length > 0) ? req.body.image.trim() : defaultImg,
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