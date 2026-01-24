import express from "express";
import serverless from "serverless-http";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (req, res) => {
  res.json({ status: "OK", message: "Backend Giày Dép Hương Nhớ chạy rồi 🚀" });
});

// export cho vercel
export default serverless(app);
