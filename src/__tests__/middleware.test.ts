/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';

const getUser = jest.fn();
jest.mock('@supabase/ssr', () => ({
  createServerClient: () => ({ auth: { getUser } }),
}));

import { middleware } from '../middleware';

const run = (path: string) =>
  middleware(new NextRequest(new URL(path, 'http://localhost')));

describe('middleware route protection', () => {
  beforeEach(() => getUser.mockReset());

  it.each([
    '/dashboard',
    '/leads/1',
    '/ideas',
    '/pipeline',
    '/activities',
    '/settings/instagram',
    '/messages',
  ])('redirects anonymous users from %s to /login', async (path) => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await run(path);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost/login');
  });

  it('lets anonymous users reach public pages', async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    for (const path of ['/', '/privacy', '/login', '/messagesx']) {
      expect((await run(path)).headers.get('location')).toBeNull();
    }
  });

  it('redirects signed-in users away from auth pages', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    const res = await run('/login');
    expect(res.headers.get('location')).toBe('http://localhost/dashboard');
  });

  it('checks the session once per request', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'u1' } } });
    await run('/leads');
    expect(getUser).toHaveBeenCalledTimes(1);
  });
});
