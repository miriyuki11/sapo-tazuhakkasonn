import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { supabase } from '@/lib/supabase';
import { ProfileCard } from './ProfileCard';

const { notifyAuthChange } = vi.hoisted(() => ({
  notifyAuthChange: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      onAuthStateChange: vi.fn((callback) => {
        notifyAuthChange.mockImplementation(callback);
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
    },
    functions: {
      invoke: vi.fn(),
    },
    from: vi.fn(),
  },
}));

vi.mock('@/utils/privateNotes', () => ({
  createPrivateNote: vi.fn(),
  updatePrivateNote: vi.fn(),
  deletePrivateNote: vi.fn(),
}));

describe('ProfileCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('filters the Edge Function request by profile and clears its note on sign-out', async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { user: { id: 'author-id' } } },
    } as never);
    vi.mocked(supabase.functions.invoke).mockResolvedValue({
      data: [
        {
          id: 'note-id',
          note_content: 'private profile note',
          target_user_id: 'profile-id',
        },
      ],
      error: null,
    } as never);

    render(<ProfileCard profileId="profile-id" profileName="Test Profile" />);

    await waitFor(() => {
      expect(screen.getByText('private profile note')).toBeDefined();
    });
    expect(supabase.functions.invoke).toHaveBeenCalledWith(
      'private-notes?profile_user_id=profile-id',
      expect.objectContaining({ method: 'GET' })
    );

    act(() => notifyAuthChange('SIGNED_OUT', null));
    expect(screen.queryByText('private profile note')).toBeNull();
  });
});
