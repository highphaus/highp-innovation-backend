const { google } = require('googleapis');
const Store = require('../models/Store');
const Product = require('../models/Product');

// OAuth Helper client
function getOAuthClient(store) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || "http://localhost:5000/api/gsheets/callback";

  if (!clientId || !clientSecret) return null;

  const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2Client.setCredentials({
    access_token: store.googleAccessToken,
    refresh_token: store.googleRefreshToken,
    expiry_date: store.googleTokenExpiry ? store.googleTokenExpiry.getTime() : null
  });

  return oauth2Client;
}

// Ensure access token is fresh
async function refreshAuthIfNeeded(store) {
  const oauth2Client = getOAuthClient(store);
  if (!oauth2Client) return store; // Demo mode fallback

  const expiry = store.googleTokenExpiry ? new Date(store.googleTokenExpiry) : null;
  const buffer = 5 * 60 * 1000; // 5 mins buffer

  if (expiry && (expiry.getTime() - Date.now() < buffer)) {
    try {
      const { credentials } = await oauth2Client.refreshAccessToken();
      store.googleAccessToken = credentials.access_token;
      if (credentials.refresh_token) {
        store.googleRefreshToken = credentials.refresh_token;
      }
      if (credentials.expiry_date) {
        store.googleTokenExpiry = new Date(credentials.expiry_date);
      }
      await store.save();
    } catch (err) {
      console.error("Token refresh failed:", err);
      throw new Error("Authentication Refresh Expired or Rejected. Please reconnect Google Sheets.");
    }
  }
  return store;
}

