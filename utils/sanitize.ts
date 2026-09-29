import DOMPurify from 'isomorphic-dompurify';
import { Request, Response, NextFunction } from 'express';

/**
 * Strips dangerous HTML tags and event handlers while preserving safe formatting if needed.
 */
export function sanitizeHtml(dirty: unknown): string {
  if (dirty === null || dirty === undefined) return '';
  const str = String(dirty);
  return DOMPurify.sanitize(str, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'span', 'p', 'br', 'picture', 'source', 'img'],
    ALLOWED_ATTR: ['href', 'target', 'rel', 'src', 'alt', 'class', 'style', 'srcset', 'type', 'loading', 'width', 'height'],
    ALLOW_DATA_ATTR: false
  });
}

/**
 * Escapes all HTML special characters, converting user text into plain safe characters.
 */
export function sanitizeText(text: unknown): string {
  if (text === null || text === undefined) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

/**
 * Escapes characters suitable for HTML attribute insertion.
 */
export function escapeAttr(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Recursively removes __proto__, constructor, and prototype properties from input objects
 * to prevent Prototype Pollution attacks.
 */
export function sanitizeObject<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeObject(item)) as unknown as T;
  }

  const cleanObj: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase().trim();
    if (lowerKey === '__proto__' || lowerKey === 'constructor' || lowerKey === 'prototype') {
      continue;
    }

    if (value !== null && typeof value === 'object') {
      cleanObj[key] = sanitizeObject(value);
    } else {
      cleanObj[key] = value;
    }
  }

  return cleanObj as T;
}

/**
 * Express middleware to recursively sanitize prototype pollution vectors
 * on req.body, req.query, and req.params.
 */
export function prototypePollutionMiddleware(req: Request, _res: Response, next: NextFunction): void {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeObject(req.body);
  }
  if (req.query && typeof req.query === 'object') {
    req.query = sanitizeObject(req.query);
  }
  if (req.params && typeof req.params === 'object') {
    req.params = sanitizeObject(req.params);
  }
  next();
}
