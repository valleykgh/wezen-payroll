"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.signToken = signToken;
exports.verifyToken = verifyToken;
exports.setAuthCookie = setAuthCookie;
exports.clearAuthCookie = clearAuthCookie;
exports.readAuthToken = readAuthToken;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "wezen_auth";
function signToken(payload) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is not set");
    return jsonwebtoken_1.default.sign(payload, secret, { expiresIn: "7d" });
}
function verifyToken(token) {
    const secret = process.env.JWT_SECRET;
    if (!secret)
        throw new Error("JWT_SECRET is not set");
    return jsonwebtoken_1.default.verify(token, secret);
}
function setAuthCookie(res, token) {
    const isProduction = process.env.NODE_ENV === "production";
    res.cookie(COOKIE_NAME, token, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1000,
    });
}
function clearAuthCookie(res) {
    const isProduction = process.env.NODE_ENV === "production";
    res.clearCookie(COOKIE_NAME, {
        httpOnly: true,
        secure: isProduction,
        sameSite: "lax",
        domain: process.env.COOKIE_DOMAIN || undefined,
        path: "/",
    });
}
function readAuthToken(req) {
    const cookieName = process.env.AUTH_COOKIE_NAME || "wezen_auth";
    return req.cookies?.[cookieName] || "";
}
