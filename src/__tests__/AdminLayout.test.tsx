import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import AdminLayout from '@/components/admin/AdminLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import * as AuthContextModule from '@/contexts/AuthContext';

// Mock the useAuth hook
vi.mock('@/contexts/AuthContext', async () => {
  const actual = await vi.importActual('@/contexts/AuthContext');
  return {
    ...actual,
    useAuth: vi.fn(),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => <div data-testid="redirect">{`Redirect to ${to}`}</div>,
    Outlet: () => <div data-testid="admin-content">Admin Content</div>,
  };
});

const renderAdminLayout = () => {
  return render(
    <BrowserRouter>
      <AdminLayout />
    </BrowserRouter>
  );
};

describe('AdminLayout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Admin Access Control', () => {
    it('should show loading state initially', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: true,
        isAdmin: false,
        user: null,
        session: null,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.getByText(/Loading.../)).toBeInTheDocument();
    });

    it('should redirect non-admin users to account page', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: false,
        user: { email: 'user@example.com' } as any,
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.getByTestId('redirect')).toHaveTextContent('Redirect to /account');
    });

    it('should redirect users not in email whitelist even if isAdmin is true', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: true,
        user: { email: 'notallowed@example.com' } as any, // Not in whitelist
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.getByTestId('redirect')).toHaveTextContent('Redirect to /account');
    });

    it('should allow access to whitelisted admin emails', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: true,
        user: { email: 'stanleyvic13@gmail.com' } as any, // In whitelist
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      // Should render admin content, not redirect
      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
    });

    it('should allow access to second whitelisted admin email', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: true,
        user: { email: 'stanleyvic14@gmail.com' } as any, // In whitelist
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
      expect(screen.queryByTestId('redirect')).not.toBeInTheDocument();
    });

    it('should handle case-insensitive email matching', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: true,
        user: { email: 'STANLEYVIC13@GMAIL.COM' } as any, // Uppercase
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.getByTestId('admin-content')).toBeInTheDocument();
    });

    it('should redirect users with null email', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: true,
        user: { email: null } as any,
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.getByTestId('redirect')).toHaveTextContent('Redirect to /account');
    });

    it('should redirect when user is null', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: false,
        user: null,
        session: null,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.getByTestId('redirect')).toBeInTheDocument();
    });
  });

  describe('Admin Navigation', () => {
    it('should display admin navigation when user is authorized', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: true,
        user: { email: 'stanleyvic13@gmail.com' } as any,
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      // Check for admin navigation items
      expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Orders')).toBeInTheDocument();
      expect(screen.getByText('Refunds')).toBeInTheDocument();
      expect(screen.getByText('Disputes')).toBeInTheDocument();
      expect(screen.getByText('Suppliers')).toBeInTheDocument();
    });

    it('should not display admin navigation for unauthorized users', () => {
      vi.mocked(AuthContextModule.useAuth).mockReturnValue({
        isLoading: false,
        isAdmin: false,
        user: { email: 'user@example.com' } as any,
        session: {} as any,
        profile: null,
        signUp: vi.fn(),
        signIn: vi.fn(),
        signOut: vi.fn(),
      } as any);

      renderAdminLayout();

      expect(screen.queryByText('Admin Dashboard')).not.toBeInTheDocument();
      expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    });
  });
});
