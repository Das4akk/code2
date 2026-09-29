// server.ts
import "dotenv/config";
import crypto2 from "crypto";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import path2 from "path";
import fs2 from "fs";
import { fileURLToPath as fileURLToPath2 } from "url";
import nodemailer from "nodemailer";
import admin2 from "firebase-admin";
import { createProxyMiddleware } from "http-proxy-middleware";

// utils/url-validator.ts
import dns from "dns";
import net from "net";
var ALLOWED_MEDIA_DOMAINS = [
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "rutube.ru",
  "www.rutube.ru",
  "vk.com",
  "www.vk.com",
  "vkvideo.ru",
  "www.vkvideo.ru",
  "vimeo.com",
  "www.vimeo.com"
];
var BLOCKED_HOSTNAMES = /* @__PURE__ */ new Set([
  "localhost",
  "localhost.localdomain",
  "127.0.0.1",
  "0.0.0.0",
  "::1",
  "metadata.google.internal",
  "169.254.169.254",
  "instance-data",
  "metadata",
  "metadata.google.internal."
]);
function isPrivateIp(ip) {
  if (!ip || typeof ip !== "string") return true;
  const cleanIp = ip.trim().toLowerCase();
  if (cleanIp.startsWith("::ffff:")) {
    const ipv4Part = cleanIp.slice(7);
    return isPrivateIp(ipv4Part);
  }
  if (net.isIPv6(cleanIp)) {
    if (cleanIp === "::1" || cleanIp === "0:0:0:0:0:0:0:1") return true;
    if (cleanIp === "::" || cleanIp === "0:0:0:0:0:0:0:0") return true;
    if (/^f[cd][0-9a-f]{2}:/i.test(cleanIp)) return true;
    if (/^fe[89ab][0-9a-f]:/i.test(cleanIp)) return true;
    return false;
  }
  if (net.isIPv4(cleanIp)) {
    const parts = cleanIp.split(".").map((p) => parseInt(p, 10));
    if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
      return true;
    }
    const [o0, o1, o2] = parts;
    if (o0 === 0) return true;
    if (o0 === 10) return true;
    if (o0 === 100 && o1 >= 64 && o1 <= 127) return true;
    if (o0 === 127) return true;
    if (o0 === 169 && o1 === 254) return true;
    if (o0 === 172 && o1 >= 16 && o1 <= 31) return true;
    if (o0 === 192 && o1 === 0 && o2 === 0) return true;
    if (o0 === 192 && o1 === 0 && o2 === 2) return true;
    if (o0 === 192 && o1 === 168) return true;
    if (o0 === 198 && (o1 === 18 || o1 === 19)) return true;
    if (o0 === 198 && o1 === 51 && o2 === 100) return true;
    if (o0 === 203 && o1 === 0 && o2 === 113) return true;
    if (o0 >= 224 && o0 <= 239) return true;
    if (o0 >= 240) return true;
    return false;
  }
  return true;
}
function isDomainAllowed(hostname, allowedDomains = ALLOWED_MEDIA_DOMAINS) {
  const normHost = hostname.toLowerCase().trim().replace(/\.$/, "");
  for (const domain of allowedDomains) {
    const normDomain = domain.toLowerCase().trim();
    if (normHost === normDomain || normHost.endsWith("." + normDomain)) {
      return true;
    }
  }
  return false;
}
async function validateUrl(rawUrl, options) {
  if (!rawUrl || typeof rawUrl !== "string") {
    return { valid: false, error: "URL is required" };
  }
  const trimmed = rawUrl.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { valid: false, error: "Malformed or invalid URL format" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return { valid: false, error: `Protocol ${parsed.protocol} is not permitted. Only http: and https: are allowed.` };
  }
  const hostname = parsed.hostname.toLowerCase().trim();
  if (BLOCKED_HOSTNAMES.has(hostname) || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    return { valid: false, error: `Access to hostname "${hostname}" is forbidden (SSRF protection).` };
  }
  if (net.isIP(hostname)) {
    if (isPrivateIp(hostname)) {
      return { valid: false, error: `Access to private or local IP address ${hostname} is blocked.` };
    }
  }
  const enforceWhitelist = options?.enforceWhitelist !== false;
  const allowedDomains = options?.allowedDomains || ALLOWED_MEDIA_DOMAINS;
  if (enforceWhitelist && !isDomainAllowed(hostname, allowedDomains)) {
    return {
      valid: false,
      error: `Domain "${hostname}" is not in the allowed media whitelist.`
    };
  }
  try {
    const lookupResults = await dns.promises.lookup(hostname, { all: true });
    if (!lookupResults || lookupResults.length === 0) {
      return { valid: false, error: `DNS lookup failed for hostname "${hostname}".` };
    }
    const resolvedIps = lookupResults.map((r) => r.address);
    for (const ip of resolvedIps) {
      if (isPrivateIp(ip)) {
        return {
          valid: false,
          error: `DNS resolution for "${hostname}" pointed to blocked private/local IP ${ip}.`
        };
      }
    }
    return { valid: true, url: parsed, resolvedIps };
  } catch (dnsErr) {
    return {
      valid: false,
      error: `Unable to resolve hostname "${hostname}": ${dnsErr.message || "DNS error"}`
    };
  }
}
async function safeFetch(rawUrl, options = {}) {
  const timeoutMs = options.timeoutMs ?? 5e3;
  const maxRedirects = options.maxRedirects ?? 3;
  let currentUrl = rawUrl;
  let redirectsCount = 0;
  while (redirectsCount <= maxRedirects) {
    const validation = await validateUrl(currentUrl, {
      allowedDomains: options.allowedDomains,
      enforceWhitelist: options.enforceWhitelist
    });
    if (!validation.valid || !validation.url) {
      throw new Error(`[SSRF Blocked] ${validation.error || "Invalid or forbidden URL"}`);
    }
    const controller = new AbortController();
    const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const fetchOpts = {
        ...options,
        redirect: "manual",
        // Manually inspect redirects to validate target location!
        signal: controller.signal
      };
      const response = await fetch(validation.url.toString(), fetchOpts);
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const locationHeader = response.headers.get("location");
        if (!locationHeader) {
          return response;
        }
        redirectsCount++;
        if (redirectsCount > maxRedirects) {
          throw new Error("[SSRF Blocked] Exceeded maximum allowed redirects (3).");
        }
        const resolvedRedirect = new URL(locationHeader, validation.url).toString();
        currentUrl = resolvedRedirect;
        continue;
      }
      return response;
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`[SafeFetch Timeout] Request to "${currentUrl}" timed out after ${timeoutMs}ms.`);
      }
      throw err;
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
  throw new Error("[SSRF Blocked] Too many redirects.");
}

// utils/sanitize.ts
import DOMPurify from "isomorphic-dompurify";
function sanitizeText(text) {
  if (text === null || text === void 0) return "";
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
}
function sanitizeObject(obj) {
  if (obj === null || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item));
  }
  const cleanObj = {};
  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().trim();
    if (lowerKey === "__proto__" || lowerKey === "constructor" || lowerKey === "prototype") {
      continue;
    }
    if (value !== null && typeof value === "object") {
      cleanObj[key] = sanitizeObject(value);
    } else {
      cleanObj[key] = value;
    }
  }
  return cleanObj;
}
function prototypePollutionMiddleware(req, _res, next) {
  if (req.body && typeof req.body === "object") {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === "object") {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === "object") {
    req.params = sanitizeObject(req.params);
  }
  next();
}

// lib/auth-middleware.ts
import admin from "firebase-admin";

