const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const app = express();
const port = process.env.PORT || 3000;

// middleware
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World!");
});

const uri =
  "mongodb+srv://importDB:HZhSdDAop9hgMcvn@cluster0.478fouv.mongodb.net/?appName=Cluster0";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();
    const db = client.db("importDB");
    const productsCollection = db.collection("products");
    const importsCollection = db.collection("imports");

    // PRODUCTS API's
    app.get("/products", async (req, res) => {
      const cursor = productsCollection.find();
      const result = await cursor.toArray();
      console.log(result);

      res.send(result);
    });

    // latest-products API
    app.get("/latest-products", async (req, res) => {
      const cursor = productsCollection
        .find()
        .sort({ created_at: -1 })
        .limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // product By ID
    app.get("/products/:id", async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({ error: "Invalid product ID" });
      }
      const result = await productsCollection.findOne({
        _id: new ObjectId(id),
      });
      if (!result) return res.status(404).send({ error: "Product not found" });

      res.send(result);
    });

    // post/insert product by ID
    app.post("/products", async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct);
      res.send(result);
    });

    // POST: Import Now
    app.post("/imports", async (req, res) => {
      try {
        const { product_id, quantity, user_email } = req.body;

        // --- Validate incoming data ---
        if (!product_id)
          return res.status(400).send({ error: "product_id required" });

        const qty = Number(quantity);
        if (!qty || qty <= 0)
          return res.send({ error: "Quantity must be a positive number" });

        if (!user_email) return res.send({ error: "user_email required" });
        const pid = ObjectId.isValid(product_id)
          ? new ObjectId(product_id)
          : product_id;

        const product = await productsCollection.findOne({ _id: pid });

        if (!product) {
          return res.send({ error: "Product not found" });
        }

        if (product.available_quantity < qty) {
          return res.send({ error: "Not enough stock available" });
        }
        await productsCollection.updateOne(
          { _id: pid },
          { $inc: { available_quantity: -qty } }
        );

        const importDoc = {
          user_email,
          productId: pid,
          product_name: product.product_name,
          product_image: product.product_image,
          price: product.price,
          rating: product.rating,
          origin_country: product.origin_country,
          import_quantity: qty,
          date: new Date(),
        };

        const result = await importsCollection.insertOne(importDoc);

        res.send({
          success: true,
          insertedId: result.insertedId,
          new_stock: product.available_quantity - qty,
        });
      } catch (err) {
        console.error("IMPORT_ERROR:", err);
        res.send({ error: "Server error during import" });
      }
    });

    

    // Delete Product By ID
    app.delete("/products/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await productsCollection.deleteOne(query);
      res.send(result);
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
  }
}
run().catch(console.dir);

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
