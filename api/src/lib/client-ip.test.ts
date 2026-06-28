import { describe, expect, it } from 'vitest';
import type { FastifyRequest } from 'fastify';
import { getClientIp } from './client-ip.js';

function mkReq(headers: Record<string, unknown>, ip = '10.0.0.1'): FastifyRequest {
  return { headers, ip } as unknown as FastifyRequest;
}

describe('getClientIp', () => {
  it('returns CF-Connecting-IP when set to a valid IPv4', () => {
    expect(getClientIp(mkReq({ 'cf-connecting-ip': '203.0.113.5' }))).toBe('203.0.113.5');
  });

  it('returns CF-Connecting-IP when set to a valid IPv6', () => {
    expect(getClientIp(mkReq({ 'cf-connecting-ip': '2001:db8::1' }))).toBe('2001:db8::1');
  });

  it('trims surrounding whitespace from a valid header value', () => {
    expect(getClientIp(mkReq({ 'cf-connecting-ip': '  203.0.113.5  ' }))).toBe('203.0.113.5');
  });

  it('falls back to request.ip when header is absent', () => {
    expect(getClientIp(mkReq({}))).toBe('10.0.0.1');
  });

  it('falls back to request.ip when header is empty', () => {
    expect(getClientIp(mkReq({ 'cf-connecting-ip': '' }))).toBe('10.0.0.1');
  });

  it('falls back to request.ip when header is malformed', () => {
    expect(getClientIp(mkReq({ 'cf-connecting-ip': 'not-an-ip' }))).toBe('10.0.0.1');
  });

  it('falls back to request.ip when header is an array (not a string)', () => {
    expect(getClientIp(mkReq({ 'cf-connecting-ip': ['203.0.113.5'] }))).toBe('10.0.0.1');
  });
});
