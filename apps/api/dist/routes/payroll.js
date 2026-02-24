"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const runPayroll_1 = require("../services/runPayroll");
const router = express_1.default.Router();
router.post("/run", async (req, res) => {
    const result = await (0, runPayroll_1.runPayrollBatch)();
    res.json(result);
});
exports.default = router;
