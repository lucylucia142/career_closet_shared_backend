require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient, ObjectId } = require("mongodb");
const base64 = require("base-64");

const app = express();
const PORT = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://www.careercloset.co.za.s3-website-us-east-1.amazonaws.com"
  ],
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true
}));



let client, db;

async function connectToMongo() {
  try {
    client = new MongoClient(uri);
    await client.connect();
    db = client.db("CareerCloset");
    console.log("Connected to MongoDB:", db.databaseName);
  } catch (error) {
    console.error("MongoDB connection failed:", error);
    process.exit(1);
  }
}

// Authentication Middleware
const authenticate = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' });
  }
  const userId = authHeader.split(' ')[1];
  try {
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(401).json({ message: 'User not found' });
    req.user = user;
    next();
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};

// ---------------- USERS ----------------
const avatarChoices = [
  "https://randomuser.me/api/portraits/women/1.jpg",
  "https://randomuser.me/api/portraits/men/1.jpg",
  "https://randomuser.me/api/portraits/women/2.jpg",
  "https://randomuser.me/api/portraits/men/2.jpg",
  "https://randomuser.me/api/portraits/women/3.jpg",
  "https://randomuser.me/api/portraits/men/3.jpg",
  "https://randomuser.me/api/portraits/women/4.jpg",
  "https://randomuser.me/api/portraits/men/4.jpg",
  "https://randomuser.me/api/portraits/women/5.jpg",
  "https://randomuser.me/api/portraits/men/5.jpg"
];

