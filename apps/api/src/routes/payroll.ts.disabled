
import express from "express";
import { runPayrollBatch } from "../services/runPayroll";
const router = express.Router();
router.post("/run", async (req,res)=>{
  const result = await runPayrollBatch();
  res.json(result);
});
export default router;
