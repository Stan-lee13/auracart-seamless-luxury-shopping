import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';

// Mock supabase
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
    },
    from: vi.fn(),
  },
}));

const TestComponent = () => {
  const { user, isAdmin, isLoading, session } = useAuth();
  return (
    <div>
      <div data-testid="loading">{isLoading ? 'loading' : 'ready'}</div>
      <div data-testid="user-email">{user?.email || 'no-user'}</div>
      <div data-testid="is-admin">{isAdmin ? 'admin' : 'not-admin'}</div>
      <div data-testid="session">{session ? 'has-session' : 'no-session'}</div>
    </div>
  );
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('AuthProvider and useAuth', () => {
    it('should provide auth context to child components', () => {
      const mockSession = {
        user: { id: '123', email: 'test@example.com' },
        session: null,
      };

      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any);

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      expect(screen.getByTestId('user-email')).toBeInTheDocument();
    });

    it('should initialize with loading state', () => {
      vi.mocked(supabase.auth.onAuthStateChange).mockReturnValue({
        data: { subscription: { unsubscribe: vi.fn() } },
      } as any);

      vi.mocked(supabase.auth.getSession).mockImplementation(
        () => new Promise((resolve) => {
          setTimeout(() => {
            resolve({ data: { session: null }, error: null });
          }, 100);
        }) as any
      );

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      // Initially loading
      expect(screen.getByTestId('loading')).toHaveTextContent('loading');
    });

    it('should throw error when useAuth is used outside AuthProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      expect(() => {
        render(<TestComponent />);
      }).toThrow('useAuth must be used within an AuthProvider');

      consoleError.mockRestore();
    });

    it('should set isAdmin to false when user has no admin role', async () => {
      const mockUser = {
        id: '123',
        email: 'user@example.com',
        user_metadata: {},
      };

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
        (callback: any) => {
          // Simulate session established
          callback('SIGNED_IN', { user: mockUser } as any);
          return {
            data: { subscription: { id: 'test-sub-1', callback, unsubscribe: vi.fn() } },
          } as any;
        }
      );

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: null, // No admin role found
          error: null,
        }),
      } as any);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-admin')).toHaveTextContent('not-admin');
      });
    });

    it('should set isAdmin to true when user has admin role', async () => {
      const mockUser = {
        id: '123',
        email: 'admin@example.com',
        user_metadata: {},
      };

      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
        (callback: any) => {
          callback('SIGNED_IN', { user: mockUser } as any);
          return {
            data: { subscription: { id: 'test-sub-2', callback, unsubscribe: vi.fn() } },
          } as any;
        }
      );

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'admin' }, // Admin role found
          error: null,
        }),
      } as any);

      render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-admin')).toHaveTextContent('admin');
      }, { timeout: 1000 });
    });

    it('should clear isAdmin when user signs out', async () => {
      const mockUser = {
        id: '123',
        email: 'admin@example.com',
        user_metadata: {},
      };

      let lastCallback: any;
      vi.mocked(supabase.auth.onAuthStateChange).mockImplementation(
        (callback: any) => {
          lastCallback = callback;
          callback('SIGNED_IN', { user: mockUser } as any);
          return {
            data: { subscription: { id: 'test-sub-3', callback, unsubscribe: vi.fn() } },
          } as any;
        }
      );

      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: null,
      } as any);

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { role: 'admin' },
          error: null,
        }),
      } as any);

      const { rerender } = render(
        <AuthProvider>
          <TestComponent />
        </AuthProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('is-admin')).toHaveTextContent('admin');
      });

      // Simulate sign out
      lastCallback('SIGNED_OUT', null);

      await waitFor(() => {
        expect(screen.getByTestId('is-admin')).toHaveTextContent('not-admin');
      });
    });
  });
});