// Signup
app.post("/signup", async (req, res) => {
  try {
    const user = req.body;
    if (!user.password || user.password.length < 8)
      return res.status(400).json({ message: "Password must be at least 8 characters" });
    if (!user.email || !user.email.includes("@"))
      return res.status(400).json({ message: "Invalid email format" });
    if (user.password !== user.confirmPassword)
      return res.status(400).json({ message: "Passwords do not match" });

    const existingUser = await db.collection("users").findOne({ email: user.email });
    if (existingUser) return res.status(400).json({ message: "Email already in use" });

    user.password = base64.encode(user.password);
    delete user.confirmPassword;
    user.avatar = avatarChoices[Math.floor(Math.random() * avatarChoices.length)];

    user.settings = {
      emailNotifications: true,
      smsNotifications: false,
      marketingEmails: true,
      orderUpdates: true,
      priceAlerts: false,
      defaultDeliveryTime: "morning",
      flowerPreferences: [],
      allergyInfo: "",
      autoReorder: false,
      wishlistPublic: false
    };

    const result = await db.collection("users").insertOne({
      ...user,
      createdAt: new Date(),
    });

    res.status(201).json({
      message: "User created",
      userId: result.insertedId,
      userName: user.userName || user.username,
      email: user.email,
      avatar: user.avatar,
      settings: user.settings
    });
  } catch (e) {
    console.error("Error signing up:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Login check
app.post("/checkpassword", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password required" });

    const user = await db.collection("users").findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    const decodedPassword = base64.decode(user.password);
    if (password === decodedPassword) {
      return res.json({
        message: "Password is correct",
        valid: true,
        userId: user._id.toString(),
        userName: user.userName || user.username,
        email: user.email,
        avatar: user.avatar,
        phone: user.phone,
        address: user.address,
        settings: user.settings || {}
      });
    } else {
      return res.status(401).json({ message: "Invalid password", valid: false });
    }
  } catch (e) {
    console.error("Error checking password:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get user by ID
app.get("/user/:id", authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid user ID" });

    const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      userId: user._id.toString(),
      userName: user.userName || user.username,
      email: user.email,
      avatar: user.avatar,
      phone: user.phone,
      address: user.address,
      settings: user.settings || {}
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get user by email
app.get("/users", async (req, res) => {
  try {
    const { email } = req.query;
    if (!email) return res.status(400).json({ message: "Email query required" });

    const user = await db.collection("users").findOne({ email });
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      userId: user._id.toString(),
      userName: user.userName || user.username,
      email: user.email,
      avatar: user.avatar,
      phone: user.phone,
      address: user.address,
      settings: user.settings || {}
    });
  } catch (error) {
    console.error("Error fetching user by email:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ---------------- CART ----------------
app.get("/cart/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ message: "Invalid user ID" });

    const cart = await db.collection("carts").findOne({ userId: new ObjectId(userId) });
    res.json(cart || { userId, items: {} });
  } catch (error) {
    console.error("Error fetching cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.post("/cart", authenticate, async (req, res) => {
  try {
    const { userId, itemId, size, quantity } = req.body;
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid user or item ID" });
    }
    if (!size || quantity < 1) {
      return res.status(400).json({ message: "Invalid size or quantity" });
    }

    const cart = await db.collection("carts").findOne({ userId: new ObjectId(userId) });
    const items = cart ? structuredClone(cart.items) : {};

    if (!items[itemId]) items[itemId] = {};
    items[itemId][size] = quantity;

    await db.collection("carts").updateOne(
      { userId: new ObjectId(userId) },
      { $set: { items, updatedAt: new Date() } },
      { upsert: true }
    );

    res.status(200).json({ message: "Cart updated" });
  } catch (error) {
    console.error("Error adding to cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/cart/:userId", authenticate, async (req, res) => {
  try {
    const { userId } = req.params;
    const { itemId, size, quantity } = req.body;
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid user or item ID" });
    }
    if (!size || quantity < 1) {
      return res.status(400).json({ message: "Invalid size or quantity" });
    }

    const cart = await db.collection("carts").findOne({ userId: new ObjectId(userId) });
    if (!cart) return res.status(404).json({ message: "Cart not found" });

    const items = structuredClone(cart.items);
    if (!items[itemId]) items[itemId] = {};
    items[itemId][size] = quantity;

    await db.collection("carts").updateOne(
      { userId: new ObjectId(userId) },
      { $set: { items, updatedAt: new Date() } }
    );

    res.status(200).json({ message: "Cart updated" });
  } catch (error) {
    console.error("Error updating cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ---------------- CART (UPDATED DELETE ROUTE) ----------------

app.delete("/cart/:userId/:itemId/:size", authenticate, async (req, res) => {
  try {
    const { userId, itemId, size } = req.params;
    if (!ObjectId.isValid(userId) || !ObjectId.isValid(itemId)) {
      return res.status(400).json({ message: "Invalid user or item ID" });
    }

    const cart = await db.collection("carts").findOne({ userId: new ObjectId(userId) });

    // 🛑 KEY FIX: We no longer return 404 if the cart is missing. 
    // We treat a deletion attempt on a missing item/cart as a success, 
    // because the desired state (item/cart is gone) is achieved.
    if (cart) {
        const items = structuredClone(cart.items);
        
        // Only attempt to delete and update if the item/size exists
        if (items[itemId] && items[itemId][size]) {
            delete items[itemId][size];
            if (Object.keys(items[itemId]).length === 0) delete items[itemId];

            await db.collection("carts").updateOne(
                { userId: new ObjectId(userId) },
                { $set: { items, updatedAt: new Date() } }
            );
        }
    }

    // ✅ Return success (200 OK) regardless of whether the cart existed 
    // or whether the item was found inside the cart.
    res.status(200).json({ message: "Item removed from cart (or already removed)" });
  } catch (error) {
    console.error("Error removing from cart:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// ---------------- PRODUCTS ----------------
app.post("/products", async (req, res) => {
  try {
    const product = req.body;

    if (!product.stock_quantity) product.stock_quantity = Math.floor(Math.random() * 50) + 10;

    const result = await db.collection("products").insertOne({
      ...product,
      createdAt: new Date(),
    });

    res.status(201).json({ message: "Product added", id: result.insertedId });
  } catch (e) {
    console.error("Error adding product:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/products", async (req, res) => {
  try {
    const products = await db.collection("products").find().toArray();
    res.json(products);
  } catch (e) {
    console.error("Error fetching products:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.get("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });

    const product = await db.collection("products").findOne({ _id: new ObjectId(id) });
    if (!product) return res.status(404).json({ message: "Product not found" });

    res.json(product);
  } catch (e) {
    console.error("Error fetching product:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.put("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });

    const result = await db.collection("products").updateOne(
      { _id: new ObjectId(id) },
      { $set: { ...req.body, updatedAt: new Date() } }
    );

    if (result.matchedCount === 0) return res.status(404).json({ message: "Product not found" });
    res.json({ message: "Product updated" });
  } catch (e) {
    console.error("Error updating product:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

app.delete("/products/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid ID" });

    const result = await db.collection("products").deleteOne({ _id: new ObjectId(id) });
    if (result.deletedCount === 0) return res.status(404).json({ message: "Product not found" });

    res.json({ message: "Product deleted" });
  } catch (e) {
    console.error("Error deleting product:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// ---------------- ORDERS ----------------
// Place a new order
// ---------------- ORDERS (CORRECTED) ----------------
// Place a new order
app.post("/orders", async (req, res) => {
  try {
    // items is now an ARRAY of objects from the frontend
    const { userId, items, totalAmount, shippingAddress, paymentMethod, paymentStatus } = req.body; // Added new fields

    if (!ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }
    if (!items || items.length === 0 || !totalAmount || !shippingAddress) {
      return res.status(400).json({ message: "Missing required order fields or empty item list" });
    }

    // Fetch user (used for verification)
    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    if (!user) return res.status(404).json({ message: "User not found" });

    // 🔑 NEW VALIDATION LOGIC: Loop directly over the items ARRAY
    const validatedItems = [];
    for (const item of items) {
        // Ensure critical fields exist
        if (!item.productId || !item.quantity || !item.size || !item.price) {
          return res.status(400).json({ message: "One or more order items are incomplete." });
        }
        
        // Optional: Verify product exists and quantity is positive
        const product = await db.collection("products").findOne({ _id: new ObjectId(item.productId) });
        if (!product) return res.status(404).json({ message: `Product ID ${item.productId} not found` });
        if (item.quantity < 1) {
          return res.status(400).json({ message: `Invalid quantity for product ${item.productId}` });
        }

        // Store the cleaned, validated item data
        validatedItems.push({
            productId: new ObjectId(item.productId),
            name: item.name,
            image: item.image,
            price: item.price,
            size: item.size,
            quantity: item.quantity,
        });
    }

    // Save order
    const orderData = {
      userId: new ObjectId(userId),
      items: validatedItems,
      totalAmount,
      shippingAddress, // Use the address sent from the frontend form
      paymentMethod: paymentMethod || 'N/A',
      paymentStatus: paymentStatus || 'Pending',
      status: "Processing", // Better initial status than "Pending"
      createdAt: new Date(),
      updatedAt: new Date()
    };

    const result = await db.collection("orders").insertOne(orderData);

    // Clear the cart (using the correct field: userId)
    await db.collection("carts").deleteOne({ userId: new ObjectId(userId) });

    res.status(201).json({ message: "Order placed", _id: result.insertedId }); // Changed 'id' to '_id' for frontend navigation
  } catch (e) {
    console.error("Error placing order:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});
// Get all orders for a user
app.get("/orders/user/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    if (!ObjectId.isValid(userId)) return res.status(400).json({ message: "Invalid user ID" });

    const orders = await db.collection("orders").find({ userId: new ObjectId(userId) }).toArray();
    res.json(orders);
  } catch (e) {
    console.error("Error fetching orders:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// Get a single order by ID
app.get("/orders/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!ObjectId.isValid(id)) return res.status(400).json({ message: "Invalid order ID" });

    const order = await db.collection("orders").findOne({ _id: new ObjectId(id) });
    if (!order) return res.status(404).json({ message: "Order not found" });

    res.json(order);
  } catch (e) {
    console.error("Error fetching order:", e);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// ---------------- START SERVER ----------------
connectToMongo().then(() => {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
});