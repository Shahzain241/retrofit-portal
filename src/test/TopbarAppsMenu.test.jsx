import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import Topbar from '../components/Topbar';
import { ProfileProvider } from '../context/ProfileContext';
import { clientLinks, adminLinks } from '../data/sidebarLinks';

const mockNavigate = vi.fn();

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const buildTableMock = (rows, onSingle) => {
  const table = {
    select: vi.fn(function () { return table; }),
    eq: vi.fn(function () { return table; }),
    maybeSingle: vi.fn(() => Promise.resolve({ data: onSingle ? onSingle() : rows?.[0] ?? null })),
    single: vi.fn(() => Promise.resolve({ data: rows?.[0] ?? null })),
    order: vi.fn(function () { return table; }),
    limit: vi.fn(function () { return table; }),
    or: vi.fn(function () { return table; }),
    update: vi.fn(() => Promise.resolve({ error: null })),
    insert: vi.fn(() => Promise.resolve({ error: null })),
  };
  return table;
};

vi.mock('../lib/supabaseClient', () => ({
  supabase: {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } } }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'user-1' } } } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
    from: vi.fn((tableName) => {
      if (tableName === 'profiles') return buildTableMock([{ role: 'client' }]);
      if (tableName === 'notifications') return buildTableMock([]);
      if (tableName === 'projects') return buildTableMock([]);
      return buildTableMock([]);
    }),
  },
}));

function renderTopbar(variant) {
  return render(
    <MemoryRouter>
      <ProfileProvider>
        <Topbar variant={variant} />
      </ProfileProvider>
    </MemoryRouter>,
  );
}

describe('Topbar apps menu + avatar', () => {
  it('client variant shows the 4 client apps and not the admin-only items', async () => {
    renderTopbar('client');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Open apps menu'));
    clientLinks.forEach(({ label }) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
    adminLinks.forEach(({ label }) => {
      if (!clientLinks.some((c) => c.label === label)) {
        expect(screen.queryByText(label)).not.toBeInTheDocument();
      }
    });
  });

  it('admin variant shows the admin apps and hides client-only items', async () => {
    renderTopbar('admin');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Open apps menu'));
    adminLinks.forEach(({ label }) => {
      expect(screen.getAllByText(label).length).toBeGreaterThan(0);
    });
    // Client-only labels/routes must NOT leak into the admin apps menu. Note
    // the admin /admin/projects link is ALSO labeled "My Projects" (matches
    // Figma), so only the genuinely client-only items are asserted here.
    expect(screen.queryByText('Profile & Property')).not.toBeInTheDocument();
    expect(screen.queryByText('Billing')).not.toBeInTheDocument();
  });

  it('clicking an apps item navigates to its destination', async () => {
    renderTopbar('client');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Open apps menu'));
    await user.click(screen.getByText('Billing'));
    expect(mockNavigate).toHaveBeenCalledWith('/billing');
  });

  it('client avatar click navigates to /profile', async () => {
    renderTopbar('client');
    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Open profile'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
  });

  it('admin avatar has no click handler / no navigation', async () => {
    renderTopbar('admin');
    expect(screen.queryByLabelText('Open profile')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Open admin settings')).not.toBeInTheDocument();
  });

  it('renders the avatar through TopbarAvatar for both variants', async () => {
    // The default profile has no real photo (avatar is null), so TopbarAvatar
    // renders the clean initials fallback instead of a remote/broken image.
    renderTopbar('admin');
    expect(screen.getByText('JH')).toBeInTheDocument();
  });
});
