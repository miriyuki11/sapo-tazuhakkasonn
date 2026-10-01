import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "./client";
import {
  signUpUser,
  signInUser,
  signOutUser,
  getCurrentSession,
  getUser,
} from "./auth";
import type { Session, User, AuthError } from "@supabase/supabase-js";

vi.mock("./client", () => ({
  supabase: {
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getSession: vi.fn(),
      getUser: vi.fn(),
    },
  },
}));

describe("Supabase Auth Wrapper Functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // テスト実行時のエラーログ・コンソール出力を抑制
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("signUpUser", () => {
    it("successfully signs up a new user", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" } as unknown as User;
      const mockData = {
        user: mockUser,
        session: null,
      };
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: mockData,
        error: null,
      } as never);

      const result = await signUpUser("test@example.com", "password123");

      expect(supabase.auth.signUp).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.data).toEqual(mockData);
      expect(result.error).toBeNull();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("handles sign up error gracefully", async () => {
      const mockError = new Error("User already registered") as unknown as AuthError;
      vi.mocked(supabase.auth.signUp).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      } as never);

      const result = await signUpUser("test@example.com", "password123");

      expect(result.data).toBeNull();
      expect(result.error).toBe(mockError);
    });
  });

  describe("signInUser", () => {
    it("successfully signs in a user", async () => {
      const mockSession = { access_token: "token-123" } as unknown as Session;
      const mockUser = { id: "user-123", email: "test@example.com" } as unknown as User;
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: mockUser, session: mockSession },
        error: null,
      } as never);

      const result = await signInUser("test@example.com", "password123");

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "password123",
      });
      expect(result.data).toEqual({ user: mockUser, session: mockSession });
      expect(result.error).toBeNull();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("handles invalid credentials error", async () => {
      const mockError = new Error("Invalid login credentials") as unknown as AuthError;
      vi.mocked(supabase.auth.signInWithPassword).mockResolvedValue({
        data: { user: null, session: null },
        error: mockError,
      } as never);

      const result = await signInUser("test@example.com", "wrong-pass");

      expect(supabase.auth.signInWithPassword).toHaveBeenCalledWith({
        email: "test@example.com",
        password: "wrong-pass",
      });
      expect(result.data).toBeNull();
      expect(result.error).toBe(mockError);
    });
  });

  describe("signOutUser", () => {
    it("successfully signs out", async () => {
      vi.mocked(supabase.auth.signOut).mockResolvedValue({ error: null } as never);

      const result = await signOutUser();

      expect(supabase.auth.signOut).toHaveBeenCalled();
      expect(result.error).toBeNull();
    });

    it("handles sign out error", async () => {
      const mockError = new Error("Network error") as unknown as AuthError;
      vi.mocked(supabase.auth.signOut).mockResolvedValue({
        error: mockError,
      } as never);

      const result = await signOutUser();

      expect(result.error).toBe(mockError);
    });
  });

  describe("getCurrentSession", () => {
    it("returns current session", async () => {
      const mockSession = { access_token: "session-token" } as unknown as Session;
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: mockSession },
        error: null,
      } as never);

      const result = await getCurrentSession();

      expect(supabase.auth.getSession).toHaveBeenCalled();
      expect(result.session).toEqual(mockSession);
      expect(result.error).toBeNull();
      expect(console.log).not.toHaveBeenCalled();
    });

    it("handles session retrieval error", async () => {
      const mockError = new Error("Failed to get session") as unknown as AuthError;
      vi.mocked(supabase.auth.getSession).mockResolvedValue({
        data: { session: null },
        error: mockError,
      } as never);

      const result = await getCurrentSession();

      expect(result.session).toBeNull();
      expect(result.error).toBe(mockError);
    });
  });

  describe("getUser", () => {
    it("returns current authenticated user", async () => {
      const mockUser = { id: "user-123", email: "test@example.com" } as unknown as User;
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as never);

      const result = await getUser();

      expect(supabase.auth.getUser).toHaveBeenCalled();
      expect(result.user).toEqual(mockUser);
      expect(result.error).toBeNull();
    });

    it("handles get user error", async () => {
      const mockError = new Error("Auth session missing!") as unknown as AuthError;
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: null },
        error: mockError,
      } as never);

      const result = await getUser();

      expect(result.user).toBeNull();
      expect(result.error).toBe(mockError);
    });
  });
});
