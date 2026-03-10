"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const _shared_1 = require("./_shared");
const router = express_1.default.Router();
router.post("/verify-pin", async (req, res) => {
    try {
        (0, _shared_1.requireAdminPinFromBody)(req);
        return res.json({ ok: true });
    }
    catch (e) {
        const status = e?.status || 500;
        console.error("POST /api/admin/verify-pin failed:", e);
        return res.status(status).json({ error: e?.message || "PIN verification failed" });
    }
});
exports.default = router;
