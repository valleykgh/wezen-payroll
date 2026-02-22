
import fetch from "node-fetch";
export async function sendAdobeAgreement(contractorEmail:string, pdfTemplateUrl:string){
  const response = await fetch("https://api.adobesign.com/api/rest/v6/agreements",{
    method:"POST",
    headers:{
      "Authorization":`Bearer ${process.env.ADOBE_API_TOKEN}`,
      "Content-Type":"application/json"
    },
    body: JSON.stringify({
      fileInfos:[{transientDocumentId:pdfTemplateUrl}],
      name:"Independent Contractor Agreement",
      participantSetsInfo:[{memberInfos:[{email:contractorEmail}],role:"SIGNER"}],
      signatureType:"ESIGN",
      state:"IN_PROCESS"
    })
  });
  return response.json();
}
