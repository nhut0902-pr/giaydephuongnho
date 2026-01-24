import express from "express";
import serverless from "serverless-http";

const app = express();

app.use(express.json());

// test API
app.get("/", (req, res) => {
  res.json({ status: "API running on Vercel 🚀" });
});

// ví dụ API sản phẩm
app.get("/products", (req, res) => {
  res.json([
    { id: 1, name: "Giày thể thao", price: 200000 },
    { id: 2, name: "Giày sneaker", price: 350000 }
  ]);
});

export default serverless(app);
