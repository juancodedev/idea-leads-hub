/**
 * Tests for LeadDetailsPage — Instagram section in contact sidebar.
 *
 * T4.4 — Verify:
 * - Instagram section renders with handle
 * - Instagram section does NOT render without handle
 * - Scoped ID shown when present, hidden when absent
 * - Link has correct href, target, and rel attributes
 *
 * Layer: Integration (server component with mocked repository)
 */

import React from 'react';
import { render, screen, within } from '@testing-library/react';

// ---------- Mocks ----------

jest.mock('next/navigation', () => ({
  notFound: jest.fn(() => {
    throw new Error('NOT_FOUND');
  }),
}));

jest.mock('next/headers', () => ({
  cookies: jest.fn(() =>
    Promise.resolve({
      get: jest.fn(),
      getAll: jest.fn(() => []),
      set: jest.fn(),
    })
  ),
}));

jest.mock('@/infrastructure/database/server', () => ({
  createClient: jest.fn(() => Promise.resolve({})),
}));

const mockGetById = jest.fn();
jest.mock('@/infrastructure/repositories/SupabaseLeadRepository', () => ({
  SupabaseLeadRepository: jest.fn().mockImplementation(() => ({
    getById: mockGetById,
  })),
}));

// Mock layout and workspace to simplify rendering
jest.mock('@/ui/layouts/DashboardLayout', () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dashboard-layout">{children}</div>
  ),
}));

jest.mock('@/modules/leads/components/LeadWorkspace', () => ({
  LeadWorkspace: ({ lead }: { lead: any }) => (
    <div data-testid="lead-workspace">{lead?.name}</div>
  ),
}));

// Mock next/link as plain <a>
jest.mock('next/link', () => {
  const MockLink = ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: any;
  }) => React.createElement('a', { href, ...props }, children);
  MockLink.displayName = 'MockLink';
  return MockLink;
});

// ---------- Helpers ----------

interface LeadOverrides {
  id?: string;
  name?: string;
  company?: string;
  email?: string;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  status?: string;
  source?: string | null;
  userId?: string;
  pipelineId?: string;
  stageId?: string;
  createdAt?: string;
  updatedAt?: string;
  instagramHandle?: string | null;
  instagramScopedId?: string | null;
  [key: string]: any;
}

function createLead(overrides: LeadOverrides = {}) {
  return {
    id: 'lead-1',
    name: 'Juan Pérez',
    company: 'Acme Corp',
    email: 'juan@acme.com',
    phone: '+34 600 000 000',
    address: 'Calle Principal 123',
    website: 'https://acme.com',
    status: 'Nuevo',
    source: 'LinkedIn',
    userId: 'user-1',
    pipelineId: 'pipeline-1',
    stageId: 'stage-1',
    createdAt: '2024-01-15T10:00:00Z',
    updatedAt: '2024-01-15T10:00:00Z',
    instagramHandle: undefined,
    instagramScopedId: undefined,
    ...overrides,
  };
}

async function renderPage(leadOverrides: LeadOverrides = {}) {
  const lead = createLead(leadOverrides);
  mockGetById.mockResolvedValue(lead);

  const PageComponent = (await import('../page')).default;
  const element = await PageComponent({
    params: Promise.resolve({ id: lead.id }),
  });
  return render(element);
}

// ---------- Suite ----------

describe('LeadDetailsPage — Instagram section', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetById.mockReset();
  });

  it('renders Instagram icon and handle when instagramHandle is set', async () => {
    await renderPage({ instagramHandle: 'acme_corp' });

    // The Instagram handle should appear as @handle
    const handleLink = screen.getByText(/@acme_corp/);
    expect(handleLink).toBeInTheDocument();
  });

  it('renders Instagram link with correct href, target, and rel', async () => {
    await renderPage({ instagramHandle: 'acme_corp' });

    const link = screen.getByText(/@acme_corp/).closest('a');
    expect(link).toHaveAttribute('href', 'https://instagram.com/acme_corp');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders scoped ID as muted secondary text when present', async () => {
    await renderPage({
      instagramHandle: 'acme_corp',
      instagramScopedId: '17841405822304715',
    });

    expect(screen.getByText('ID: 17841405822304715')).toBeInTheDocument();
  });

  it('does not render scoped ID when instagramScopedId is undefined', async () => {
    await renderPage({ instagramHandle: 'acme_corp', instagramScopedId: undefined });

    // Scoped ID text should not be present
    expect(screen.queryByText(/ID:/)).not.toBeInTheDocument();
  });

  it('does not render Instagram section when instagramHandle is undefined', async () => {
    await renderPage({ instagramHandle: undefined });

    // Instagram-related content should not appear
    const instagramIcon = document.querySelector('.lucide-instagram');
    expect(instagramIcon).not.toBeInTheDocument();
    // Check that no link to instagram.com exists
    expect(screen.queryByText('@acme_corp')).not.toBeInTheDocument();
  });

  it('does not render Instagram section when instagramHandle is empty string', async () => {
    await renderPage({ instagramHandle: '' });

    expect(screen.queryByText('@acme_corp')).not.toBeInTheDocument();
  });

  it('renders Instagram section after the website entry', async () => {
    await renderPage({
      instagramHandle: 'acme_corp',
      website: 'https://acme.com',
    });

    // Find the website link
    const websiteLink = screen.getByText('https://acme.com');
    // Find the Instagram handle
    const instagramLink = screen.getByText(/@acme_corp/);

    // Both should be in the document
    expect(websiteLink).toBeInTheDocument();
    expect(instagramLink).toBeInTheDocument();

    // The Instagram link should appear after the website link in the DOM
    const contactSection = websiteLink.closest('div[class*="space-y"]') || websiteLink.closest('div');
    if (contactSection) {
      const allLinks = contactSection.querySelectorAll('a');
      const linkTexts = Array.from(allLinks).map((a) => a.textContent);
      const websiteIdx = linkTexts.indexOf('https://acme.com');
      const instagramIdx = linkTexts.indexOf('@acme_corp');
      expect(instagramIdx).toBeGreaterThan(websiteIdx);
    }
  });

  it('does not render Instagram section when instagramHandle is null', async () => {
    await renderPage({ instagramHandle: null });

    expect(screen.queryByText('@acme_corp')).not.toBeInTheDocument();
  });

  it('renders the Instagram icon next to the handle link', async () => {
    await renderPage({ instagramHandle: 'acme_corp' });

    // The Instagram icon should be in the document (lucide-react icons get .lucide-{name} class)
    const icon = document.querySelector('.lucide-instagram');
    expect(icon).toBeInTheDocument();
    // The handle link should be immediately adjacent in the same container
    const link = screen.getByText('@acme_corp');
    expect(link.closest('a')).toHaveAttribute('href', 'https://instagram.com/acme_corp');
    // Icon and link should share a parent flex container
    expect(icon?.parentElement?.contains(link)).toBe(true);
  });
});
