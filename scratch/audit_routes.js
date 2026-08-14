const axios = require("axios");

const BASE_URL = "http://localhost:5000/api";

async function runFullAudit() {
  console.log("=================================================");
  console.log("🔍 STARTING FULL BACKEND REST API AUDIT");
  console.log("=================================================\n");

  const testStoreSlug = `auditstore${Date.now().toString().slice(-5)}`;
  const testEmail = `${testStoreSlug}@test.com`;

  let storeToken = "";
  let createdProductId = "";
  let createdStaffId = "";
  let createdOrderId = "";
  let customerToken = "";
  let createdCampaignId = "";

  try {
    // 1. GET ALL STORES
    console.log("1. testing GET /api/stores ...");
    const storesRes = await axios.get(`${BASE_URL}/stores`);
    console.log(`   ✅ GET /api/stores -> Status: ${storesRes.status} | Total Stores: ${storesRes.data.length}`);

    // 2. POST STORE REGISTER
    console.log("\n2. testing POST /api/stores/register ...");
    const regRes = await axios.post(`${BASE_URL}/stores/register`, {
      name: "Audit Test Store",
      email: testEmail,
      otp: "123456",
      softwareType: "restaurant"
    });
    storeToken = regRes.data.token;
    console.log(`   ✅ POST /api/stores/register -> Status: ${regRes.status} | Registered Slug: ${regRes.data.slug}`);

    // 3. GET SINGLE STORE BY SLUG
    console.log(`\n3. testing GET /api/stores/${regRes.data.slug} ...`);
    const storeRes = await axios.get(`${BASE_URL}/stores/${regRes.data.slug}`);
    console.log(`   ✅ GET /api/stores/:slug -> Status: ${storeRes.status} | Name: ${storeRes.data.name}`);

    // 4. PUT UPDATE STORE SETTINGS
    console.log(`\n4. testing PUT /api/stores/${regRes.data.slug} ...`);
    const updateStoreRes = await axios.put(`${BASE_URL}/stores/${regRes.data.slug}`, {
      tagline: "Best Audit Tested Dishes",
      address: "123 Innovation Drive",
      deliveryFee: 30,
      minOrderAmount: 100
    });
    console.log(`   ✅ PUT /api/stores/:slug -> Status: ${updateStoreRes.status} | Tagline: ${updateStoreRes.data.tagline}`);

    // 5. POST STAFF MEMBER
    console.log(`\n5. testing POST /api/stores/${regRes.data.slug}/staff ...`);
    const staffRes = await axios.post(`${BASE_URL}/stores/${regRes.data.slug}/staff`, {
      name: "Audit Chef Vikram",
      role: "Kitchen Cook",
      email: `chef.${testEmail}`,
      phone: "+91 9876543210"
    });
    createdStaffId = staffRes.data._id;
    console.log(`   ✅ POST /api/stores/:slug/staff -> Status: ${staffRes.status} | Staff ID: ${createdStaffId}`);

    // 6. GET STAFF MEMBERS LIST
    console.log(`\n6. testing GET /api/stores/${regRes.data.slug}/staff ...`);
    const staffListRes = await axios.get(`${BASE_URL}/stores/${regRes.data.slug}/staff`);
    console.log(`   ✅ GET /api/stores/:slug/staff -> Status: ${staffListRes.status} | Total Staff: ${staffListRes.data.length}`);

    // 7. DELETE STAFF MEMBER
    console.log(`\n7. testing DELETE /api/stores/${regRes.data.slug}/staff/${createdStaffId} ...`);
    const delStaffRes = await axios.delete(`${BASE_URL}/stores/${regRes.data.slug}/staff/${createdStaffId}`);
    console.log(`   ✅ DELETE /api/stores/:slug/staff/:id -> Status: ${delStaffRes.status} | Msg: ${delStaffRes.data.message}`);

    // 8. POST CREATE PRODUCT
    console.log("\n8. testing POST /api/products ...");
    const prodRes = await axios.post(`${BASE_URL}/products`, {
      storeSlug: regRes.data.slug,
      name: "Audit Special Burger",
      price: 199,
      image: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80",
      category: "Mains",
      description: "Juicy audit tested burger",
      isVeg: false,
      isAvailable: true
    });
    createdProductId = prodRes.data._id;
    console.log(`   ✅ POST /api/products -> Status: ${prodRes.status} | Product ID: ${createdProductId}`);

    // 9. GET PRODUCTS BY STORE SLUG
    console.log(`\n9. testing GET /api/products/${regRes.data.slug} ...`);
    const prodsRes = await axios.get(`${BASE_URL}/products/${regRes.data.slug}`);
    console.log(`   ✅ GET /api/products/:slug -> Status: ${prodsRes.status} | Total Products: ${prodsRes.data.length}`);

    // 10. PUT UPDATE PRODUCT
    console.log(`\n10. testing PUT /api/products/${createdProductId} ...`);
    const updateProdRes = await axios.put(`${BASE_URL}/products/${createdProductId}`, {
      price: 249,
      description: "Upgraded Gourmet Audit Burger"
    });
    console.log(`   ✅ PUT /api/products/:id -> Status: ${updateProdRes.status} | New Price: ₹${updateProdRes.data.price}`);

    // 11. POST CUSTOMER REGISTER & LOGIN
    console.log("\n11. testing POST /api/customers/register ...");
    const custRegRes = await axios.post(`${BASE_URL}/customers/register`, {
      storeSlug: regRes.data.slug,
      name: "Audit Customer Sam",
      email: `cust.${testEmail}`,
      otp: "123456"
    });
    customerToken = custRegRes.data.token;
    console.log(`   ✅ POST /api/customers/register -> Status: ${custRegRes.status} | Customer Name: ${custRegRes.data.customer.name}`);

    // 12. GET CUSTOMER PROFILE (/me)
    console.log("\n12. testing GET /api/customers/me ...");
    const custMeRes = await axios.get(`${BASE_URL}/customers/me`, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log(`   ✅ GET /api/customers/me -> Status: ${custMeRes.status} | Customer Email: ${custMeRes.data.email}`);

    // 13. PUT CUSTOMER PROFILE
    console.log("\n13. testing PUT /api/customers/profile ...");
    const custUpdateRes = await axios.put(`${BASE_URL}/customers/profile`, {
      name: "Audit Customer Sam Updated",
      phone: "+91 9999988888"
    }, {
      headers: { Authorization: `Bearer ${customerToken}` }
    });
    console.log(`   ✅ PUT /api/customers/profile -> Status: ${custUpdateRes.status} | Name: ${custUpdateRes.data.name}`);

    // 14. POST CREATE ORDER
    console.log("\n14. testing POST /api/orders ...");
    const orderRes = await axios.post(`${BASE_URL}/orders`, {
      storeSlug: regRes.data.slug,
      customerName: "Audit Customer Sam",
      phone: "+91 9999988888",
      address: "Flat 402, Audit Tower",
      items: [
        {
          productId: createdProductId,
          name: "Audit Special Burger",
          price: 249,
          quantity: 2
        }
      ],
      totalAmount: 498,
      paymentMethod: "cod",
      checkoutType: "website"
    });
    createdOrderId = orderRes.data._id;
    console.log(`   ✅ POST /api/orders -> Status: ${orderRes.status} | Order ID: ${createdOrderId} | Total: ₹${orderRes.data.totalAmount}`);

    // 15. GET ORDERS FOR STORE
    console.log(`\n15. testing GET /api/orders/${regRes.data.slug} ...`);
    const ordersListRes = await axios.get(`${BASE_URL}/orders/${regRes.data.slug}`);
    console.log(`   ✅ GET /api/orders/:slug -> Status: ${ordersListRes.status} | Total Orders: ${ordersListRes.data.length}`);

    // 16. PATCH UPDATE ORDER STATUS
    console.log(`\n16. testing PATCH /api/orders/${createdOrderId}/status ...`);
    const orderStatusRes = await axios.patch(`${BASE_URL}/orders/${createdOrderId}/status`, {
      status: "preparing"
    });
    console.log(`   ✅ PATCH /api/orders/:orderId/status -> Status: ${orderStatusRes.status} | New Status: ${orderStatusRes.data.status}`);

    // 17. POST CREATE CAMPAIGN
    console.log(`\n17. testing POST /api/campaigns/${regRes.data.slug} ...`);
    const campRes = await axios.post(`${BASE_URL}/campaigns/${regRes.data.slug}`, {
      title: "Audit Launch Offer",
      couponCode: "AUDIT50",
      discountType: "percentage",
      discountValue: 50,
      rewardType: "discount"
    });
    createdCampaignId = campRes.data._id;
    console.log(`   ✅ POST /api/campaigns/:storeSlug -> Status: ${campRes.status} | Code: ${campRes.data.couponCode || campRes.data.title}`);

    // 18. GET CAMPAIGNS LIST BY STORE SLUG
    console.log(`\n18. testing GET /api/campaigns/${regRes.data.slug} ...`);
    const campListRes = await axios.get(`${BASE_URL}/campaigns/${regRes.data.slug}`);
    console.log(`   ✅ GET /api/campaigns/:storeSlug -> Status: ${campListRes.status} | Total Campaigns: ${campListRes.data.length}`);

    // 19. DELETE CAMPAIGN BY STORE SLUG & ID
    console.log(`\n19. testing DELETE /api/campaigns/${regRes.data.slug}/${createdCampaignId} ...`);
    const delCampRes = await axios.delete(`${BASE_URL}/campaigns/${regRes.data.slug}/${createdCampaignId}`);
    console.log(`   ✅ DELETE /api/campaigns/:storeSlug/:id -> Status: ${delCampRes.status} | Msg: ${delCampRes.data.message}`);

    // 20. DELETE PRODUCT
    console.log(`\n20. testing DELETE /api/products/${createdProductId} ...`);
    const delProdRes = await axios.delete(`${BASE_URL}/products/${createdProductId}`);
    console.log(`   ✅ DELETE /api/products/:id -> Status: ${delProdRes.status} | Msg: ${delProdRes.data.message}`);

    console.log("\n=================================================");
    console.log("🎉 AUDIT PASSED 100%! ALL 20 ENDPOINTS & VERBS VERIFIED!");
    console.log("=================================================");

  } catch (err) {
    console.error("\n❌ AUDIT FAILED AT STEP:", err.config?.url);
    console.error("   Error Message:", err.response?.data?.message || err.response?.data || err.message);
  }
}

runFullAudit();
