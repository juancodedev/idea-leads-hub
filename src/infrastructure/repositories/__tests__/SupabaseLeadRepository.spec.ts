/**
 * Tests for SupabaseLeadRepository.update() — differentiating
 * between undefined (don't touch) and empty string (clear field).
 *
 * Affected fields: website, linkedinUrl, address, notes,
 *                  instagramHandle, instagramScopedId, jobTitle, phone, company
 */

import { SupabaseLeadRepository } from '../SupabaseLeadRepository';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../database/database.types';

// ---------- Mocks ----------
const mockFrom = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSelect = jest.fn();
const mockSingle = jest.fn();
const mockGetUser = jest.fn();

const fakeSupabase = {
  from: mockFrom,
  auth: { getUser: mockGetUser },
} as unknown as SupabaseClient<Database>;

const mockQueryBuilder = {
  update: mockUpdate,
  eq: mockEq,
  select: mockSelect,
  single: mockSingle,
};

const defaultLeadRow = {
  id: 'lead-1',
  name: 'Juan Pérez',
  company: 'Acme Corp',
  email: 'juan@acme.com',
  phone: '+34 600 000 000',
  address: 'Calle Principal 123',
  website: 'https://acme.com',
  status: 'Nuevo',
  source: 'LinkedIn',
  notes: 'Some notes',
  user_id: 'user-1',
  pipeline_id: 'pipeline-1',
  stage_id: 'stage-1',
  instagram_handle: '@juanperez',
  instagram_scoped_id: '12345',
  job_title: 'CEO',
  linkedin_url: 'https://linkedin.com/in/juanperez',
  estimated_value: 50000,
  next_follow_up: null,
  created_at: '2024-01-15T10:00:00Z',
  updated_at: '2024-01-15T10:00:00Z',
};

beforeEach(() => {
  jest.clearAllMocks();

  mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });

  // Chain: from().update().eq().select().single()
  mockFrom.mockReturnValue(mockQueryBuilder);
  mockUpdate.mockReturnValue(mockQueryBuilder);
  mockEq.mockReturnValue(mockQueryBuilder);
  mockSelect.mockReturnValue(mockQueryBuilder);
  mockSingle.mockResolvedValue({ data: defaultLeadRow, error: null });
});

// ---------- Factory ----------
function createRepo() {
  return new SupabaseLeadRepository(fakeSupabase);
}

describe('SupabaseLeadRepository.update()', () => {
  // ─── 3.1 Website ───────────────────────────────────────────────
  it('should send null to DB when website is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', website: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ website: null })
    );
  });

  it('should send the website value to DB when website is a valid URL', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', website: 'https://example.com' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ website: 'https://example.com' })
    );
  });

  // ─── 3.2 linkedinUrl ──────────────────────────────────────────
  it('should send null to DB when linkedinUrl is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', linkedinUrl: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ linkedin_url: null })
    );
  });

  // ─── 3.3 notes ────────────────────────────────────────────────
  it('should send null to DB when notes is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', notes: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ notes: null })
    );
  });

  // ─── 3.4 Only update name, don't touch other fields ──────────
  it('should only update name when name is the only field provided', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', name: 'New Name' });

    // The update payload should NOT include website, linkedinUrl, address,
    // notes, instagramHandle, instagramScopedId, jobTitle, phone, company
    expect(mockUpdate).toHaveBeenCalled();
    const updateArg = mockUpdate.mock.calls[0][0];

    // Should include name
    expect(updateArg.name).toBe('New Name');
    // Should NOT include any of the optional fields
    expect(updateArg).not.toHaveProperty('website');
    expect(updateArg).not.toHaveProperty('linkedin_url');
    expect(updateArg).not.toHaveProperty('address');
    expect(updateArg).not.toHaveProperty('notes');
    expect(updateArg).not.toHaveProperty('instagram_handle');
    expect(updateArg).not.toHaveProperty('instagram_scoped_id');
    expect(updateArg).not.toHaveProperty('job_title');
    expect(updateArg).not.toHaveProperty('phone');
    expect(updateArg).not.toHaveProperty('company');
  });

  // ─── 3.5 White-space only string is treated as valid ─────────
  it('should treat whitespace-only string as a valid value', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', website: '  ', notes: '  ' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        website: '  ',
        notes: '  ',
      })
    );
  });

  // ─── estimatedValue: 0 must persist ─────────────────────────
  it('should persist 0 as a number for estimatedValue', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', estimatedValue: 0 });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ estimated_value: 0 })
    );
  });

  // ─── address empty string ─────────────────────────────────────
  it('should send null to DB when address is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', address: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ address: null })
    );
  });

  // ─── phone empty string ───────────────────────────────────────
  it('should send null to DB when phone is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', phone: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ phone: null })
    );
  });

  // ─── company empty string ─────────────────────────────────────
  it('should send null to DB when company is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', company: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ company: null })
    );
  });

  // ─── instagramHandle empty string ────────────────────────────
  it('should send null to DB when instagramHandle is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', instagramHandle: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ instagram_handle: null })
    );
  });

  // ─── instagramScopedId empty string ──────────────────────────
  it('should send null to DB when instagramScopedId is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', instagramScopedId: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ instagram_scoped_id: null })
    );
  });

  // ─── jobTitle empty string ───────────────────────────────────
  it('should send null to DB when jobTitle is empty string', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', jobTitle: '' });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ job_title: null })
    );
  });

  // ─── Undefined fields are not sent ──────────────────────────
  it('should NOT include fields that are undefined', async () => {
    const repo = createRepo();
    await repo.update({ id: 'lead-1', name: 'Only Name' });

    const updateArg = mockUpdate.mock.calls[0][0];
    // All optional fields should NOT be in the payload
    const optionalFields = [
      'website', 'linkedin_url', 'address', 'notes',
      'instagram_handle', 'instagram_scoped_id', 'job_title', 'phone', 'company',
      'source', 'status', 'email', 'pipeline_id', 'stage_id',
    ];

    for (const field of optionalFields) {
      expect(updateArg).not.toHaveProperty(field);
    }
  });
});
