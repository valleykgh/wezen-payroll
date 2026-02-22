
import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2022-11-15" });
export async function payContractor(amount:number, currency:string, stripeAccount:string){
  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    payment_method_types: ['card'],
    transfer_data: { destination: stripeAccount },
  });
  return paymentIntent;
}
