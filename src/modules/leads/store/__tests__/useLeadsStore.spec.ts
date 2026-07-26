/**
 * Tests for useLeadsStore — search param sync.
 *
 * Spec: 4.1 → 4.5
 */

import { useLeadsStore } from '../useLeadsStore';

beforeEach(() => {
  useLeadsStore.setState({
    leads: [],
    isLoading: false,
    search: '',
    statusFilter: 'all',
    sourceFilter: 'all',
    sortField: 'createdAt',
    sortOrder: 'desc',
    page: 1,
  });
});

describe('useLeadsStore — searchParams sync', () => {
  it('should set initial search from URL params via setFromSearchParams', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: 'acme',
      status: null,
      source: null,
      sort: null,
      order: null,
      page: null,
    });

    const state = useLeadsStore.getState();
    expect(state.search).toBe('acme');
  });

  it('should set initial status filter from URL params', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: null,
      status: 'Interesado',
      source: null,
      sort: null,
      order: null,
      page: null,
    });

    const state = useLeadsStore.getState();
    expect(state.statusFilter).toBe('Interesado');
  });

  it('should set search value via setSearch', () => {
    useLeadsStore.getState().setSearch('acme');
    expect(useLeadsStore.getState().search).toBe('acme');
  });

  it('should set status filter via setStatusFilter', () => {
    useLeadsStore.getState().setStatusFilter('Interesado');
    expect(useLeadsStore.getState().statusFilter).toBe('Interesado');
  });

  it('should reset to defaults when clear values are passed', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: 'acme',
      status: 'Interesado',
      source: null,
      sort: null,
      order: null,
      page: null,
    });

    // Verify they were set
    expect(useLeadsStore.getState().search).toBe('acme');
    expect(useLeadsStore.getState().statusFilter).toBe('Interesado');

    // Reset
    useLeadsStore.getState().setFromSearchParams({
      q: null,
      status: null,
      source: null,
      sort: null,
      order: null,
      page: null,
    });

    expect(useLeadsStore.getState().search).toBe('');
    expect(useLeadsStore.getState().statusFilter).toBe('all');
  });

  it('should accept any status filter value (pipeline stages are dynamic)', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: null,
      status: 'INVALID_STATUS_XYZ',
      source: null,
      sort: null,
      order: null,
      page: null,
    });

    const state = useLeadsStore.getState();
    // Pipeline stages are dynamic — any value is valid
    expect(state.statusFilter).toBe('INVALID_STATUS_XYZ');
  });

  it('should sanitize search input against XSS', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: '<script>alert("xss")</script>',
      status: null,
      source: null,
      sort: null,
      order: null,
      page: null,
    });

    const state = useLeadsStore.getState();
    expect(state.search).not.toContain('<script>');
  });

  it('should default valid statuses', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: null,
      status: 'Nuevo',
      source: null,
      sort: null,
      order: null,
      page: null,
    });
    expect(useLeadsStore.getState().statusFilter).toBe('Nuevo');
  });

  it('should parse valid page numbers', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: null,
      status: null,
      source: null,
      sort: null,
      order: null,
      page: '3',
    });
    expect(useLeadsStore.getState().page).toBe(3);
  });

  it('should default to page 1 for invalid page numbers', () => {
    useLeadsStore.getState().setFromSearchParams({
      q: null,
      status: null,
      source: null,
      sort: null,
      order: null,
      page: '-1',
    });
    expect(useLeadsStore.getState().page).toBe(1);
  });
});
