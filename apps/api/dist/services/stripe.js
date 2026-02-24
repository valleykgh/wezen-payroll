"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.payContractor = payContractor;
const stripe_1 = __importDefault(require("stripe"));
const stripe = new stripe_1.default(process.env.STRIPE_SECRET_KEY, { apiVersion: "2022-11-15" });
async function payContractor(amount, currency, stripeAccount) {
    const paymentIntent = await stripe.paymentIntents.create({
        amount,
        currency,
        payment_method_types: ['card'],
        transfer_data: { destination: stripeAccount },
    });
    return paymentIntent;
}
