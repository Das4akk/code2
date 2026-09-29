import { describe, it, expect } from 'vitest';
import { sanitizeText, sanitizeHtml } from '../../utils/sanitize.js';

describe('XSS Defense and Sanitization Tests', () => {
  it('should escape HTML entities for username input with script injection', () => {
    const maliciousInput = '<img src=x onerror=alert(1)>';
    const sanitized = sanitizeText(maliciousInput);

    expect(sanitized).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(sanitized).not.toContain('<img');
  });

  it('should strip malicious script tags in sanitizeHtml', () => {
    const dirty = '<script>alert("pwned")</script><p>Hello World</p>';
    const clean = sanitizeHtml(dirty);

    expect(clean).not.toContain('<script>');
    expect(clean).not.toContain('alert(');
    expect(clean).toContain('<p>Hello World</p>');
  });

  it('should strip dangerous javascript: URLs in sanitizeHtml', () => {
    const dirty = '<a href="javascript:alert(1)">Click Me</a>';
    const clean = sanitizeHtml(dirty);

    expect(clean).not.toContain('javascript:');
  });
});
