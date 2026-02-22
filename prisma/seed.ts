
import {PrismaClient} from "@prisma/client";
const prisma = new PrismaClient();
async function main(){
  const org = await prisma.organization.create({data:{name:"Wezen Staffing"}});
  await prisma.user.create({data:{
    email:"admin@wezenstaffing.com",
    password:"Admin123!",
    role:"SUPER_ADMIN",
    organizationId:org.id
  }});
  console.log("Seed complete");
}
main();
