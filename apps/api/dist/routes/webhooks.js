"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const router = express_1.default.Router();
router.post("/stripe", (req, res) => res.sendStatus(200));
router.post("/adobe", (req, res) => res.sendStatus(200));
exports.default = router;
