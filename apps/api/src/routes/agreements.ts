
import express from "express";
import { sendAdobeAgreement } from "../services/adobe";
const router = express.Router();
router.post("/generate", async (req,res)=>{
  const { contractorEmail, templateUrl } = req.body;
  const result = await sendAdobeAgreement(contractorEmail, templateUrl);
  res.json(result);
});
export default router;