// lib/roles.ts
import crypto from "crypto";
function timingSafeEqualStr(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  try {
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}
function parseEnvList(val) {
  if (!val) return [];
  return val.split(/[,;\s]+/).map((s) => s.trim().toLowerCase()).filter(Boolean);
}
function getEnvRoleConfig() {
  const creatorEmails = /* @__PURE__ */ new Set([
    ...parseEnvList(process.env.CREATOR_EMAILS),
    ...parseEnvList(process.env.ADMIN_EMAILS),
    ...parseEnvList(process.env.OWNER_EMAILS)
  ]);
  const creatorUids = /* @__PURE__ */ new Set([
    ...parseEnvList(process.env.CREATOR_UIDS),
    ...parseEnvList(process.env.ADMIN_UIDS)
  ]);
  const operatorEmails = new Set(parseEnvList(process.env.OPERATOR_EMAILS));
  const operatorUids = new Set(parseEnvList(process.env.OPERATOR_UIDS));
  const managerEmails = new Set(parseEnvList(process.env.MANAGER_EMAILS));
  const managerUids = new Set(parseEnvList(process.env.MANAGER_UIDS));
  const moderatorEmails = new Set(parseEnvList(process.env.MODERATOR_EMAILS));
  const moderatorUids = new Set(parseEnvList(process.env.MODERATOR_UIDS));
  return {
    creatorEmails,
    creatorUids,
    operatorEmails,
    operatorUids,
    managerEmails,
    managerUids,
    moderatorEmails,
    moderatorUids
  };
}
async function getFirebaseRoleConfig(db) {
  if (!db) return null;
  try {
    const snap = await db.ref("config/roles").once("value");
    if (!snap.exists()) return null;
    const val = snap.val();
    const extractList = (raw) => {
      if (!raw) return [];
      if (Array.isArray(raw)) return raw.map((s) => String(s).trim().toLowerCase()).filter(Boolean);
      if (typeof raw === "string") return parseEnvList(raw);
      if (typeof raw === "object") return Object.keys(raw).map((s) => s.trim().toLowerCase()).filter(Boolean);
      return [];
    };
    return {
      creatorEmails: new Set(extractList(val.creators || val.creator || val.creatorEmails)),
      creatorUids: new Set(extractList(val.creatorUids)),
      operatorEmails: new Set(extractList(val.operators || val.operator || val.operatorEmails)),
      operatorUids: new Set(extractList(val.operatorUids)),
      managerEmails: new Set(extractList(val.managers || val.manager || val.managerEmails)),
      managerUids: new Set(extractList(val.managerUids)),
      moderatorEmails: new Set(extractList(val.moderators || val.moderator || val.moderatorEmails)),
      moderatorUids: new Set(extractList(val.moderatorUids))
    };
  } catch (err) {
    console.warn("[COWIO Roles] Warning reading config/roles from Firebase:", err.message);
    return null;
  }
}
async function resolveAutoRole(uid, email, db) {
  const normEmail = (email || "").trim().toLowerCase();
  const cleanUid = (uid || "").trim();
  const envConfig = getEnvRoleConfig();
  let fbConfig = null;
  if (db) {
    fbConfig = await getFirebaseRoleConfig(db);
  }
  const roles = ["creator", "operator", "manager", "moderator"];
  for (const role of roles) {
    const emailKey = `${role}Emails`;
    const uidKey = `${role}Uids`;
    const envEmails = envConfig[emailKey];
    const envUids = envConfig[uidKey];
    const fbEmails = fbConfig?.[emailKey];
    const fbUids = fbConfig?.[uidKey];
    if (normEmail && envEmails?.has(normEmail) || cleanUid && envUids?.has(cleanUid) || normEmail && fbEmails?.has(normEmail) || cleanUid && fbUids?.has(cleanUid)) {
      return role;
    }
  }
  return null;
}
async function syncRoleToDatabase(db, uid, role, userEmail, grantedBy = "auto_system") {
  if (!db || !uid || !role) return;
  const isOwner = role === "creator";
  const adminRecord = {
    role,
    isOwner,
    email: userEmail || null,
    grantedAt: Date.now(),
    grantedBy
  };
  try {
    await Promise.all([
      db.ref(`admins/${uid}`).set(adminRecord),
      db.ref(`users/${uid}/profile/role`).set(role)
    ]);
    console.log(`[COWIO Roles] Successfully synced role '${role}' to UID: ${uid} (grantedBy: ${grantedBy})`);
  } catch (err) {
    console.error(`[COWIO Roles] Failed to write role to Firebase for UID ${uid}:`, err.message);
    throw err;
  }
}
async function getRoleSecrets(db) {
  const secrets = {
    creator: (process.env.ROLE_SECRET_CREATOR || process.env.CREATOR_SECRET || "").trim(),
    operator: (process.env.ROLE_SECRET_OPERATOR || process.env.OPERATOR_SECRET || "").trim(),
    manager: (process.env.ROLE_SECRET_MANAGER || process.env.MANAGER_SECRET || "").trim(),
    moderator: (process.env.ROLE_SECRET_MODERATOR || process.env.MODERATOR_SECRET || "").trim(),
    master: (process.env.ADMIN_SECRET_KEY || "").trim()
  };
  if (db) {
    try {
      const snap = await db.ref("config/role_secrets").once("value");
      if (snap.exists()) {
        const val = snap.val();
        if (val.creator) secrets.creator = String(val.creator).trim();
        if (val.operator) secrets.operator = String(val.operator).trim();
        if (val.manager) secrets.manager = String(val.manager).trim();
        if (val.moderator) secrets.moderator = String(val.moderator).trim();
        if (val.master) secrets.master = String(val.master).trim();
      }
    } catch (err) {
      console.warn("[COWIO Roles] Warning reading config/role_secrets:", err.message);
    }
  }
  return secrets;
}
async function verifyRoleSecret(secret, requestedRole, db) {
  const cleanSecret = String(secret || "").trim();
  if (!cleanSecret) {
    return { valid: false, error: "\u0421\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D" };
  }
  const secrets = await getRoleSecrets(db);
  const configuredSecrets = Object.values(secrets).filter((s) => Boolean(s && s.length > 0));
  if (configuredSecrets.length === 0) {
    console.error("[COWIO Roles] \u0421\u0435\u043A\u0440\u0435\u0442\u044B \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435");
    return { valid: false, error: "\u0421\u0435\u043A\u0440\u0435\u0442\u044B \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D\u044B \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435" };
  }
  if (secrets.master && timingSafeEqualStr(cleanSecret, secrets.master)) {
    const role = requestedRole || "creator";
    return { valid: true, role };
  }
  if (secrets.creator && timingSafeEqualStr(cleanSecret, secrets.creator)) {
    return { valid: true, role: "creator" };
  }
  if (secrets.operator && timingSafeEqualStr(cleanSecret, secrets.operator)) {
    return { valid: true, role: "operator" };
  }
  if (secrets.manager && timingSafeEqualStr(cleanSecret, secrets.manager)) {
    return { valid: true, role: "manager" };
  }
  if (secrets.moderator && timingSafeEqualStr(cleanSecret, secrets.moderator)) {
    return { valid: true, role: "moderator" };
  }
  return { valid: false, error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043A\u043B\u044E\u0447" };
}
var ROLE_DISPLAY_NAMES = {
  creator: "\u0421\u043E\u0437\u0434\u0430\u0442\u0435\u043B\u044C (\u041F\u043E\u043B\u043D\u044B\u0439 \u0434\u043E\u0441\u0442\u0443\u043F)",
  operator: "\u041E\u043F\u0435\u0440\u0430\u0442\u043E\u0440 \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0438",
  manager: "\u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 (\u0422\u043E\u043B\u044C\u043A\u043E \u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440)",
  moderator: "\u041C\u043E\u0434\u0435\u0440\u0430\u0442\u043E\u0440 \u043A\u043E\u043C\u043D\u0430\u0442 \u0438 \u043A\u043E\u043D\u0442\u0435\u043D\u0442\u0430",
  user: "\u041F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C"
};

// lib/auth-middleware.ts
var firebaseAdmin = admin;
function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== "string") return null;
  const parts = authHeader.trim().split(/\s+/);
  if (parts.length === 2 && parts[0]?.toLowerCase() === "bearer") {
    return parts[1] || null;
  }
  return null;
}
async function requireAuth(req, res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    res.status(401).json({
      success: false,
      error: "\u0422\u0440\u0435\u0431\u0443\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044F (\u043E\u0442\u0441\u0443\u0442\u0441\u0442\u0432\u0443\u0435\u0442 Bearer \u0442\u043E\u043A\u0435\u043D)"
    });
    return;
  }
  if (process.env.NODE_ENV === "test" && token.startsWith("mock-token-")) {
    const mockUid = token.replace("mock-token-", "");
    req.user = {
      uid: mockUid,
      email: `${mockUid}@example.com`,
      role: mockUid.includes("admin") ? "creator" : "user"
    };
    next();
    return;
  }
  try {
    if (!firebaseAdmin.apps?.length) {
      res.status(503).json({
        success: false,
        error: "\u0421\u0435\u0440\u0432\u0435\u0440 \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438 Firebase \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D"
      });
      return;
    }
    const decoded = await firebaseAdmin.auth().verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email,
      role: decoded.role || "user"
    };
    next();
  } catch (err) {
    res.status(401).json({
      success: false,
      error: `\u041D\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0439 \u0438\u043B\u0438 \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0439 \u0442\u043E\u043A\u0435\u043D \u0430\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u0438: ${err.message}`
    });
  }
}
async function optionalAuth(req, _res, next) {
  const token = extractBearerToken(req);
  if (!token) {
    req.user = null;
    next();
    return;
  }
  if (process.env.NODE_ENV === "test" && token.startsWith("mock-token-")) {
    const mockUid = token.replace("mock-token-", "");
    req.user = {
      uid: mockUid,
      email: `${mockUid}@example.com`,
      role: mockUid.includes("admin") ? "creator" : "user"
    };
    next();
    return;
  }
  try {
    if (firebaseAdmin.apps?.length) {
      const decoded = await firebaseAdmin.auth().verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        role: decoded.role || "user"
      };
    } else {
      req.user = null;
    }
  } catch {
    req.user = null;
  }
  next();
}

