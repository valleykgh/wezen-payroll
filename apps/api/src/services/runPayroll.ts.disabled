
import { PrismaClient } from "@prisma/client";
import { payContractor } from "./stripe";
const prisma = new PrismaClient();
export async function runPayrollBatch(){
  const timesheets = await prisma.timesheet.findMany({ where:{ approved:true, paid:false } });
  for(const ts of timesheets){
    const contractor = await prisma.contractor.findUnique({where:{id:ts.contractorId}});
    if(contractor?.stripeAccountId){
      await payContractor(ts.hours*contractor.hourlyRate*100,"usd",contractor.stripeAccountId);
      await prisma.timesheet.update({ where:{id:ts.id}, data:{paid:true}});
    }
  }
  return {message:`Payroll run complete for ${timesheets.length} entries`};
}