// ──────────────────────────────────────────────────────────────────────────
// SYNC NOW PIPELINE
// ──────────────────────────────────────────────────────────────────────────
async function syncStoreSheets(storeSlug) {
  const store = await Store.findOne({ slug: storeSlug.toLowerCase().trim() });
  if (!store) throw new Error("Store identity not found.");
  if (!store.googleSheetId) throw new Error("No Google Spreadsheet ID linked to this account.");

  // Mark state as syncing
  store.googleSheetSyncStatus = "syncing";
  await store.save();

  let oauth2Client = null;
  let isDemoMode = true;

  try {
    const freshStore = await refreshAuthIfNeeded(store);
    oauth2Client = getOAuthClient(freshStore);
    if (oauth2Client && freshStore.googleAccessToken) {
      isDemoMode = false;
    }
  } catch (err) {
    store.googleSheetSyncStatus = "failed";
    store.googleSheetSyncMetrics = {
      imported: 0,
      updated: 0,
      errorsCount: 1,
      errorsList: [{ row: "AUTH", error: err.message }]
    };
    await store.save();
    throw err;
  }

  let productsRaw = [];
  let categoriesRaw = [];
  let unitsRaw = [];

  if (isDemoMode) {
    // 🛝 DEMO MODE SANDBOX FALLBACK MOCK DATA
    // We parse simulated sheet data matching the user's columns
    console.log("Demo Connection Mode: Simulating Google Sheets retrieval.");
    productsRaw = [
      ["Product ID", "Name", "Description", "Category", "Brand", "SKU", "Variant Label", "Unit", "Price", "Offer Price", "Stock", "Image URL", "Status", "Featured", "Tags"],
      ["P001", "Basmati Rice", "Premium long grain rice", "Grocery", "Daawat", "SKU-RICE-1", "1 kg", "kg", "120", "110", "50", "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600", "active", "TRUE", "staples,rice"],
      ["", "", "", "", "", "SKU-RICE-5", "5 kg", "kg", "580", "540", "20", "", "", "", ""],
      ["", "", "", "", "", "SKU-RICE-10", "10 kg", "kg", "1150", "1050", "15", "", "", "", ""],
      ["P002", "Fresh Bananas", "Yellow ripe organic bananas", "Fruits", "Organic", "SKU-BAN-12", "1 Dozen", "pcs", "60", "55", "30", "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600", "active", "FALSE", "fruits,healthy"],
      ["P003", "Whole Milk", "Pure pasteurized milk", "Beverages", "Amul", "SKU-MILK-1", "1 Liter", "L", "66", "64", "40", "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600", "active", "TRUE", "dairy,milk"],
      ["", "", "", "", "", "SKU-MILK-500", "500 ml", "ml", "34", "33", "80", "", "", "", ""]
    ];
    categoriesRaw = [
      ["Category"],
      ["Grocery"],
      ["Fruits"],
      ["Beverages"],
      ["Snacks"]
    ];
    unitsRaw = [
      ["Unit"],
      ["kg"],
      ["g"],
      ["L"],
      ["ml"],
      ["pcs"],
      ["pack"]
    ];
  } else {
    // 🟢 REAL GOOGLE SHEETS API CHANNEL
    try {
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });
      
      // Batch fetch ranges to minimize API payloads
      const response = await sheets.spreadsheets.values.batchGet({
        spreadsheetId: store.googleSheetId,
        ranges: ["Products!A1:O2000", "Categories!A1:A500", "Units!A1:A500"]
      });

      const valueRanges = response.data.valueRanges || [];
      
      const prodRange = valueRanges.find(r => r.range.startsWith("Products"));
      const catRange = valueRanges.find(r => r.range.startsWith("Categories"));
      const unitRange = valueRanges.find(r => r.range.startsWith("Units"));

      productsRaw = prodRange ? prodRange.values : [];
      categoriesRaw = catRange ? catRange.values : [];
      unitsRaw = unitRange ? unitRange.values : [];

      if (!productsRaw || productsRaw.length === 0) {
        throw new Error("Products sheet is empty or does not exist.");
      }
    } catch (err) {
      store.googleSheetSyncStatus = "failed";
      store.googleSheetSyncMetrics = {
        imported: 0,
        updated: 0,
        errorsCount: 1,
        errorsList: [{ row: "API", error: `Google Sheets API Request failed: ${err.message}` }]
      };
      await store.save();
      throw err;
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // PARSING & VALIDATION ENGINE
  // ──────────────────────────────────────────────────────────────────────────
  const syncErrors = [];
  const validCategories = new Set(categoriesRaw.slice(1).map(row => row[0]?.toString().trim().toLowerCase()).filter(Boolean));
  const validUnits = new Set(unitsRaw.slice(1).map(row => row[0]?.toString().trim().toLowerCase()).filter(Boolean));

  // Default dropdown validation seeds if the list sheets are empty
  if (validCategories.size === 0) {
    ["grocery", "fruits", "beverages", "snacks", "vegetables"].forEach(c => validCategories.add(c));
  }
  if (validUnits.size === 0) {
    ["kg", "g", "l", "ml", "pcs", "pack"].forEach(u => validUnits.add(u));
  }

  const productsToImport = [];
  let currentProduct = null;
  const uniqueSKUs = new Set();
  const uniqueProductIds = new Set();

  for (let idx = 1; idx < productsRaw.length; idx++) {
    const row = productsRaw[idx];
    const rowNumber = idx + 1;

    // Skip empty rows
    if (!row || row.length === 0 || row.every(val => !val?.toString().trim())) continue;

    const productIdVal = row[0]?.toString().trim();
    const nameVal = row[1]?.toString().trim();
    const descriptionVal = row[2]?.toString().trim();
    const categoryVal = row[3]?.toString().trim();
    const brandVal = row[4]?.toString().trim();
    const skuVal = row[5]?.toString().trim();
    const variantLabelVal = row[6]?.toString().trim();
    const unitVal = row[7]?.toString().trim();
    const priceVal = parseFloat(row[8]?.toString().trim());
    const offerPriceVal = parseFloat(row[9]?.toString().trim() || "0");
    const stockVal = parseInt(row[10]?.toString().trim() || "0", 10);
    const imageUrlVal = row[11]?.toString().trim();
    const statusVal = row[12]?.toString().trim().toLowerCase() || "active";
    const featuredVal = row[13]?.toString().trim().toLowerCase() === "true";
    const tagsVal = row[14]?.toString().trim();

    // Determine if this is a main product or a variant row
    const isMainProduct = !!nameVal;

    if (isMainProduct) {
      // Validate Product ID
      if (!productIdVal) {
        syncErrors.push({ row: rowNumber, error: "Missing required Product ID." });
        currentProduct = null;
        continue;
      }
      if (uniqueProductIds.has(productIdVal)) {
        syncErrors.push({ row: rowNumber, error: `Duplicate Product ID: "${productIdVal}" already used.` });
        currentProduct = null;
        continue;
      }
      uniqueProductIds.add(productIdVal);

      // Validate Price
      if (isNaN(priceVal) || priceVal < 0) {
        syncErrors.push({ row: rowNumber, error: `Invalid price amount: "${row[8]}".` });
        currentProduct = null;
        continue;
      }

      // Validate dropdown categories
      if (categoryVal && !validCategories.has(categoryVal.toLowerCase())) {
        syncErrors.push({ row: rowNumber, error: `Invalid category: "${categoryVal}". Mapped value must reside inside Categories worksheet.` });
        currentProduct = null;
        continue;
      }

      // Validate dropdown units
      if (unitVal && !validUnits.has(unitVal.toLowerCase())) {
        syncErrors.push({ row: rowNumber, error: `Invalid unit tag: "${unitVal}". Value must reside inside Units worksheet.` });
        currentProduct = null;
        continue;
      }

      // Validate duplicate SKU
      if (skuVal) {
        if (uniqueSKUs.has(skuVal)) {
          syncErrors.push({ row: rowNumber, error: `Duplicate SKU: "${skuVal}" already parsed.` });
          currentProduct = null;
          continue;
        }
        uniqueSKUs.add(skuVal);
      }

      // Parse tags
      const parsedTags = tagsVal ? tagsVal.split(",").map(t => t.trim().toLowerCase()).filter(Boolean) : [];

      // Download/Validate Image Url list (comma separated)
      const images = imageUrlVal ? imageUrlVal.split(",").map(url => url.trim()).filter(Boolean) : [];
      const mainImage = images[0] || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80";

      currentProduct = {
        storeSlug: storeSlug.toLowerCase().trim(),
        productId: productIdVal,
        name: nameVal,
        description: descriptionVal || "",
        category: categoryVal || "Grocery",
        brand: brandVal || "",
        sku: skuVal || "",
        unit: unitVal || "pcs",
        price: priceVal,
        offerPrice: isNaN(offerPriceVal) ? 0 : offerPriceVal,
        stock: isNaN(stockVal) ? 0 : stockVal,
        image: mainImage,
        status: statusVal === "inactive" ? "inactive" : "active",
        featured: featuredVal,
        tags: parsedTags,
        variants: []
      };

      productsToImport.push(currentProduct);
    } else {
      // This is a variant row.
      if (!currentProduct) {
        syncErrors.push({ row: rowNumber, error: "Orphan variant row. Variants must be placed immediately below a parent product." });
        continue;
      }

      // Validate variant price
      if (isNaN(priceVal) || priceVal < 0) {
        syncErrors.push({ row: rowNumber, error: `Invalid variant price: "${row[8]}".` });
        continue;
      }

      // Validate variant unit dropdown
      if (unitVal && !validUnits.has(unitVal.toLowerCase())) {
        syncErrors.push({ row: rowNumber, error: `Invalid variant unit: "${unitVal}".` });
        continue;
      }

      // Validate duplicate variant SKU
      if (skuVal) {
        if (uniqueSKUs.has(skuVal)) {
          syncErrors.push({ row: rowNumber, error: `Duplicate variant SKU: "${skuVal}" already parsed.` });
          continue;
        }
        uniqueSKUs.add(skuVal);
      }

      currentProduct.variants.push({
        variantLabel: variantLabelVal || "Default",
        unit: unitVal || "pcs",
        price: priceVal,
        offerPrice: isNaN(offerPriceVal) ? 0 : offerPriceVal,
        stock: isNaN(stockVal) ? 0 : stockVal,
        sku: skuVal || ""
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // BATCH DATABASE SYNCHRONIZER
  // ──────────────────────────────────────────────────────────────────────────
  let importedCount = 0;
  let updatedCount = 0;

  const incomingProductIds = productsToImport.map(p => p.productId);

  // Mark stale products not present in sheets as inactive (soft delete) or remove them
  if (productsToImport.length > 0) {
    await Product.deleteMany({
      storeSlug: storeSlug.toLowerCase().trim(),
      productId: { $nin: incomingProductIds, $ne: "" }
    });
  }

  for (const newProd of productsToImport) {
    const existing = await Product.findOne({
      storeSlug: storeSlug.toLowerCase().trim(),
      productId: newProd.productId
    });

    if (existing) {
      // Compare values to verify if update is needed
      const hasChanged = 
        existing.name !== newProd.name ||
        existing.price !== newProd.price ||
        existing.description !== newProd.description ||
        existing.image !== newProd.image ||
        existing.sku !== newProd.sku ||
        existing.category !== newProd.category ||
        existing.variants.length !== newProd.variants.length;

      if (hasChanged) {
        Object.assign(existing, newProd);
        await existing.save();
        updatedCount++;
      }
    } else {
      await Product.create(newProd);
      importedCount++;
    }
  }

  // Update store log metrics
  store.googleSheetLastSync = new Date();
  store.googleSheetSyncStatus = syncErrors.length > 0 ? "failed" : "success";
  store.googleSheetSyncMetrics = {
    imported: importedCount,
    updated: updatedCount,
    errorsCount: syncErrors.length,
    errorsList: syncErrors
  };
  await store.save();

  return {
    imported: importedCount,
    updated: updatedCount,
    errorsCount: syncErrors.length,
    errorsList: syncErrors
  };
}

// ──────────────────────────────────────────────────────────────────────────
// RESET GOOGLE SHEET WORKSPACES
// ──────────────────────────────────────────────────────────────────────────
async function resetStoreSheets(storeSlug) {
  const store = await Store.findOne({ slug: storeSlug.toLowerCase().trim() });
  if (!store) throw new Error("Store identity not found.");
  if (!store.googleSheetId) throw new Error("No Google Spreadsheet ID linked to this account.");

  let oauth2Client = null;
  let isDemoMode = true;

  try {
    const freshStore = await refreshAuthIfNeeded(store);
    oauth2Client = getOAuthClient(freshStore);
    if (oauth2Client && freshStore.googleAccessToken) {
      isDemoMode = false;
    }
  } catch (err) {
    throw err;
  }

  // Sample data to seed
  const productsHeaders = ["Product ID", "Name", "Description", "Category", "Brand", "SKU", "Variant Label", "Unit", "Price", "Offer Price", "Stock", "Image URL", "Status", "Featured", "Tags"];
  const productsSample = [
    ["P001", "Basmati Rice", "Premium long grain rice", "Grocery", "Daawat", "SKU-RICE-1", "1 kg", "kg", "120", "110", "50", "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=600", "active", "TRUE", "staples,rice"],
    ["", "", "", "", "", "SKU-RICE-5", "5 kg", "kg", "580", "540", "20", "", "", "", ""],
    ["", "", "", "", "", "SKU-RICE-10", "10 kg", "kg", "1150", "1050", "15", "", "", "", ""],
    ["P002", "Fresh Bananas", "Yellow ripe organic bananas", "Fruits", "Organic", "SKU-BAN-12", "1 Dozen", "pcs", "60", "55", "30", "https://images.unsplash.com/photo-1571771894821-ce9b6c11b08e?w=600", "active", "FALSE", "fruits,healthy"],
    ["P003", "Whole Milk", "Pure pasteurized milk", "Beverages", "Amul", "SKU-MILK-1", "1 Liter", "L", "66", "64", "40", "https://images.unsplash.com/photo-1563636619-e9143da7973b?w=600", "active", "TRUE", "dairy,milk"],
    ["", "", "", "", "", "SKU-MILK-500", "500 ml", "ml", "34", "33", "80", "", "", "", ""]
  ];

  const categoriesData = [["Category"], ["Grocery"], ["Fruits"], ["Beverages"], ["Snacks"], ["Vegetables"]];
  const unitsData = [["Unit"], ["kg"], ["g"], ["L"], ["ml"], ["pcs"], ["pack"]];

  if (isDemoMode) {
    console.log("Demo Connection Mode: Simulated spreadsheet layout reset.");
    // Clear demo/empty entries and reset catalog
    await Product.deleteMany({ storeSlug: storeSlug.toLowerCase().trim() });
    
    // Seed initial products to Mongoose directly for local testing
    for (const row of productsSample) {
      if (row[1]) {
        // Main Product
        const images = row[11] ? row[11].split(",") : [];
        await Product.create({
          storeSlug: storeSlug.toLowerCase().trim(),
          productId: row[0],
          name: row[1],
          description: row[2],
          category: row[3],
          brand: row[4],
          sku: row[5],
          unit: row[7],
          price: parseFloat(row[8]),
          offerPrice: parseFloat(row[9] || "0"),
          stock: parseInt(row[10] || "0", 10),
          image: images[0] || "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80",
          status: row[12],
          featured: row[13] === "TRUE",
          tags: row[14] ? row[14].split(",") : [],
          variants: []
        });
      } else {
        // Find previous parent and add variant
        const prev = await Product.findOne({ storeSlug: storeSlug.toLowerCase().trim() }).sort({ createdAt: -1 });
        if (prev) {
          prev.variants.push({
            variantLabel: row[6],
            unit: row[7],
            price: parseFloat(row[8]),
            offerPrice: parseFloat(row[9] || "0"),
            stock: parseInt(row[10] || "0", 10),
            sku: row[5]
          });
          await prev.save();
        }
      }
    }

    store.googleSheetLastSync = new Date();
    store.googleSheetSyncStatus = "success";
    store.googleSheetSyncMetrics = {
      imported: 3,
      updated: 0,
      errorsCount: 0,
      errorsList: []
    };
    await store.save();
    return { success: true, message: "Demo Workspace catalogs initialized successfully." };
  } else {
    // 🟢 REAL GOOGLE SPREADSHEET RECONSTRUCTION
    try {
      const sheets = google.sheets({ version: 'v4', auth: oauth2Client });

      // Retrieve current worksheets
      const meta = await sheets.spreadsheets.get({ spreadsheetId: store.googleSheetId });
      const sheetsList = meta.data.sheets || [];

      const requests = [];

      // Recreate missing worksheets: Products, Categories, Units
      const requiredWorksheets = ["Products", "Categories", "Units"];
      for (const sheetName of requiredWorksheets) {
        const found = sheetsList.find(s => s.properties.title === sheetName);
        if (!found) {
          requests.push({
            addSheet: { properties: { title: sheetName } }
          });
        }
      }

      // Delete Sheet1 if it exists
      const sheet1 = sheetsList.find(s => s.properties.title === "Sheet1");
      if (sheet1) {
        requests.push({
          deleteSheet: { sheetId: sheet1.properties.sheetId }
        });
      }

      if (requests.length > 0) {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId: store.googleSheetId,
          requestBody: { requests }
        });
      }

      // Write Headers & Sample Template Rows in Batch requests
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId: store.googleSheetId,
        requestBody: {
          valueInputOption: "RAW",
          data: [
            { range: "Products!A1:O100", values: [productsHeaders, ...productsSample] },
            { range: "Categories!A1:A50", values: categoriesData },
            { range: "Units!A1:A50", values: unitsData }
          ]
        }
      });

      return { success: true, message: "Google Spreadsheet structure reset successfully." };
    } catch (err) {
      console.error("Sheets reset failed:", err);
      throw new Error(`Spreadsheet reset failed: ${err.message}`);
    }
  }
}

module.exports = {
  syncStoreSheets,
  resetStoreSheets,
  refreshAuthIfNeeded
};
