
import express from "express";
const router = express.Router();
router.post("/stripe",(req,res)=>res.sendStatus(200));
router.post("/adobe",(req,res)=>res.sendStatus(200));
export default router;
