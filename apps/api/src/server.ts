import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { authRoutes } from "./routes/authRoutes";
import { meRoutes } from "./routes/meRoutes";
import { adminTimeRoutes } from "./routes/adminTimeRoutes";
import { employeeRoutes } from "./routes/employeeRoutes";
import { adminInviteRoutes } from "./routes/adminInviteRoutes";
// import { adminRoutes } from "./routes/adminRoutes"; // uncomment if you have it

dotenv.config();

const app = express();
app.use(cors({
  origin: ["http://localhost:4001", "http://localhost:3000"],
  credentials: true,
  methods: ["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));
console.log("BUILD_ID:", process.env.BUILD_ID || "no-build-id");

/**
 * CORS
 * Avoid app.options("*", cors()) with default settings,
 * because that overrides your restricted origin list.
 */
const corsOptions: cors.CorsOptions = {
  origin: [
    "https://payroll.wezenstaffing.com",
    "https://dcvnabxhc4tbc.cloudfront.net",
  ],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-Requested-With"],
  // credentials: true, // enable only if you use cookies
};
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));

app.use(express.json());

/**
 * Public routes (NO auth)
 * Keep these BEFORE mounting protected routers.
 */
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    buildId: process.env.BUILD_ID ?? "no-build-id",
  });
});

app.get("/api/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    buildId: process.env.BUILD_ID ?? "no-build-id",
  });
});

/**
 * API routes
 * Mount under /api so /health is never protected by mistake.
 */
app.use("/api/auth", authRoutes);
app.use("/api", meRoutes);
app.use("/api", employeeRoutes);
app.use("/api/admin", adminTimeRoutes);
app.use("/api/admin", adminInviteRoutes);
// app.use("/api", adminRoutes);

/**
 * 404 fallback
 */
app.use((req, res) => {
  res.status(404).json({ error: "Not found" });
});

const port = Number(process.env.PORT || 4001);
app.listen(port, "0.0.0.0", () => console.log(`API running on port ${port}`));