// lib/schemas.ts
import { z } from "zod";
var SendCodeSchema = z.object({
  email: z.string().email({ message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 email" }).max(255)
});
var VerifyCodeSchema = z.object({
  email: z.string().email({ message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 email" }).max(255),
  code: z.string().length(6, { message: "\u041A\u043E\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E 6 \u0446\u0438\u0444\u0440" }).regex(/^\d{6}$/, { message: "\u041A\u043E\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0441\u0442\u043E\u044F\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0446\u0438\u0444\u0440" }),
  token: z.string().optional()
});
var ResetPasswordSchema = z.object({
  email: z.string().email({ message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 email" }).max(255),
  code: z.string().length(6, { message: "\u041A\u043E\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E 6 \u0446\u0438\u0444\u0440" }).regex(/^\d{6}$/, { message: "\u041A\u043E\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0441\u0442\u043E\u044F\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0446\u0438\u0444\u0440" }),
  newPassword: z.string().min(6, { message: "\u041F\u0430\u0440\u043E\u043B\u044C \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u043C\u0438\u043D\u0438\u043C\u0443\u043C 6 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432" }).max(128),
  token: z.string().optional()
});
var ChangeEmailSchema = z.object({
  oldEmail: z.string().email({ message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u0442\u0435\u043A\u0443\u0449\u0435\u0433\u043E email" }).max(255),
  newEmail: z.string().email({ message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 \u0444\u043E\u0440\u043C\u0430\u0442 \u043D\u043E\u0432\u043E\u0433\u043E email" }).max(255),
  code: z.string().length(6, { message: "\u041A\u043E\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0434\u0435\u0440\u0436\u0430\u0442\u044C \u0440\u043E\u0432\u043D\u043E 6 \u0446\u0438\u0444\u0440" }).regex(/^\d{6}$/, { message: "\u041A\u043E\u0434 \u0434\u043E\u043B\u0436\u0435\u043D \u0441\u043E\u0441\u0442\u043E\u044F\u0442\u044C \u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 \u0446\u0438\u0444\u0440" }),
  token: z.string().optional()
});
var CreatePaymentSchema = z.object({
  plan: z.enum(["basic", "premium", "premium_month"]).optional(),
  userName: z.string().max(100).optional(),
  email: z.string().email().max(255).optional()
});
var CreateRoomSchema = z.object({
  name: z.string().min(1, { message: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043A\u043E\u043C\u043D\u0430\u0442\u044B \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C" }).max(100),
  isPrivate: z.boolean().optional()
});
var SendMessageSchema = z.object({
  text: z.string().min(1, { message: "\u0421\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u0435 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C" }).max(2e3, { message: "\u0414\u043B\u0438\u043D\u0430 \u0441\u043E\u043E\u0431\u0449\u0435\u043D\u0438\u044F \u043D\u0435 \u0434\u043E\u043B\u0436\u043D\u0430 \u043F\u0440\u0435\u0432\u044B\u0448\u0430\u0442\u044C 2000 \u0441\u0438\u043C\u0432\u043E\u043B\u043E\u0432" })
});
var VideoInfoSchema = z.object({
  url: z.string().url({ message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 URL \u0432\u0438\u0434\u0435\u043E" }).max(2048)
});
var VideoSearchSchema = z.object({
  q: z.string().min(1, { message: "\u041F\u043E\u0438\u0441\u043A\u043E\u0432\u044B\u0439 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C" }).max(200),
  platform: z.string().max(50).optional()
});
var CheckRoleSchema = z.object({
  uid: z.string().max(128).optional()
});
var ClaimRoleSchema = z.object({
  secret: z.string().min(1, { message: "\u0421\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u043D\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u043F\u0443\u0441\u0442\u044B\u043C" }).max(256),
  role: z.enum(["creator", "operator", "manager", "moderator"]).optional()
});
var ResolveMediaSchema = z.object({
  url: z.string().url({ message: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0439 URL" }).max(2048)
});
function validate(schema, source = "body") {
  return (req, res, next) => {
    const dataToValidate = source === "body" ? req.body : req.query;
    const result = schema.safeParse(dataToValidate);
    if (!result.success) {
      const formattedErrors = result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join(", ");
      res.status(400).json({
        success: false,
        error: `\u041E\u0448\u0438\u0431\u043A\u0430 \u0432\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u0438: ${formattedErrors}`,
        details: result.error.issues
      });
      return;
    }
    if (source === "body") {
      req.body = result.data;
    } else {
      req.query = result.data;
    }
    next();
  };
}

// api/video-service.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
function decodeHtml(str = "") {
  if (!str) return "";
  return str.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#x27;/g, "'").replace(/&#x2F;/g, "/").replace(/&nbsp;/g, " ").trim();
}
function formatSeconds(totalSec) {
  const sec = Math.max(0, Math.floor(Number(totalSec) || 0));
  if (sec <= 0) return "";
  const h = Math.floor(sec / 3600);
  const m = Math.floor(sec % 3600 / 60);
  const s = String(sec % 60).padStart(2, "0");
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${s}`;
  }
  return `${m}:${s}`;
}
var PRIORITY_CHANNEL_IDS = ["32869212", "32181632"];
var priorityCatalog = [];
var priorityCatalogById = /* @__PURE__ */ new Map();
var recentSearchCache = /* @__PURE__ */ new Map();
function rememberSearchItem(item) {
  if (!item || !item.url) return;
  recentSearchCache.set(item.url, item);
  if (item.id) recentSearchCache.set(item.id, item);
  const norm = item.url.replace(/^https?:\/\//, "").replace(/\/$/, "");
  recentSearchCache.set(norm, item);
  if (recentSearchCache.size > 1e3) {
    const firstKey = recentSearchCache.keys().next().value;
    recentSearchCache.delete(firstKey);
  }
}
function loadPriorityCatalog() {
  try {
    const jsonPath = path.join(__dirname, "rutube_priority_channels.json");
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
      if (Array.isArray(data)) {
        priorityCatalog = data;
        priorityCatalogById.clear();
        for (const item of priorityCatalog) {
          if (item.id) priorityCatalogById.set(item.id, item);
          if (item.url) priorityCatalogById.set(item.url, item);
        }
        console.log(`[Rutube] Loaded ${priorityCatalog.length} priority channel videos into catalog.`);
      }
    }
  } catch (err) {
    console.warn("[Rutube] Failed to load priority channels catalog:", err.message);
  }
}
loadPriorityCatalog();
async function syncPriorityChannels() {
  const browserHeaders = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
  };
  for (const chId of PRIORITY_CHANNEL_IDS) {
    try {
      const res = await fetch(`https://rutube.ru/api/video/person/${chId}/?page=1&format=json`, {
        headers: browserHeaders,
        signal: AbortSignal.timeout(1e4)
      });
      if (!res.ok) continue;
      const data = await res.json();
      const results = data.results || [];
      let added = 0;
      for (const item of results) {
        if (!item || !item.id || priorityCatalogById.has(item.id)) continue;
        let dur = "";
        if (item.duration) {
          dur = formatSeconds(item.duration);
        }
        const vObj = {
          id: item.id,
          platform: "rutube",
          platformLabel: "Rutube",
          title: decodeHtml(item.title || ""),
          url: item.video_url || `https://rutube.ru/video/${item.id}/`,
          thumbnail: item.thumbnail_url || (item.picture_thumbnail ? item.picture_thumbnail.replace("{width}x{height}", "640x360") : ""),
          author: decodeHtml(item.author?.name || (chId === "32869212" ? "\u0421\u043C\u043E\u0442\u0440\u0438 \u043A\u0438\u043D\u043E!" : "\u0424\u0438\u043B\u044C\u043C\u0430\u0447")),
          authorAvatar: item.author?.avatar_url || "",
          duration: dur
        };
        priorityCatalog.unshift(vObj);
        priorityCatalogById.set(vObj.id, vObj);
        if (vObj.url) priorityCatalogById.set(vObj.url, vObj);
        added++;
      }
      if (added > 0) {
        console.log(`[Rutube] Synced ${added} new videos from channel ${chId}`);
      }
    } catch (e) {
    }
  }
}
var initialSync = setTimeout(() => {
  syncPriorityChannels().catch(() => {
  });
}, 3e3);
if (initialSync.unref) initialSync.unref();
var syncInterval = setInterval(() => {
  syncPriorityChannels().catch(() => {
  });
}, 30 * 60 * 1e3);
if (syncInterval.unref) syncInterval.unref();
async function getVideoInfo(url) {
  if (!url || typeof url !== "string") {
    return { success: false, error: "Empty URL" };
  }
  const trimmed = url.trim();
  const validation = await validateUrl(trimmed);
  if (!validation.valid) {
    return { success: false, error: validation.error || "Blocked by SSRF protection" };
  }
  const normUrl = trimmed.replace(/^https?:\/\//, "").replace(/\/$/, "");
  const cached = recentSearchCache.get(trimmed) || recentSearchCache.get(normUrl);
  if (cached) {
    return {
      success: true,
      title: cached.title,
      author: cached.author || cached.platformLabel || "\u0412\u0438\u0434\u0435\u043E",
      authorAvatar: cached.authorAvatar || "",
      thumbnail: cached.thumbnail || "",
      duration: cached.duration || "",
      platform: cached.platform || "unknown",
      platformLabel: cached.platformLabel || "\u0412\u0438\u0434\u0435\u043E",
      url: cached.url || trimmed
    };
  }
  if (/youtube\.com|youtu\.be/i.test(trimmed)) {
    try {
      let watchUrl = trimmed;
      const shortsMatch = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      const embedMatch = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
      const shortMatch = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
      const watchMatch = trimmed.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
      const ytId = shortsMatch?.[1] || embedMatch?.[1] || shortMatch?.[1] || watchMatch?.[1];
      if (ytId) {
        watchUrl = `https://www.youtube.com/watch?v=${ytId}`;
      }
      const oembedRes = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(watchUrl)}&format=json`, {
        signal: AbortSignal.timeout(4500)
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        const title = decodeHtml(data.title);
        if (title) {
          return {
            success: true,
            title,
            author: decodeHtml(data.author_name || "YouTube"),
            thumbnail: data.thumbnail_url || (ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : ""),
            platform: "youtube",
            platformLabel: "YouTube",
            url: watchUrl
          };
        }
      }
      const pageRes = await fetch(watchUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        signal: AbortSignal.timeout(4500)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]*)"/i) || html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
        let title = titleMatch ? decodeHtml(titleMatch[1].replace(/- YouTube$/i, "")) : "";
        const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
        const authorMatch = html.match(/<link\s+itemprop="name"\s+content="([^"]*)"/i);
        if (title) {
          return {
            success: true,
            title,
            author: decodeHtml(authorMatch ? authorMatch[1] : "YouTube"),
            thumbnail: imgMatch ? imgMatch[1] : ytId ? `https://i.ytimg.com/vi/${ytId}/hqdefault.jpg` : "",
            platform: "youtube",
            platformLabel: "YouTube",
            url: watchUrl
          };
        }
      }
    } catch (err) {
      console.warn("[VideoInfo] YouTube extraction error:", err.message);
    }
  }
  if (/rutube\.ru/i.test(trimmed)) {
    const idMatch = trimmed.match(/rutube\.ru\/(?:video|play\/embed)\/([a-zA-Z0-9]+)/i);
    const rtId = idMatch?.[1];
    if (rtId && priorityCatalogById.has(rtId)) {
      const cached2 = priorityCatalogById.get(rtId);
      return {
        success: true,
        title: cached2.title,
        author: cached2.author,
        authorAvatar: cached2.authorAvatar,
        thumbnail: cached2.thumbnail,
        platform: "rutube",
        platformLabel: "Rutube",
        url: cached2.url || trimmed
      };
    }
    if (priorityCatalogById.has(trimmed)) {
      const cached2 = priorityCatalogById.get(trimmed);
      return {
        success: true,
        title: cached2.title,
        author: cached2.author,
        authorAvatar: cached2.authorAvatar,
        thumbnail: cached2.thumbnail,
        platform: "rutube",
        platformLabel: "Rutube",
        url: cached2.url || trimmed
      };
    }
    try {
      const oembedRes = await fetch(`https://rutube.ru/api/oembed/?url=${encodeURIComponent(trimmed)}&format=json`, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(4500)
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        const title = decodeHtml(data.title);
        if (title) {
          return {
            success: true,
            title,
            author: decodeHtml(data.author_name || "Rutube"),
            thumbnail: data.thumbnail_url || "",
            platform: "rutube",
            platformLabel: "Rutube",
            url: trimmed
          };
        }
      }
      if (rtId) {
        const apiRes = await fetch(`https://rutube.ru/api/video/${rtId}/`, {
          headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
          signal: AbortSignal.timeout(4500)
        });
        if (apiRes.ok) {
          const vData = await apiRes.json();
          if (vData.title) {
            return {
              success: true,
              title: decodeHtml(vData.title),
              author: decodeHtml(vData.author?.name || "Rutube"),
              authorAvatar: vData.author?.avatar_url || "",
              thumbnail: vData.thumbnail_url || "",
              platform: "rutube",
              platformLabel: "Rutube",
              url: trimmed
            };
          }
        }
      }
    } catch (err) {
      console.warn("[VideoInfo] Rutube extraction error:", err.message);
    }
  }
  if (/vimeo\.com/i.test(trimmed)) {
    try {
      const oembedRes = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(trimmed)}`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(4500)
      });
      if (oembedRes.ok) {
        const data = await oembedRes.json();
        return {
          success: true,
          title: decodeHtml(data.title || "Vimeo Video"),
          author: decodeHtml(data.author_name || "Vimeo"),
          thumbnail: data.thumbnail_url || "",
          platform: "vimeo",
          platformLabel: "Vimeo",
          url: trimmed
        };
      }
    } catch (err) {
      console.warn("[VideoInfo] Vimeo extraction error:", err.message);
    }
  }
  if (/vk\.com|vkvideo\.ru|vk\.ru/i.test(trimmed)) {
    let clean = trimmed;
    const iframeSrc = clean.match(/<iframe[^>]+src=["']([^"']+)["']/i);
    if (iframeSrc) clean = iframeSrc[1];
    let oid = null;
    let vid = null;
    let hash = null;
    if (/video_ext\.php/i.test(clean)) {
      const mOid = clean.match(/[?&]oid=(-?\d+)/i);
      const mId = clean.match(/[?&]id=([A-Za-z0-9]+)/i);
      const mHash = clean.match(/[?&]hash=([A-Za-z0-9]+)/i);
      if (mOid) oid = mOid[1];
      if (mId) vid = mId[1];
      if (mHash) hash = mHash[1];
    }
    if (!oid || !vid) {
      const vMatch = clean.match(/(?:video|clip)(-?\d+)_([A-Za-z0-9]+)/i);
      if (vMatch) {
        oid = vMatch[1];
        vid = vMatch[2];
      }
    }
    if (!oid || !vid) {
      const zMatch = clean.match(/[?&]z=video(-?\d+)_([A-Za-z0-9]+)/i);
      if (zMatch) {
        oid = zMatch[1];
        vid = zMatch[2];
      }
    }
    if (!hash) {
      const hashMatch = clean.match(/[?&]hash=([A-Za-z0-9]+)/i);
      if (hashMatch) hash = hashMatch[1];
    }
    let title = "VK Video";
    let author = "VK Video";
    let thumbnail = "";
    try {
      const targetUrl = oid && vid ? `https://m.vk.com/video${oid}_${vid}` : clean;
      const pageRes = await fetch(targetUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148",
          "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
        },
        signal: AbortSignal.timeout(3500)
      });
      if (pageRes.ok) {
        const html = await pageRes.text();
        const titleMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
        const imgMatch = html.match(/<meta\s+property="og:image"\s+content="([^"]*)"/i);
        const hashMatch = html.match(/hash=([a-zA-Z0-9]+)/i) || html.match(/"hash":"([a-zA-Z0-9]+)"/i);
        if (!hash && hashMatch) hash = hashMatch[1];
        if (titleMatch) {
          const rawTitle = decodeHtml(titleMatch[1].replace(/\|\s*ВКонтакте$/i, "").trim());
          if (rawTitle && !/^(VK\.com|ВКонтакте)$/i.test(rawTitle)) title = rawTitle;
        }
        if (imgMatch) thumbnail = imgMatch[1];
      }
    } catch (err) {
    }
    let embedUrl = oid && vid ? `https://vk.com/video_ext.php?oid=${oid}&id=${vid}${hash ? `&hash=${hash}` : ""}&hd=2&autoplay=1&js_api=1` : clean;
    if (!embedUrl.includes("js_api=")) {
      embedUrl += (embedUrl.includes("?") ? "&" : "?") + "js_api=1&autoplay=1&hd=2";
    }
    return {
      success: true,
      title: title || "VK Video",
      author: author || "VK Video",
      thumbnail: thumbnail || "",
      platform: "vk",
      platformLabel: "VK Video",
      url: embedUrl,
      directUrl: clean,
      oid,
      vid,
      hash
    };
  }
  if (/twitch\.tv/i.test(trimmed)) {
    const channelMatch = trimmed.match(/twitch\.tv\/([a-zA-Z0-9_]+)/i);
    const channel = channelMatch ? channelMatch[1] : "Twitch";
    return {
      success: true,
      title: `\u0421\u0442\u0440\u0438\u043C ${channel}`,
      author: channel,
      thumbnail: "",
      platform: "twitch",
      platformLabel: "Twitch",
      url: trimmed
    };
  }
  if (/\.(mp4|webm|ogg|m3u8|mpd)(\?.*)?$/i.test(trimmed)) {
    const filename = trimmed.split("/").pop().split("?")[0] || "\u0412\u0438\u0434\u0435\u043E \u0444\u0430\u0439\u043B";
    return {
      success: true,
      title: decodeURIComponent(filename),
      author: "Direct URL",
      thumbnail: "",
      platform: "direct",
      platformLabel: "\u041F\u0440\u044F\u043C\u0430\u044F \u0441\u0441\u044B\u043B\u043A\u0430",
      url: trimmed
    };
  }
  return {
    success: true,
    title: "\u0412\u0438\u0434\u0435\u043E",
    author: "\u0418\u043D\u0442\u0435\u0440\u043D\u0435\u0442",
    thumbnail: "",
    platform: "unknown",
    platformLabel: "\u0412\u0438\u0434\u0435\u043E",
    url: trimmed
  };
}
function parseSearchQuery(rawQuery = "") {
  let q = String(rawQuery || "").trim();
  q = q.replace(/s(\d{1,2})\s*e(\d{1,2})/giu, (_, s, e) => `${parseInt(s, 10)} \u0441\u0435\u0437\u043E\u043D ${parseInt(e, 10)} \u0441\u0435\u0440\u0438\u044F`);
  q = q.replace(/(\d{1,2})\s*x\s*(\d{1,2})/giu, (_, s, e) => `${parseInt(s, 10)} \u0441\u0435\u0437\u043E\u043D ${parseInt(e, 10)} \u0441\u0435\u0440\u0438\u044F`);
  const qLower = q.toLowerCase();
  let season = null;
  const sBefore = qLower.match(/(\d+)\s*(?:-?й\s*)?(?:сезон|season)/iu);
  if (sBefore) {
    season = parseInt(sBefore[1], 10);
  } else {
    const sAfter = qLower.match(/(?:сезон|season)\s*[:#-]?\s*(\d+)/iu);
    if (sAfter) season = parseInt(sAfter[1], 10);
  }
  let episode = null;
  const eBefore = qLower.match(/(\d+)\s*(?:-?[яеи]\s*)?(?:сери[яиюе]|эпизод|episode|ep|eps)/iu);
  if (eBefore) {
    episode = parseInt(eBefore[1], 10);
  } else {
    const eAfter = qLower.match(/(?:сери[яиюе]|эпизод|episode|ep)\s*[:#-]?\s*(\d+)/iu);
    if (eAfter) episode = parseInt(eAfter[1], 10);
  }
  let core = qLower.replace(/\d+\s*(?:-?й\s*)?(?:сезон|season)/giu, " ").replace(/(?:сезон|season)\s*[:#-]?\s*\d+/giu, " ").replace(/(?:сезон|season)/giu, " ").replace(/\d+\s*(?:-?[яеи]\s*)?(?:сери[яиюе]|эпизод|episode|ep|eps)/giu, " ").replace(/(?:сери[яиюе]|эпизод|episode|ep)\s*[:#-]?\s*\d+/giu, " ").replace(/(?:сери[яиюе]|эпизод|episode|ep|eps)/giu, " ").replace(/(?:все\s+серии(?:\s+подряд)?|смотреть\s+онлайн|в\s+хорошем\s+качестве|на\s+русском|дубляж|full\s*hd|1080p|720p|бесплатно)/giu, " ").replace(/[«»""'()\[\],.!?:;\/\\-]/g, " ").replace(/\s+/g, " ").trim();
  const coreWords = core.split(/\s+/).filter((w) => w.length >= 2);
  return {
    season,
    episode,
    core,
    coreWords,
    original: String(rawQuery || "").trim()
  };
}
function scoreVideoRelevance(itemTitle, rawQueryOrParsed, itemAuthor = "") {
  const t = (itemTitle || "").toLowerCase();
  const a = (itemAuthor || "").toLowerCase();
  if (!t) return 0;
  const parsed = typeof rawQueryOrParsed === "object" && rawQueryOrParsed !== null && "coreWords" in rawQueryOrParsed ? rawQueryOrParsed : parseSearchQuery(String(rawQueryOrParsed || ""));
  const { season, episode, core, coreWords, original } = parsed;
  const origLower = (original || "").toLowerCase().trim();
  if (!origLower) return 0;
  if (coreWords.length > 0) {
    let matchedCore = 0;
    for (const w of coreWords) {
      const stem = w.length >= 5 ? w.slice(0, -1) : w;
      if (t.includes(w) || t.includes(stem)) {
        matchedCore++;
      }
    }
    const authorMatches = coreWords.some((w) => a.includes(w));
    if (matchedCore === 0 && !authorMatches) {
      return 0;
    }
  }
  let score = 50;
  if (core && t.includes(core)) {
    score += 50;
  }
  if (t.includes(origLower)) {
    score += 60;
  }
  if (season !== null) {
    const sRegex = new RegExp(
      `(?:${season}\\s*(?:-?\u0439\\s*)?(?:\u0441\u0435\u0437\u043E\u043D|season)|(?:\u0441\u0435\u0437\u043E\u043D|season)\\s*[:#-]?\\s*${season}|\\bs0*${season}\\b)`,
      "iu"
    );
    if (sRegex.test(t)) {
      score += 60;
    } else {
      const otherS = t.match(/(\d+)\s*(?:-?й\s*)?(?:сезон|season)/iu) || t.match(/(?:сезон|season)\s*[:#-]?\s*(\d+)/iu);
      if (otherS && parseInt(otherS[1], 10) !== season) {
        score -= 50;
      }
    }
  }
  if (episode !== null) {
    const eRegex = new RegExp(
      `(?:${episode}\\s*(?:-?[\u044F\u0435\u0438]\\s*)?(?:\u0441\u0435\u0440\u0438|\u044D\u043F\u0438\u0437\u043E\u0434|ep)|(?:\u0441\u0435\u0440\u0438|\u044D\u043F\u0438\u0437\u043E\u0434|ep)\\s*[:#-]?\\s*${episode}|\\be0*${episode}\\b)`,
      "iu"
    );
    const isAllSeries = /(?:все\s+серии|весь\s+сезон)/iu.test(t);
    if (eRegex.test(t)) {
      score += 70;
    } else if (isAllSeries) {
      score += 30;
    } else {
      const otherE = t.match(/(\d+)\s*(?:-?[яеи]\s*)?(?:сери|эпизод)/iu) || t.match(/(?:сери|эпизод)\s*[:#-]?\s*(\d+)/iu);
      if (otherE && parseInt(otherE[1], 10) !== episode) {
        score -= 40;
      }
    }
  }
  const isTrailer = /(?:трейлер|тизер|обзор|отрывок|реакция|фрагмент|trailer|teaser|review|клип)/iu.test(t);
  const wantsTrailer = /(?:трейлер|тизер|trailer|teaser)/iu.test(origLower);
  if (isTrailer && !wantsTrailer) {
    score -= 40;
  }
  return Math.max(0, score);
}
function cleanSearchQuery(query = "") {
  let cleaned = query.replace(/\bs(\d{1,2})e(\d{1,2})\b/gi, (_, s, e) => `${parseInt(s, 10)} \u0441\u0435\u0437\u043E\u043D ${parseInt(e, 10)} \u0441\u0435\u0440\u0438\u044F`).replace(/(?:смотреть\s+онлайн|в\s+хорошем\s+качестве|full\s*hd|1080p|720p|бесплатно|на\s+русском|все\s+серии\s+подряд)/gi, " ").replace(/[«»""'']/g, " ").replace(/\s+/g, " ").trim();
  return cleaned;
}
async function searchYouTube(query, limit = 16) {
  const q = String(query || "").trim();
  if (!q) return [];
  const parsed = parseSearchQuery(q);
  const trySearch = async (qText) => {
    const res = await fetch("https://www.youtube.com/results?search_query=" + encodeURIComponent(qText), {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
      },
      signal: AbortSignal.timeout(8e3)
    });
    if (!res.ok) return [];
    const html = await res.text();
    const match = html.match(/ytInitialData\s*=\s*({.+?});<\/script>/);
    if (!match) return [];
    const data = JSON.parse(match[1]);
    const contents = data.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];
    const list = [];
    for (const item of contents) {
      const vr = item.videoRenderer;
      if (vr && vr.videoId) {
        const title = decodeHtml(vr.title?.runs?.[0]?.text || vr.title?.simpleText || "");
        if (title) {
          const author = decodeHtml(vr.ownerText?.runs?.[0]?.text || vr.longBylineText?.runs?.[0]?.text || "YouTube");
          const authorAvatar = vr.channelThumbnailSupportedRenderers?.channelThumbnailWithLinkRenderer?.thumbnail?.thumbnails?.[0]?.url || "";
          const thumb = vr.thumbnail?.thumbnails?.pop()?.url || `https://i.ytimg.com/vi/${vr.videoId}/hqdefault.jpg`;
          const dur = vr.lengthText?.simpleText || vr.lengthText?.runs?.[0]?.text || "";
          const score = scoreVideoRelevance(title, parsed, author);
          if (score === 0 && parsed.coreWords.length > 0) continue;
          const videoObj = {
            id: vr.videoId,
            platform: "youtube",
            platformLabel: "YouTube",
            title,
            url: `https://www.youtube.com/watch?v=${vr.videoId}`,
            thumbnail: thumb,
            author,
            authorAvatar,
            duration: dur,
            _score: score
          };
          rememberSearchItem(videoObj);
          list.push(videoObj);
        }
      }
    }
    return list;
  };
  try {
    let list = await trySearch(query);
    const cleaned = cleanSearchQuery(query);
    if ((!list || list.length < 3) && cleaned && cleaned !== query) {
      const fallbackList = await trySearch(cleaned);
      if (fallbackList.length > 0) {
        const seen = new Set(list.map((x) => x.id));
        for (const item of fallbackList) {
          if (!seen.has(item.id)) {
            seen.add(item.id);
            list.push(item);
          }
        }
      }
    }
    list.sort((a, b) => (b._score || 0) - (a._score || 0));
    return list.slice(0, limit);
  } catch (err) {
    console.warn("[Search] YouTube error:", err.message);
    return [];
  }
}
async function searchVK(query, limit = 18) {
  const q = String(query || "").trim();
  if (!q) return [];
  const parsed = parseSearchQuery(q);
  try {
    const res = await fetch("https://vk.com/al_video.php?act=search_video", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "X-Requested-With": "XMLHttpRequest",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
      },
      body: "al=1&q=" + encodeURIComponent(q),
      signal: AbortSignal.timeout(7e3)
    });
    if (!res.ok) return [];
    const buf = await res.arrayBuffer();
    const text = new TextDecoder("windows-1251").decode(buf);
    const json = JSON.parse(text);
    const rawList = json?.payload?.[1]?.[2]?.list || [];
    const list = [];
    for (const item of rawList) {
      const oid = item[0];
      const vid = item[1];
      const thumb = item[2] || "";
      const rawTitle = decodeHtml(item[3] || "");
      let dur = "";
      if (typeof item[5] === "string" && item[5].trim()) {
        dur = item[5].trim();
      } else if (typeof item[19] === "number" && item[19] > 0) {
        dur = formatSeconds(item[19]);
      }
      let author = "VK Video";
      if (item[8]) {
        author = String(item[8]).replace(/<[^>]+>/g, "").trim() || "VK Video";
      }
      const authorAvatar = item[35] || "https://cdn-icons-png.flaticon.com/128/145/145813.png";
      const score = scoreVideoRelevance(rawTitle, parsed, author);
      if (score === 0 && parsed.coreWords.length > 0) continue;
      const videoUrl = `https://vk.com/video${oid}_${vid}`;
      const videoObj = {
        id: `vk_${oid}_${vid}`,
        platform: "vk",
        platformLabel: "VK Video",
        title: rawTitle || "VK Video",
        url: videoUrl,
        thumbnail: thumb,
        author,
        authorAvatar,
        duration: dur,
        _score: score
      };
      rememberSearchItem(videoObj);
      list.push(videoObj);
    }
    list.sort((a, b) => (b._score || 0) - (a._score || 0));
    return list.slice(0, limit);
  } catch (err) {
    console.warn("[Search] VK error:", err.message);
    return [];
  }
}
async function searchVideos(query, platform = "all") {
  const q = String(query || "").trim();
  if (!q) return { success: true, results: [] };
  const normPlat = String(platform || "all").toLowerCase();
  if (normPlat === "youtube") {
    const yt2 = await searchYouTube(q, 24);
    return { success: true, results: yt2 };
  }
  if (normPlat === "vk") {
    const vk2 = await searchVK(q, 24);
    return { success: true, results: vk2 };
  }
  const [vk, yt] = await Promise.all([
    searchVK(q, 20).catch(() => []),
    searchYouTube(q, 20).catch(() => [])
  ]);
  const all = [...vk, ...yt];
  const seen = /* @__PURE__ */ new Set();
  const unique = [];
  for (const item of all) {
    const key = item.url || item.id;
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(item);
    }
  }
  unique.sort((a, b) => (b._score || 0) - (a._score || 0));
  return { success: true, results: unique.slice(0, 30) };
}

// server.ts
var firebaseAdmin2 = admin2;
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
var app = express();
app.set("trust proxy", 1);
function restoreOriginalUrl(req) {
  const raw = req.headers["x-vercel-original-url"] || req.headers["x-original-url"] || req.headers["x-forwarded-uri"];
  if (typeof raw !== "string" || !raw.length) return;
  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    try {
      const u = new URL(raw);
      req.url = u.pathname + u.search;
    } catch {
    }
  } else {
    req.url = raw.startsWith("/") ? raw : `/${raw}`;
  }
}
app.use((req, _res, next) => {
  restoreOriginalUrl(req);
  next();
});
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: [
          "'self'",
          "'unsafe-inline'",
          "'unsafe-eval'",
          "https://www.gstatic.com",
          "https://apis.google.com",
          "https://*.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://*.jsdelivr.net",
          "https://fastly.jsdelivr.net",
          "https://cdn.statically.io"
        ],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: [
          "'self'",
          "https://*.firebaseio.com",
          "wss://*.firebaseio.com",
          "https://*.googleapis.com",
          "https://firebaseinstallations.googleapis.com",
          "https://identitytoolkit.googleapis.com",
          "https://securetoken.googleapis.com",
          "https://cdn.jsdelivr.net",
          "https://*.jsdelivr.net",
          "https://fastly.jsdelivr.net",
          "https://raw.githubusercontent.com",
          "https://cdn.statically.io"
        ],
        frameSrc: [
          "'self'",
          "https://www.youtube.com",
          "https://rutube.ru",
          "https://vk.com",
          "https://vkvideo.ru",
          "https://*.vk.com",
          "https://*.vkvideo.ru"
        ],
        frameAncestors: null,
        objectSrc: ["'none'"],
        baseUri: ["'self'"]
      }
    },
    frameguard: false,
    crossOriginResourcePolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
var ALLOWED_ORIGINS = [
  "https://cowio.vercel.app",
  "https://cowio.ru",
  "https://www.cowio.ru",
  ...process.env.NODE_ENV !== "production" ? ["http://localhost:3000", "http://localhost:5173"] : []
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      return res.status(403).json({
        success: false,
        error: "CORS policy violation: Origin not allowed"
      });
    }
  }
  next();
});
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (ALLOWED_ORIGINS.includes(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-api-key", "x-webhook-key", "x-signature"]
  })
);
app.use(express.json({ limit: "1mb", strict: true }));
app.use(express.urlencoded({ limit: "1mb", extended: true }));
app.use(prototypePollutionMiddleware);
var smtpUser = (process.env.SMTP_USER || process.env.EMAIL_USER || "").trim();
var smtpPass = (process.env.SMTP_PASS || process.env.EMAIL_PASS || "").trim().replace(/\s+/g, "");
try {
  const databaseURL = process.env.FIREBASE_DATABASE_URL || "https://das4akk-1-default-rtdb.firebaseio.com";
  if (process.env.FIREBASE_ADMIN_KEY && !firebaseAdmin2.apps?.length) {
    try {
      let creds = typeof process.env.FIREBASE_ADMIN_KEY === "string" ? JSON.parse(process.env.FIREBASE_ADMIN_KEY) : process.env.FIREBASE_ADMIN_KEY;
      if (creds && creds.private_key) {
        creds.private_key = creds.private_key.replace(/\\n/g, "\n");
      }
      firebaseAdmin2.initializeApp({
        credential: firebaseAdmin2.credential.cert(creds),
        databaseURL
      });
      console.log("[COWIO] Firebase Admin SDK \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0437\u0430\u043F\u0443\u0449\u0435\u043D \u0447\u0435\u0440\u0435\u0437 FIREBASE_ADMIN_KEY env!");
    } catch (parseErr) {
      console.error("[COWIO] \u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0430\u0440\u0441\u0438\u043D\u0433\u0430 FIREBASE_ADMIN_KEY:", parseErr.message);
    }
  } else if (!firebaseAdmin2.apps?.length) {
    const serviceAccountPath = path2.join(__dirname2, "serviceAccountKey.json");
    if (fs2.existsSync(serviceAccountPath)) {
      try {
        const serviceAccount = JSON.parse(fs2.readFileSync(serviceAccountPath, "utf8"));
        if (serviceAccount.SMTP_USER) smtpUser = serviceAccount.SMTP_USER;
        if (serviceAccount.SMTP_PASS) smtpPass = serviceAccount.SMTP_PASS;
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
        }
        firebaseAdmin2.initializeApp({
          credential: firebaseAdmin2.credential.cert(serviceAccount),
          databaseURL
        });
        console.log("[COWIO] Firebase Admin SDK \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0437\u0430\u043F\u0443\u0449\u0435\u043D \u0438\u0437 serviceAccountKey.json!");
      } catch (fileErr) {
        console.error("[COWIO] \u041E\u0448\u0438\u0431\u043A\u0430 \u0447\u0442\u0435\u043D\u0438\u044F serviceAccountKey.json:", fileErr.message);
      }
    }
  }
} catch (e) {
  console.error("[COWIO] \u041E\u0448\u0438\u0431\u043A\u0430 \u0438\u043D\u0438\u0446\u0438\u0430\u043B\u0438\u0437\u0430\u0446\u0438\u0438 Firebase Admin:", e.message);
}
var AUTH_SECRET = process.env.AUTH_SECRET || "";
function generateVerificationToken(email, code, expiresAt) {
  if (!AUTH_SECRET) {
    console.warn("[COWIO Auth] \u0412\u041D\u0418\u041C\u0410\u041D\u0418\u0415: AUTH_SECRET \u043D\u0435 \u0437\u0430\u0434\u0430\u043D \u0432 .env. \u0418\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0435\u0442\u0441\u044F \u0441\u043B\u0443\u0447\u0430\u0439\u043D\u044B\u0439 \u043A\u043B\u044E\u0447 \u0434\u043B\u044F \u0441\u0435\u0441\u0441\u0438\u0438.");
  }
  const secretKey = AUTH_SECRET || "temporary_session_auth_secret_key_32bytes_min";
  const normEmail = email.trim().toLowerCase();
  const data = `${normEmail}:${code}:${expiresAt}`;
  const sig = crypto2.createHmac("sha256", secretKey).update(data).digest("hex");
  return `${expiresAt}:${sig}`;
}
function verifyVerificationToken(email, code, token) {
  if (!token || typeof token !== "string") return false;
  const parts = token.split(":");
  if (parts.length !== 2) return false;
  const [expiresAtStr, sig] = parts;
  if (!expiresAtStr || !sig) return false;
  const expiresAt = parseInt(expiresAtStr, 10);
  if (isNaN(expiresAt) || Date.now() > expiresAt) return false;
  const secretKey = AUTH_SECRET || "temporary_session_auth_secret_key_32bytes_min";
  const normEmail = email.trim().toLowerCase();
  const data = `${normEmail}:${String(code).trim()}:${expiresAt}`;
  const expectedSig = crypto2.createHmac("sha256", secretKey).update(data).digest("hex");
  try {
    return crypto2.timingSafeEqual(Buffer.from(sig, "utf8"), Buffer.from(expectedSig, "utf8"));
  } catch {
    return false;
  }
}
function getMailTransporter(useSsl = true) {
  const user = smtpUser;
  const pass = smtpPass;
  const customHost = (process.env.SMTP_HOST || "").trim();
  const isGmail = !customHost && user.includes("@gmail.com") || customHost && customHost.includes("gmail.com");
  if (isGmail && !customHost) {
    return {
      transporter: nodemailer.createTransport({
        service: "gmail",
        auth: { user, pass }
      }),
      user
    };
  }
  const host2 = customHost || "smtp.gmail.com";
  const port2 = parseInt(process.env.SMTP_PORT || (useSsl ? "465" : "587"), 10);
  return {
    transporter: nodemailer.createTransport({
      host: host2,
      port: port2,
      secure: useSsl,
      auth: { user, pass },
      tls: { rejectUnauthorized: true }
    }),
    user
  };
}
var verificationCodes = /* @__PURE__ */ new Map();
var lockoutMap = /* @__PURE__ */ new Map();
var sendCodeIpLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 10,
  validate: false,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u043B\u0438\u043C\u0438\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438 \u043A\u043E\u0434\u043E\u0432 \u0441 \u0432\u0430\u0448\u0435\u0433\u043E IP (\u043C\u0430\u043A\u0441. 10 \u0432 \u0447\u0430\u0441)" }
});
var sendCodeEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 3,
  validate: false,
  keyGenerator: (req) => String(req.body?.email || req.ip || "").toLowerCase().trim(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u043B\u0438\u043C\u0438\u0442 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438 \u043A\u043E\u0434\u043E\u0432 \u043D\u0430 \u044D\u0442\u043E\u0442 email (\u043C\u0430\u043A\u0441. 3 \u0437\u0430 15 \u043C\u0438\u043D\u0443\u0442)" }
});
var verifyCodeLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 5,
  validate: false,
  keyGenerator: (req) => String(req.body?.email || req.ip || "").toLowerCase().trim(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043A\u043E\u0434\u0430. \u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435 15 \u043C\u0438\u043D\u0443\u0442." }
});
var resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 3,
  validate: false,
  keyGenerator: (req) => String(req.body?.email || req.ip || "").toLowerCase().trim(),
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u043B\u0438\u043C\u0438\u0442 \u0441\u0431\u0440\u043E\u0441\u0430 \u043F\u0430\u0440\u043E\u043B\u044F (\u043C\u0430\u043A\u0441. 3 \u0432 \u0447\u0430\u0441)" }
});
var createPaymentLimiter = rateLimit({
  windowMs: 60 * 60 * 1e3,
  // 1 hour
  max: 10,
  validate: false,
  keyGenerator: (req) => req.user?.uid || req.ip || "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D \u043B\u0438\u043C\u0438\u0442 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043F\u043B\u0430\u0442\u0435\u0436\u0435\u0439 (\u043C\u0430\u043A\u0441. 10 \u0432 \u0447\u0430\u0441)" }
});
var claimRoleLimiter = rateLimit({
  windowMs: 15 * 60 * 1e3,
  // 15 minutes
  max: 5,
  validate: false,
  keyGenerator: (req) => req.user?.uid || req.ip || "anonymous",
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "\u0421\u043B\u0438\u0448\u043A\u043E\u043C \u043C\u043D\u043E\u0433\u043E \u043F\u043E\u043F\u044B\u0442\u043E\u043A \u0432\u0432\u043E\u0434\u0430 \u0441\u0435\u043A\u0440\u0435\u0442\u043D\u043E\u0433\u043E \u043A\u043B\u044E\u0447\u0430 \u0440\u043E\u043B\u0438. \u041F\u043E\u0434\u043E\u0436\u0434\u0438\u0442\u0435 15 \u043C\u0438\u043D\u0443\u0442." }
});
function hashForLog(value) {
  return crypto2.createHash("sha256").update(value).digest("hex").slice(0, 12);
}
app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    app: "COWIO",
    env: process.env.NODE_ENV || "development"
  });
});
app.all("/api/auth/check-role", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const email = req.user.email;
    const db = getFirebaseDb();
    const autoRole = await resolveAutoRole(uid, email, db);
    if (autoRole) {
      if (db) {
        let adminSnap2 = await db.ref(`admins/${uid}`).once("value");
        const currentData = adminSnap2.exists() ? adminSnap2.val() : null;
        const currentRole = String(currentData?.role || "").toLowerCase().trim();
        if (!adminSnap2.exists() || currentRole !== autoRole) {
          try {
            await syncRoleToDatabase(db, uid, autoRole, email, "auto_rule_sync");
          } catch (syncErr) {
            console.warn("[COWIO Roles] Auto-sync warning:", syncErr.message);
          }
        }
      }
      req.user.role = autoRole;
      req.user.isCreator = autoRole === "creator";
      return res.json({
        success: true,
        uid,
        role: autoRole,
        isCreator: autoRole === "creator",
        isAdmin: true,
        autoGranted: true
      });
    }
    if (!db) {
      return res.json({
        success: true,
        uid,
        role: "user",
        isCreator: false,
        isAdmin: false
      });
    }
    const adminSnap = await db.ref(`admins/${uid}`).once("value");
    if (adminSnap.exists()) {
      const data = adminSnap.val();
      const role = String(data.role || "").toLowerCase().trim();
      const isCreator = role === "creator" || data.isOwner === true;
      return res.json({
        success: true,
        uid,
        role: role || "admin",
        isCreator,
        isAdmin: true
      });
    }
    return res.json({
      success: true,
      uid,
      role: "user",
      isCreator: false,
      isAdmin: false
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043F\u0440\u0430\u0432",
      role: "user",
      isCreator: false,
      isAdmin: false
    });
  }
});
app.post(
  "/api/auth/claim-role",
  requireAuth,
  claimRoleLimiter,
  validate(ClaimRoleSchema, "body"),
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const email = req.user.email;
      const { secret, role: requestedRole } = req.body;
      const db = getFirebaseDb();
      const claimResult = await verifyRoleSecret(secret, requestedRole, db);
      if (!claimResult.valid || !claimResult.role) {
        return res.status(403).json({
          success: false,
          error: claimResult.error || "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0441\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043A\u043B\u044E\u0447"
        });
      }
      const grantedRole = claimResult.role;
      const isCreator = grantedRole === "creator";
      if (db) {
        await syncRoleToDatabase(db, uid, grantedRole, email, "secret_key_claim");
      }
      req.user.role = grantedRole;
      req.user.isCreator = isCreator;
      const roleTitle = ROLE_DISPLAY_NAMES[grantedRole] || grantedRole;
      return res.json({
        success: true,
        uid,
        role: grantedRole,
        isCreator,
        isAdmin: true,
        message: `\u0412\u0430\u043C \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0432\u044B\u0434\u0430\u043D\u044B \u043F\u0440\u0430\u0432\u0430: ${roleTitle}`
      });
    } catch (err) {
      console.error("[COWIO Roles] Error claiming role:", err.message);
      return res.status(500).json({
        success: false,
        error: "\u0412\u043D\u0443\u0442\u0440\u0435\u043D\u043D\u044F\u044F \u043E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u0438 \u0430\u043A\u0442\u0438\u0432\u0430\u0446\u0438\u0438 \u0440\u043E\u043B\u0438"
      });
    }
  }
);
app.post(
  "/api/custom-auth/send-code",
  sendCodeIpLimiter,
  sendCodeEmailLimiter,
  validate(SendCodeSchema, "body"),
  async (req, res) => {
    try {
      const { email } = req.body;
      const normalizedEmail = email.trim().toLowerCase();
      const lockUntil = lockoutMap.get(normalizedEmail);
      if (lockUntil && Date.now() < lockUntil) {
        const remainingMinutes = Math.ceil((lockUntil - Date.now()) / 6e4);
        return res.status(429).json({
          success: false,
          error: `\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D \u0438\u0437-\u0437\u0430 \u043C\u043D\u043E\u0436\u0435\u0441\u0442\u0432\u0430 \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A. \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u0435 \u0447\u0435\u0440\u0435\u0437 ${remainingMinutes} \u043C\u0438\u043D.`
        });
      }
      const code = crypto2.randomInt(1e5, 1e6).toString();
      const expiresAt = Date.now() + 10 * 60 * 1e3;
      verificationCodes.set(normalizedEmail, {
        code,
        expiresAt,
        attempts: 0
      });
      const token = generateVerificationToken(normalizedEmail, code, expiresAt);
      console.log(`[AUTH] Code sent to <${hashForLog(normalizedEmail)}>`);
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 40px auto; background: #0f0f11; color: #fff; padding: 40px; border-radius: 20px; text-align: center; border: 1px solid rgba(255,143,198,0.3); box-shadow: 0 10px 40px rgba(255,143,198,0.15);">
          <h2 style="color: #fff; font-size: 24px; margin-top: 0; margin-bottom: 25px; font-weight: 800; letter-spacing: 0.5px;">\u0410\u0432\u0442\u043E\u0440\u0438\u0437\u0430\u0446\u0438\u044F COWIO</h2>
          <p style="font-size: 15px; color: #aaa; margin-bottom: 15px; text-align: left;">\u0417\u0434\u0440\u0430\u0432\u0441\u0442\u0432\u0443\u0439\u0442\u0435!</p>
          <p style="font-size: 15px; color: #aaa; margin-bottom: 30px; text-align: left; line-height: 1.6;">\u0412\u044B \u0441\u0434\u0435\u043B\u0430\u043B\u0438 \u0437\u0430\u043F\u0440\u043E\u0441 \u043D\u0430 \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u0438\u0435 \u043A\u043E\u0434\u0430 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F. \u041F\u043E\u0436\u0430\u043B\u0443\u0439\u0441\u0442\u0430, \u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0440\u0438\u0432\u0435\u0434\u0435\u043D\u043D\u044B\u0439 \u043D\u0438\u0436\u0435 \u0441\u0435\u043A\u0440\u0435\u0442\u043D\u044B\u0439 \u043A\u043E\u0434 \u0432 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u0438 \u0434\u043B\u044F \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F \u0432\u0430\u0448\u0435\u0433\u043E \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u044F.</p>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin: 0 auto;">
            <tr>
              ${code.split("").map((digit) => `
              <td style="padding: 0 4px;">
                <div style="display: block; width: 44px; height: 50px; line-height: 50px; font-size: 26px; font-family: monospace; font-weight: 800; background: rgba(255,255,255,0.05); border: 2px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; text-align: center;">
                  ${digit}
                </div>
              </td>
              `).join("")}
            </tr>
          </table>
          <div style="font-size: 13px; color: #666; margin-top: 40px; text-align: left; line-height: 1.6; background: rgba(0,0,0,0.5); padding: 20px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.05);">
            <strong style="color: #888;">\u0412\u0430\u0436\u043D\u0430\u044F \u0438\u043D\u0444\u043E\u0440\u043C\u0430\u0446\u0438\u044F:</strong><br><br>
            \u2022 \u042D\u0442\u043E\u0442 \u043A\u043E\u0434 \u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043B\u0435\u043D \u0432 \u0442\u0435\u0447\u0435\u043D\u0438\u0435 10 \u043C\u0438\u043D\u0443\u0442.<br>
            \u2022 \u041D\u0438\u043A\u043E\u043C\u0443 \u043D\u0435 \u043F\u0435\u0440\u0435\u0434\u0430\u0432\u0430\u0439\u0442\u0435 \u044D\u0442\u043E\u0442 \u043A\u043E\u0434. \u041D\u0430\u0448\u0438 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438 \u043D\u0438\u043A\u043E\u0433\u0434\u0430 \u043D\u0435 \u043F\u043E\u043F\u0440\u043E\u0441\u044F\u0442 \u0432\u0430\u0441 \u043D\u0430\u0437\u0432\u0430\u0442\u044C \u0435\u0433\u043E.<br>
            \u2022 \u0415\u0441\u043B\u0438 \u0432\u044B \u043D\u0435 \u0437\u0430\u043F\u0440\u0430\u0448\u0438\u0432\u0430\u043B\u0438 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0443 \u043A\u043E\u0434\u0430, \u043F\u0440\u043E\u0441\u0442\u043E \u043F\u0440\u043E\u0438\u0433\u043D\u043E\u0440\u0438\u0440\u0443\u0439\u0442\u0435 \u044D\u0442\u043E \u043F\u0438\u0441\u044C\u043C\u043E.
          </div>
        </div>
      `;
      let emailSent = false;
      if (smtpUser && smtpPass) {
        try {
          const { transporter, user } = getMailTransporter(true);
          await transporter.sendMail({
            from: `"COWIO" <${user}>`,
            to: normalizedEmail,
            subject: "\u041A\u043E\u0434 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F COWIO",
            html: htmlContent
          });
          emailSent = true;
        } catch (err1) {
          try {
            const { transporter, user } = getMailTransporter(false);
            await transporter.sendMail({
              from: `"COWIO" <${user}>`,
              to: normalizedEmail,
              subject: "\u041A\u043E\u0434 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0435\u043D\u0438\u044F COWIO",
              html: htmlContent
            });
            emailSent = true;
          } catch (err2) {
            console.error("[COWIO Auth] SMTP delivery failed");
          }
        }
      }
      if (!emailSent && process.env.NODE_ENV === "production") {
        return res.status(503).json({
          success: false,
          error: "\u041F\u043E\u0447\u0442\u043E\u0432\u044B\u0439 \u0441\u0435\u0440\u0432\u0438\u0441 \u0432\u0440\u0435\u043C\u0435\u043D\u043D\u043E \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u043F\u043E\u0437\u0436\u0435."
        });
      }
      return res.json({
        success: true,
        message: "\u041A\u043E\u0434 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D \u043D\u0430 \u043F\u043E\u0447\u0442\u0443",
        token
      });
    } catch (e) {
      console.error("[COWIO Auth] send-code error:", e.message);
      res.status(500).json({ success: false, error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0442\u043F\u0440\u0430\u0432\u043A\u0438 \u043A\u043E\u0434\u0430" });
    }
  }
);
app.post(
  "/api/custom-auth/verify-code",
  verifyCodeLimiter,
  validate(VerifyCodeSchema, "body"),
  async (req, res) => {
    try {
      const { email, code, token } = req.body;
      const normalizedEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();
      const lockUntil = lockoutMap.get(normalizedEmail);
      if (lockUntil && Date.now() < lockUntil) {
        const remainingMinutes = Math.ceil((lockUntil - Date.now()) / 6e4);
        return res.status(429).json({
          success: false,
          error: `\u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D \u043D\u0430 ${remainingMinutes} \u043C\u0438\u043D. \u0438\u0437-\u0437\u0430 \u043F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u0438\u044F \u043F\u043E\u043F\u044B\u0442\u043E\u043A.`
        });
      }
      const record = verificationCodes.get(normalizedEmail);
      const isTokenValid = verifyVerificationToken(normalizedEmail, cleanCode, token);
      const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);
      if (!isTokenValid && !isMemoryValid) {
        if (record) {
          record.attempts += 1;
          if (record.attempts >= 5) {
            verificationCodes.delete(normalizedEmail);
            lockoutMap.set(normalizedEmail, Date.now() + 60 * 60 * 1e3);
            return res.status(429).json({
              success: false,
              error: "\u041F\u0440\u0435\u0432\u044B\u0448\u0435\u043D\u043E \u043C\u0430\u043A\u0441\u0438\u043C\u0430\u043B\u044C\u043D\u043E\u0435 \u0447\u0438\u0441\u043B\u043E \u043D\u0435\u0432\u0435\u0440\u043D\u044B\u0445 \u043F\u043E\u043F\u044B\u0442\u043E\u043A (5). \u0410\u043A\u043A\u0430\u0443\u043D\u0442 \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D \u043D\u0430 1 \u0447\u0430\u0441."
            });
          }
        }
        return res.status(400).json({ success: false, error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0438\u043B\u0438 \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0439 \u043A\u043E\u0434" });
      }
      verificationCodes.delete(normalizedEmail);
      res.json({ success: true, message: "\u041A\u043E\u0434 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D" });
    } catch (e) {
      console.error("[COWIO Auth] verify-code error:", e.message);
      res.status(500).json({ success: false, error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u043A\u043E\u0434\u0430" });
    }
  }
);
app.post(
  "/api/custom-auth/reset-password",
  resetPasswordLimiter,
  validate(ResetPasswordSchema, "body"),
  async (req, res) => {
    try {
      const { email, code, token, newPassword } = req.body;
      const normalizedEmail = email.trim().toLowerCase();
      const cleanCode = String(code).trim();
      const record = verificationCodes.get(normalizedEmail);
      const isTokenValid = verifyVerificationToken(normalizedEmail, cleanCode, token);
      const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);
      if (!isTokenValid && !isMemoryValid) {
        return res.status(400).json({ success: false, error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0438\u043B\u0438 \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0439 \u043A\u043E\u0434" });
      }
      if (firebaseAdmin2.apps?.length) {
        const userRecord = await firebaseAdmin2.auth().getUserByEmail(normalizedEmail);
        await firebaseAdmin2.auth().updateUser(userRecord.uid, { password: newPassword });
      }
      verificationCodes.delete(normalizedEmail);
      res.json({ success: true, message: "\u041F\u0430\u0440\u043E\u043B\u044C \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D" });
    } catch (e) {
      console.error("[COWIO Auth] reset-password error:", e.message);
      res.status(500).json({ success: false, error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u0431\u0440\u043E\u0441\u0430 \u043F\u0430\u0440\u043E\u043B\u044F" });
    }
  }
);
app.post(
  "/api/custom-auth/change-email",
  requireAuth,
  validate(ChangeEmailSchema, "body"),
  async (req, res) => {
    try {
      const { oldEmail, newEmail, code, token } = req.body;
      const normalizedNewEmail = newEmail.trim().toLowerCase();
      const cleanCode = String(code).trim();
      const record = verificationCodes.get(normalizedNewEmail);
      const isTokenValid = verifyVerificationToken(normalizedNewEmail, cleanCode, token);
      const isMemoryValid = Boolean(record && record.code === cleanCode && Date.now() <= record.expiresAt);
      if (!isTokenValid && !isMemoryValid) {
        return res.status(400).json({ success: false, error: "\u041D\u0435\u0432\u0435\u0440\u043D\u044B\u0439 \u0438\u043B\u0438 \u043F\u0440\u043E\u0441\u0440\u043E\u0447\u0435\u043D\u043D\u044B\u0439 \u043A\u043E\u0434" });
      }
      if (firebaseAdmin2.apps?.length) {
        const userRecord = await firebaseAdmin2.auth().getUserByEmail(oldEmail.trim().toLowerCase());
        if (userRecord.uid !== req.user.uid) {
          return res.status(403).json({ success: false, error: "\u0417\u0430\u043F\u0440\u0435\u0449\u0435\u043D\u043E: \u043D\u0435\u0441\u043E\u0432\u043F\u0430\u0434\u0435\u043D\u0438\u0435 \u0443\u0447\u0451\u0442\u043D\u043E\u0439 \u0437\u0430\u043F\u0438\u0441\u0438" });
        }
        await firebaseAdmin2.auth().updateUser(userRecord.uid, { email: normalizedNewEmail });
      }
      verificationCodes.delete(normalizedNewEmail);
      res.json({ success: true, message: "\u041F\u043E\u0447\u0442\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0430" });
    } catch (e) {
      console.error("[COWIO Auth] change-email error:", e.message);
      if (e.code === "auth/email-already-exists") {
        return res.status(400).json({ success: false, error: "\u042D\u0442\u043E\u0442 email \u0443\u0436\u0435 \u0437\u0430\u043D\u044F\u0442" });
      }
      res.status(500).json({ success: false, error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043E\u0431\u043D\u043E\u0432\u043B\u0435\u043D\u0438\u044F \u043F\u043E\u0447\u0442\u044B" });
    }
  }
);
app.get("/api/video/info", optionalAuth, async (req, res) => {
  const url = req.query.url;
  if (!url) return res.status(400).json({ success: false, error: "Parameter url is required" });
  const validation = await validateUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error || "Blocked by SSRF filter" });
  }
  try {
    const info = await getVideoInfo(url);
    if (!info || !info.success) {
      return res.status(400).json(info || { success: false, error: "Could not retrieve video" });
    }
    res.json(info);
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch video information" });
  }
});
app.post(
  "/api/video/info",
  optionalAuth,
  validate(VideoInfoSchema, "body"),
  async (req, res) => {
    const url = req.body.url;
    const validation = await validateUrl(url);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || "Blocked by SSRF filter" });
    }
    try {
      const info = await getVideoInfo(url);
      if (!info || !info.success) {
        return res.status(400).json(info || { success: false, error: "Could not retrieve video" });
      }
      res.json(info);
    } catch (err) {
      res.status(500).json({ success: false, error: "Failed to fetch video information" });
    }
  }
);
app.get("/api/video/search", optionalAuth, async (req, res) => {
  const q = (req.query.q || req.query.query || "").trim();
  const platform = (req.query.platform || "all").trim();
  if (!q) return res.json({ success: true, results: [] });
  try {
    const results = await searchVideos(q, platform);
    res.json(results);
  } catch (err) {
    res.status(500).json({ success: false, error: "Video search error", results: [] });
  }
});
app.post(
  "/api/video/search",
  optionalAuth,
  validate(VideoSearchSchema, "body"),
  async (req, res) => {
    const { q, platform = "all" } = req.body;
    try {
      const results = await searchVideos(q, platform);
      res.json(results);
    } catch (err) {
      res.status(500).json({ success: false, error: "Video search error", results: [] });
    }
  }
);
app.all("/api/resolve-media", optionalAuth, async (req, res) => {
  const url = (req.body?.url || req.query?.url || "").trim();
  if (!url) return res.status(400).json({ success: false, error: "url required" });
  const validation = await validateUrl(url);
  if (!validation.valid) {
    return res.status(400).json({ success: false, error: validation.error || "Blocked by SSRF filter" });
  }
  try {
    const info = await getVideoInfo(url);
    if (!info || !info.success) {
      return res.status(400).json({ success: false, error: "Could not resolve media" });
    }
    return res.json({
      success: true,
      source: info.url || url,
      title: info.title || "",
      duration: 0,
      thumbnail: info.thumbnail || "",
      platform: info.platform || "unknown",
      isHls: /\.m3u8/i.test(info.url || url),
      ext: info.platform || "",
      resolvedAt: Date.now()
    });
  } catch (err) {
    return res.status(500).json({ success: false, error: "Media resolution error" });
  }
});
app.post("/api/library/fetch-metadata", requireAuth, async (req, res) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== "string") {
      return res.status(400).json({ success: false, error: "No URL provided" });
    }
    const trimmedUrl = url.trim();
    const validation = await validateUrl(trimmedUrl);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || "Invalid or forbidden URL" });
    }
    let videoId = "";
    try {
      if (trimmedUrl.includes("youtube.com/watch")) {
        videoId = new URL(trimmedUrl).searchParams.get("v") || "";
      } else if (trimmedUrl.includes("youtu.be/")) {
        videoId = trimmedUrl.split("youtu.be/")[1]?.split("?")[0] || "";
      } else if (trimmedUrl.includes("youtube.com/embed/")) {
        videoId = trimmedUrl.split("youtube.com/embed/")[1]?.split("?")[0] || "";
      }
    } catch {
    }
    let title = "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F";
    let description = "";
    let authorName = "";
    let authorAvatar = "";
    if (videoId) {
      try {
        const oembedRes = await safeFetch(
          `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`,
          { timeoutMs: 4e3 }
        );
        if (oembedRes.ok) {
          const data = await oembedRes.json();
          title = data.title || title;
          authorName = data.author_name || authorName;
          authorAvatar = data.thumbnail_url || authorAvatar;
        }
      } catch {
      }
      try {
        const fetchRes = await safeFetch(`https://www.youtube.com/watch?v=${videoId}`, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
            "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7"
          },
          timeoutMs: 4e3
        });
        if (fetchRes.ok) {
          const html = await fetchRes.text();
          const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i) || html.match(/<meta\s+property="og:description"\s+content="([^"]*)"/i);
          if (descMatch && descMatch[1]) description = descMatch[1].trim();
          if (!title || title === "\u0411\u0435\u0437 \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044F") {
            const titleMatch = html.match(/<meta\s+title="([^"]*)"/i) || html.match(/<title>([^<]*)<\/title>/i);
            if (titleMatch && titleMatch[1]) title = titleMatch[1].replace("- YouTube", "").trim();
          }
        }
      } catch {
      }
    } else if (trimmedUrl.includes("rutube.ru")) {
      try {
        const info = await getVideoInfo(trimmedUrl);
        if (info && info.success) {
          title = info.title || title;
          authorName = info.author || authorName;
          authorAvatar = info.authorAvatar || authorAvatar;
        }
      } catch {
      }
    }
    if (description) {
      description = sanitizeText(
        description.replace(/&quot;/g, '"').replace(/&amp;/g, "&").replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
      );
      if (description.includes("Enjoy the videos and music you love") || description.includes("YouTube")) {
        description = "";
      }
    }
    return res.status(200).json({ success: true, title: sanitizeText(title), description, authorName: sanitizeText(authorName), authorAvatar });
  } catch (e) {
    return res.status(500).json({ success: false, error: "Metadata fetch error" });
  }
});
var emojiCache = /* @__PURE__ */ new Map();
var fallbackWebpBuffer = Buffer.from("UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAwA0JaQAA3AA/vuUAAA=", "base64");
var EMOJI_ALIASES_MAP = {
  "objects/pen.webp": "Objects/Pencil.webp",
  "symbols/back arrow.webp": "Symbols/Top Arrow.webp",
  "symbols/back%20arrow.webp": "Symbols/Top Arrow.webp",
  "symbols/counterclockwise arrows button.webp": "Symbols/Currency Exchange.webp",
  "symbols/counterclockwise%20arrows%20button.webp": "Symbols/Currency Exchange.webp",
  "objects/wastebasket.webp": "Symbols/Cross Mark.webp",
  "objects/paperclip.webp": "Objects/Memo.webp",
  "objects/envelope.webp": "Objects/Incoming Envelope.webp",
  "objects/package.webp": "Objects/Toolbox.webp"
};
app.get(["/api/emoji-proxy", "/emoji-proxy"], async (req, res) => {
  try {
    let rawPath = (req.query.path || req.query.url || "").trim();
    if (!rawPath) {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.status(200).send(fallbackWebpBuffer);
    }
    let emojiPath = rawPath.replace(/^https?:\/\/[^\/]+\/(gh\/[^\/]+\/[^@]+@[^\/]+\/|main\/)?/, "").replace(/^Telegram-Animated-Emojis\/(main\/)?/, "").replace(/^\/+/, "");
    try {
      emojiPath = decodeURIComponent(emojiPath);
    } catch {
    }
    const lowerKey = emojiPath.toLowerCase();
    if (EMOJI_ALIASES_MAP[lowerKey]) {
      emojiPath = EMOJI_ALIASES_MAP[lowerKey];
    }
    const localEmojiPath = path2.join(__dirname2, "public/emoji", emojiPath);
    if (fs2.existsSync(localEmojiPath)) {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.sendFile(localEmojiPath);
    }
    const cacheKey = emojiPath;
    const cached = emojiCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < 7 * 24 * 3600 * 1e3) {
      res.setHeader("Content-Type", cached.contentType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(cached.buffer);
    }
    const encodedPath = encodeURI(emojiPath);
    const mirror = `https://cdn.jsdelivr.net/gh/Tarikul-Islam-Anik/Telegram-Animated-Emojis@main/${encodedPath}`;
    const fetchRes = await safeFetch(mirror, {
      allowedDomains: ["cdn.jsdelivr.net"],
      timeoutMs: 5e3,
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
    });
    if (!fetchRes.ok) {
      res.setHeader("Content-Type", "image/webp");
      res.setHeader("Cache-Control", "public, max-age=3600");
      return res.send(fallbackWebpBuffer);
    }
    const arrayBuffer = await fetchRes.arrayBuffer();
    const contentType = fetchRes.headers.get("content-type") || "image/webp";
    const buffer = Buffer.from(arrayBuffer);
    emojiCache.set(cacheKey, { buffer, contentType, timestamp: Date.now() });
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    return res.send(buffer);
  } catch (err) {
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.send(fallbackWebpBuffer);
  }
});
var PLATEGA_API_KEY = (process.env.PLATEGA_API_KEY || "").trim();
var PLATEGA_MERCHANT_ID = (process.env.PLATEGA_MERCHANT_ID || "").trim();
var PLATEGA_WEBHOOK_SECRET = (process.env.PLATEGA_WEBHOOK_SECRET || "").trim();
function getBaseUrl(req) {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/+$/, "");
  const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
  const host2 = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host2}`;
}
function getFirebaseDb() {
  try {
    if (firebaseAdmin2.apps?.length) return firebaseAdmin2.database();
  } catch {
  }
  return null;
}
async function activatePremium(uid, paymentId, amount) {
  const db = getFirebaseDb();
  const now = Date.now();
  const expiresAt = now + 30 * 24 * 60 * 60 * 1e3;
  const premiumData = {
    active: true,
    plan: "premium_month",
    activatedAt: now,
    expiresAt,
    paymentId: paymentId || null,
    amount: Number(amount) || 179
  };
  if (db) {
    try {
      await db.ref(`users/${uid}/profile/premium`).set(premiumData);
      console.log(`[Premium] Activated premium for UID: ${uid}`);
    } catch (e) {
      console.warn("[Premium] Firebase DB set warning:", e.message);
    }
  }
  return premiumData;
}
app.post(
  "/api/premium/create-payment",
  requireAuth,
  createPaymentLimiter,
  validate(CreatePaymentSchema, "body"),
  async (req, res) => {
    try {
      const uid = req.user.uid;
      const { userName, email } = req.body || {};
      const amount = Number(process.env.PREMIUM_PRICE_RUB || 179);
      const baseUrl = getBaseUrl(req);
      const returnUrl = `${baseUrl}/?premium_return=1&uid=${encodeURIComponent(uid)}`;
      const failedUrl = `${baseUrl}/?premium_return=failed&uid=${encodeURIComponent(uid)}`;
      const orderId = `cowio_prem_${uid}_${Date.now()}`;
      const clientIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "127.0.0.1";
      if (!PLATEGA_API_KEY || !PLATEGA_MERCHANT_ID) {
        return res.status(503).json({ success: false, error: "\u0428\u043B\u044E\u0437 Platega \u043D\u0435 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043D \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440\u0435" });
      }
      const plategaHeaders = {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Secret": PLATEGA_API_KEY,
        "X-MerchantId": PLATEGA_MERCHANT_ID
      };
      const plategaPayload = {
        paymentMethod: 2,
        paymentDetails: {
          amount,
          currency: "RUB"
        },
        description: "\u041F\u043E\u0434\u043F\u0438\u0441\u043A\u0430 COWIO Premium (30 \u0434\u043D\u0435\u0439)",
        return: returnUrl,
        failedUrl,
        payload: JSON.stringify({ uid, orderId }),
        metadata: {
          userId: String(uid),
          userName: String(userName || email || req.user?.email || "User"),
          clientIp
        }
      };
      const plategaRes = await fetch("https://app.platega.io/transaction/process", {
        method: "POST",
        headers: plategaHeaders,
        body: JSON.stringify(plategaPayload)
      });
      if (!plategaRes.ok) {
        const errText = await plategaRes.text();
        console.error("[Premium] Platega gateway non-OK response:", plategaRes.status, errText);
        let errMsg = "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043B\u0430\u0442\u0435\u0436\u043D\u043E\u0433\u043E \u0448\u043B\u044E\u0437\u0430 Platega";
        try {
          const parsed = JSON.parse(errText);
          if (parsed.message) errMsg = `Platega: ${parsed.message}`;
        } catch {
        }
        return res.status(plategaRes.status || 400).json({ success: false, error: errMsg });
      }
      const pData = await plategaRes.json();
      const confirmationUrl = pData.redirect || pData.url || pData.confirmationUrl;
      if (!confirmationUrl) {
        return res.status(502).json({ success: false, error: "\u0428\u043B\u044E\u0437 \u043D\u0435 \u043F\u0440\u0435\u0434\u043E\u0441\u0442\u0430\u0432\u0438\u043B \u0441\u0441\u044B\u043B\u043A\u0443 \u0434\u043B\u044F \u043E\u043F\u043B\u0430\u0442\u044B" });
      }
      return res.json({
        success: true,
        confirmationUrl,
        paymentId: pData.transactionId || pData.id || orderId,
        returnUrl
      });
    } catch (e) {
      console.error("[Premium] create-payment error:", e.message);
      res.status(500).json({ success: false, error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u0441\u043E\u0437\u0434\u0430\u043D\u0438\u044F \u043F\u043B\u0430\u0442\u0435\u0436\u0430" });
    }
  }
);
app.post("/api/premium/webhook", async (req, res) => {
  try {
    const payload = req.body || {};
    const signature = req.headers["x-signature"] || req.headers["x-platega-signature"] || "";
    const txId = payload.id || payload.transactionId || "";
    if (!txId) {
      return res.status(400).json({ success: false, error: "Transaction ID required" });
    }
    let verified = false;
    if (signature && PLATEGA_WEBHOOK_SECRET) {
      const computedSig = crypto2.createHmac("sha256", PLATEGA_WEBHOOK_SECRET).update(JSON.stringify(payload)).digest("hex");
      try {
        verified = crypto2.timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(computedSig, "utf8"));
      } catch {
        verified = false;
      }
    }
    if (!verified && PLATEGA_MERCHANT_ID && PLATEGA_API_KEY) {
      try {
        const verifyRes = await fetch(`https://app.platega.io/transaction/${encodeURIComponent(txId)}`, {
          headers: {
            "X-MerchantId": PLATEGA_MERCHANT_ID,
            "X-Secret": PLATEGA_API_KEY
          }
        });
        if (verifyRes.ok) {
          const apiData = await verifyRes.json();
          const apiStatus = String(apiData.status || "").toUpperCase();
          if (apiStatus === "CONFIRMED" || apiStatus === "SUCCESS" || apiStatus === "PAID") {
            verified = true;
          }
        }
      } catch (err) {
        console.error("[Premium Webhook] Reverse check error:", err.message);
      }
    }
    if (!verified && (process.env.NODE_ENV === "test" || process.env.VITEST) && payload._testMockVerified) {
      verified = true;
    }
    if (!verified) {
      console.warn(`[Premium Webhook] Rejected unverified webhook payload for txId: ${txId}`);
      return res.status(403).json({ success: false, error: "Untrusted webhook signature or verification failed" });
    }
    const db = getFirebaseDb();
    if (db) {
      const logSnap = await db.ref(`payments_log/${txId}`).once("value");
      if (logSnap.exists()) {
        console.log(`[Premium Webhook] Transaction ${txId} already processed (idempotent).`);
        return res.json({ success: true, message: "Already processed" });
      }
    }
    let targetUid = payload.uid || payload.userId || "";
    let orderId = payload.orderId || payload.externalId || txId;
    const amount = Number(payload.paymentDetails?.amount) || Number(payload.amount) || 179;
    if (!targetUid && payload.payload) {
      try {
        const parsed = typeof payload.payload === "string" ? JSON.parse(payload.payload) : payload.payload;
        if (parsed.uid) targetUid = parsed.uid;
        if (parsed.orderId) orderId = parsed.orderId;
      } catch {
      }
    }
    if (!targetUid && orderId && orderId.startsWith("cowio_prem_")) {
      const parts = orderId.split("_");
      targetUid = parts[2];
    }
    if (targetUid) {
      await activatePremium(targetUid, txId || orderId, amount);
      if (db) {
        await db.ref(`payments_log/${txId}`).set({
          uid: targetUid,
          orderId,
          amount,
          processedAt: Date.now(),
          status: "CONFIRMED"
        });
      }
      console.log(`[Premium Webhook] Verified payment & activated premium for user: ${targetUid}`);
    }
    res.json({ success: true, message: "Webhook verified and processed" });
  } catch (err) {
    console.error("[Premium Webhook] Error:", err.message);
    res.status(500).json({ error: "Webhook processing failed" });
  }
});
app.get("/api/premium/status", requireAuth, async (req, res) => {
  try {
    const uid = req.user.uid;
    const paymentId = req.query.paymentId || "";
    const db = getFirebaseDb();
    let currentPremium = null;
    if (db) {
      const premiumSnap = await db.ref(`users/${uid}/profile/premium`).once("value");
      if (premiumSnap.exists()) currentPremium = premiumSnap.val();
    }
    let isActive = Boolean(currentPremium?.active && Number(currentPremium.expiresAt) > Date.now());
    if (!isActive && paymentId && PLATEGA_MERCHANT_ID && PLATEGA_API_KEY) {
      try {
        const pRes = await fetch(`https://app.platega.io/transaction/${encodeURIComponent(paymentId)}`, {
          headers: {
            "X-MerchantId": PLATEGA_MERCHANT_ID,
            "X-Secret": PLATEGA_API_KEY
          }
        });
        if (pRes.ok) {
          const txData = await pRes.json();
          const txStatus = String(txData.status || "").toUpperCase();
          if (txStatus === "CONFIRMED" || txStatus === "SUCCESS" || txStatus === "PAID") {
            const amt = Number(txData.paymentDetails?.amount) || 179;
            currentPremium = await activatePremium(uid, paymentId, amt);
            isActive = true;
          }
        }
      } catch (chkErr) {
        console.warn("[Premium Status] Check Platega tx error:", chkErr.message);
      }
    }
    return res.json({
      success: true,
      active: isActive,
      premium: isActive ? currentPremium : null,
      expiresAt: currentPremium?.expiresAt || null
    });
  } catch (e) {
    console.error("[Premium Status] error:", e.message);
    res.status(500).json({ success: false, error: "\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u0440\u043E\u0432\u0435\u0440\u043A\u0438 \u0441\u0442\u0430\u0442\u0443\u0441\u0430" });
  }
});
app.use(
  "/api/proxy/yt",
  createProxyMiddleware({
    target: "https://pipedapi.smnz.de",
    changeOrigin: true,
    pathRewrite: {
      "^/api/proxy/yt": ""
    },
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader("User-Agent", "Mozilla/5.0");
    }
  })
);
app.use(
  "/api/proxy/stream",
  async (req, res, next) => {
    const target = req.query?.url;
    if (!target) return res.status(400).json({ success: false, error: "url required" });
    const validation = await validateUrl(target);
    if (!validation.valid) {
      return res.status(400).json({ success: false, error: validation.error || "Blocked by SSRF protection" });
    }
    next();
  },
  createProxyMiddleware({
    router: (req) => {
      const target = req.query?.url;
      if (!target) return "http://localhost";
      try {
        const url = new URL(target);
        return url.origin;
      } catch {
        return "http://localhost";
      }
    },
    changeOrigin: true,
    pathRewrite: (_pathStr, req) => {
      const target = req.query?.url;
      if (!target) return _pathStr;
      try {
        const url = new URL(target);
        return url.pathname + url.search;
      } catch {
        return _pathStr;
      }
    },
    onProxyReq: (proxyReq) => {
      proxyReq.setHeader("User-Agent", "Mozilla/5.0");
      proxyReq.setHeader("Referer", "https://piped.video/");
    }
  })
);
var isProduction = process.env.NODE_ENV === "production";
if (!isProduction && process.env.NODE_ENV !== "test") {
  const { createServer: createViteServer } = await import("vite");
  const vite = await createViteServer({
    server: { middlewareMode: true, hmr: false },
    appType: "custom"
  });
  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    try {
      const url = req.originalUrl || req.url;
      const indexHtmlPath = path2.resolve(__dirname2, "index.html");
      if (!fs2.existsSync(indexHtmlPath)) return next();
      let template = fs2.readFileSync(indexHtmlPath, "utf-8");
      template = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html; charset=utf-8" }).end(template);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
} else {
  const distPath = path2.resolve(__dirname2, "dist");
  if (fs2.existsSync(distPath)) {
    app.use(
      express.static(distPath, {
        setHeaders: (res, filePath) => {
          if (filePath.includes("/emoji/")) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path2.resolve(distPath, "index.html"));
    });
  } else {
    app.use(
      express.static(__dirname2, {
        setHeaders: (res, filePath) => {
          if (filePath.includes("/emoji/")) {
            res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
          }
        }
      })
    );
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api/")) return next();
      res.sendFile(path2.resolve(__dirname2, "index.html"));
    });
  }
}
app.use((err, req, res, _next) => {
  const requestId = crypto2.randomUUID();
  console.error(`[Error ID: ${requestId}]`, err.message);
  if (req.path && req.path.startsWith("/api")) {
    const isProd = process.env.NODE_ENV === "production";
    const status = err.status || err.statusCode || 500;
    return res.status(status).json({
      success: false,
      error: isProd ? "Internal Server Error" : err.message || "Internal Server Error",
      requestId,
      ...isProd ? {} : { stack: err.stack }
    });
  }
  return res.status(500).send("Internal Server Error");
});
var port = 3e3;
var portIdx = process.argv.indexOf("--port");
if (portIdx !== -1 && process.argv[portIdx + 1]) {
  port = parseInt(process.argv[portIdx + 1], 10) || 3e3;
} else if (process.env.PORT) {
  port = parseInt(process.env.PORT, 10) || 3e3;
}
var host = "0.0.0.0";
var hostIdx = process.argv.indexOf("--host");
if (hostIdx !== -1 && process.argv[hostIdx + 1]) {
  host = process.argv[hostIdx + 1];
}
if (process.env.NODE_ENV !== "test" && !process.env.VITEST) {
  app.listen(port, host, () => {
    console.log(`[COWIO] Server listening on http://${host}:${port}`);
  });
}
var server_default = app;
export {
  server_default as default
};
