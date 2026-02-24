"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const adobe_1 = require("../services/adobe");
const router = express_1.default.Router();
router.post("/generate", async (req, res) => {
    const { contractorEmail, templateUrl } = req.body;
    const result = await (0, adobe_1.sendAdobeAgreement)(contractorEmail, templateUrl);
    res.json(result);
});
exports.default = router;
