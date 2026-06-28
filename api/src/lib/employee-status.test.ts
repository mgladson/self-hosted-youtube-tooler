import { describe, expect, it } from 'vitest';
import { employeeStatus, isPubliclyVisible, redactEmployee } from './employee-status.js';

describe('employeeStatus', () => {
  it('returns the explicit status when valid', () => {
    expect(employeeStatus({ status: 'active' })).toBe('active');
    expect(employeeStatus({ status: 'placed' })).toBe('placed');
    expect(employeeStatus({ status: 'disabled' })).toBe('disabled');
    expect(employeeStatus({ status: 'pending' })).toBe('pending');
  });

  it('maps legacy disabled:true to disabled', () => {
    expect(employeeStatus({ disabled: true })).toBe('disabled');
  });

  it('defaults to active when status missing and not disabled', () => {
    expect(employeeStatus({})).toBe('active');
    expect(employeeStatus({ disabled: false })).toBe('active');
  });

  it('prefers an explicit status over the legacy flag', () => {
    expect(employeeStatus({ status: 'placed', disabled: true })).toBe('placed');
  });

  it('ignores an invalid status value', () => {
    expect(employeeStatus({ status: 'bogus' })).toBe('active');
    expect(employeeStatus({ status: 'bogus', disabled: true })).toBe('disabled');
  });
});

describe('isPubliclyVisible', () => {
  it('shows only active and placed', () => {
    expect(isPubliclyVisible({ status: 'active' })).toBe(true);
    expect(isPubliclyVisible({ status: 'placed' })).toBe(true);
  });

  it('hides pending and disabled (and legacy disabled:true)', () => {
    expect(isPubliclyVisible({ status: 'pending' })).toBe(false);
    expect(isPubliclyVisible({ status: 'disabled' })).toBe(false);
    expect(isPubliclyVisible({ disabled: true })).toBe(false);
  });

  it('treats a missing status as public (active)', () => {
    expect(isPubliclyVisible({})).toBe(true);
  });
});

describe('redactEmployee', () => {
  const full = {
    slug: 'employee-1',
    name: 'Test Person',
    role: { en: 'Helper', my: 'အကူ' },
    accent: 'jade',
    image: '/images/testimonials/x.png',
    photos: [{ src: '/images/testimonials/a.png' }, { src: '/images/testimonials/b.png' }],
    personal: [{ label: { en: 'Age', my: '' }, value: { en: '30', my: '' } }],
    availability: [{ label: { en: 'Day off', my: '' }, value: { en: '1', my: '' } }],
    disabled: false,
  };

  it('strips the locked fields', () => {
    const r = redactEmployee(full) as Record<string, unknown>;
    expect(r.image).toBeUndefined();
    expect(r.photos).toBeUndefined();
    expect(r.personal).toBeUndefined();
    expect(r.disabled).toBeUndefined();
  });

  it('strips the intake block and pending-review flag', () => {
    const r = redactEmployee({
      ...full,
      pendingReview: true,
      intake: { whatsapp: '+65 8123 4567', email: 'applicant@example.com' },
    }) as Record<string, unknown>;
    expect(r.intake).toBeUndefined();
    expect(r.pendingReview).toBeUndefined();
  });

  it('keeps the public fields', () => {
    const r = redactEmployee(full) as Record<string, unknown>;
    expect(r.slug).toBe('employee-1');
    expect(r.name).toBe('Test Person');
    expect(r.role).toEqual({ en: 'Helper', my: 'အကူ' });
    expect(r.availability).toEqual(full.availability);
  });

  it('adds non-sensitive hints', () => {
    const r = redactEmployee(full) as Record<string, unknown>;
    expect(r.status).toBe('active');
    expect(r.hasImage).toBe(true);
    expect(r.photoCount).toBe(2);
    expect(r.hasLockedDetails).toBe(true);
  });

  it('reports absent media and details correctly', () => {
    const r = redactEmployee({ slug: 's', name: 'n', role: { en: '', my: '' } }) as Record<string, unknown>;
    expect(r.hasImage).toBe(false);
    expect(r.photoCount).toBe(0);
    expect(r.hasLockedDetails).toBe(false);
  });

  it('does not mutate the input', () => {
    const input = { ...full, photos: [...full.photos] };
    redactEmployee(input);
    expect(input.image).toBe('/images/testimonials/x.png');
    expect(input.photos).toHaveLength(2);
    expect(input.personal).toHaveLength(1);
  });

  it('carries the placed status through', () => {
    const r = redactEmployee({ ...full, status: 'placed' }) as Record<string, unknown>;
    expect(r.status).toBe('placed');
  });

  it('derives a public age bracket from the gated personal age', () => {
    const bracketOf = (age: string) =>
      (redactEmployee({
        ...full,
        personal: [{ label: { en: '🎂 Age', my: '' }, value: { en: age, my: '' } }],
      }) as Record<string, unknown>).ageBracket;
    expect(bracketOf('22')).toBe('21-25');
    expect(bracketOf('30')).toBe('26-30');
    expect(bracketOf('45')).toBe('above-40');
  });

  it('omits the age bracket when age is absent or out of range', () => {
    expect(
      (redactEmployee({ slug: 's', name: 'n', role: { en: '', my: '' } }) as Record<string, unknown>)
        .ageBracket,
    ).toBeUndefined();
    expect(
      (redactEmployee({
        ...full,
        personal: [{ label: { en: 'Age', my: '' }, value: { en: '18', my: '' } }],
      }) as Record<string, unknown>).ageBracket,
    ).toBeUndefined();
  });

  it('surfaces marital status and religion from the gated personal block', () => {
    const r = redactEmployee({
      ...full,
      personal: [
        { label: { en: '💍 Marital', my: '' }, value: { en: 'Divorced', my: '' } },
        { label: { en: '🙏 Religion', my: '' }, value: { en: 'Buddhist', my: '' } },
      ],
    }) as Record<string, unknown>;
    expect(r.maritalStatus).toBe('Divorced');
    expect(r.religion).toBe('Buddhist');
    expect(r.personal).toBeUndefined();
  });

  it('omits marital/religion when those rows are absent', () => {
    const r = redactEmployee({ slug: 's', name: 'n', role: { en: '', my: '' } }) as Record<string, unknown>;
    expect(r.maritalStatus).toBeUndefined();
    expect(r.religion).toBeUndefined();
  });
});
