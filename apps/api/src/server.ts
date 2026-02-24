import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();
console.log("BUILD_ID:", process.env.BUILD_ID || "no-build-id");
const app = express();
app.use(cors({
origin: ["https://payroll.wezenstaffing.com","https://localhost:3000"],
methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
allowedHeaders: ["Contect-Type", "Authorization"],
}));
app.use(express.json());

app.get("/health", (_req, res) => res.json({ status: "ok", buildId: process.env.BUILD_ID }));

const port = Number(process.env.PORT || 4000);
app.listen(port, () => console.log(`API running on port ${port}`));
