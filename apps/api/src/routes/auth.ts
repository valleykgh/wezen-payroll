
import express from "express";
const router = express.Router();
router.post("/login",(req,res)=>res.json({token:"fake-jwt-token"}));
export default router;
