"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendAdobeAgreement = sendAdobeAgreement;
const node_fetch_1 = __importDefault(require("node-fetch"));
async function sendAdobeAgreement(contractorEmail, pdfTemplateUrl) {
    const response = await (0, node_fetch_1.default)("https://api.adobesign.com/api/rest/v6/agreements", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${process.env.ADOBE_API_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            fileInfos: [{ transientDocumentId: pdfTemplateUrl }],
            name: "Independent Contractor Agreement",
            participantSetsInfo: [{ memberInfos: [{ email: contractorEmail }], role: "SIGNER" }],
            signatureType: "ESIGN",
            state: "IN_PROCESS"
        })
    });
    return response.json();
}
