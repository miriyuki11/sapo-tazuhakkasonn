import { describe, it, expect, vi, beforeEach } from "vitest";
import { supabase } from "@/lib/supabase";
import {
  getPrivateNotes,
  createPrivateNote,
  updatePrivateNote,
  deletePrivateNote,
} from "./privateNotes";
import type { User } from "@supabase/supabase-js";

vi.mock("@/lib/supabase", () => ({
  supabase: {
    from: vi.fn(),
    auth: {
      getUser: vi.fn(),
    },
  },
}));

describe("privateNotes CRUD functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  describe("getPrivateNotes", () => {
    it("fetches all private notes without target user filter", async () => {
      const mockNotes = [
        {
          id: "note-1",
          author_user_id: "author-1",
          target_user_id: "target-1",
          note_content: "Hello Note 1",
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
      ];

      const orderMock = vi.fn().mockResolvedValue({ data: mockNotes, error: null });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as never);

      const result = await getPrivateNotes();

      expect(supabase.from).toHaveBeenCalledWith("user_private_notes");
      expect(selectMock).toHaveBeenCalledWith("*");
      expect(orderMock).toHaveBeenCalledWith("created_at", { ascending: false });
      expect(result).toEqual(mockNotes);
    });

    it("fetches notes filtered by target_user_id", async () => {
      const mockNotes = [
        {
          id: "note-2",
          author_user_id: "author-1",
          target_user_id: "target-specific",
          note_content: "Target Note",
          created_at: "2026-10-01T00:00:00Z",
          updated_at: "2026-10-01T00:00:00Z",
        },
      ];

      const eqMock = vi.fn().mockResolvedValue({ data: mockNotes, error: null });
      const orderMock = vi.fn().mockReturnValue({ eq: eqMock });
      const selectMock = vi.fn().mockReturnValue({ order: orderMock });
      vi.mocked(supabase.from).mockReturnValue({ select: selectMock } as never);

      const result = await getPrivateNotes("target-specific");

      expect(supabase.from).toHaveBeenCalledWith("user_private_notes");
      expect(eqMock).toHaveBeenCalledWith("target_user_id", "target-specific");
      expect(result).toEqual(mockNotes);
    });
  });

  describe("createPrivateNote", () => {
    it("creates a note using current user auth id if author_user_id is omitted", async () => {
      const mockUser = { id: "logged-in-user" } as unknown as User;
      vi.mocked(supabase.auth.getUser).mockResolvedValue({
        data: { user: mockUser },
        error: null,
      } as never);

      const mockCreated = {
        id: "new-note-id",
        author_user_id: "logged-in-user",
        target_user_id: "target-user-999",
        note_content: "Test content",
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T00:00:00Z",
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockCreated, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const insertMock = vi.fn().mockReturnValue({ select: selectMock });
      vi.mocked(supabase.from).mockReturnValue({ insert: insertMock } as never);

      const result = await createPrivateNote({
        target_user_id: "target-user-999",
        note_content: "Test content",
      });

      expect(insertMock).toHaveBeenCalledWith({
        author_user_id: "logged-in-user",
        target_user_id: "target-user-999",
        note_content: "Test content",
      });
      expect(result).toEqual(mockCreated);
    });
  });

  describe("updatePrivateNote", () => {
    it("updates the note content and returns updated record", async () => {
      const mockUpdated = {
        id: "note-1",
        author_user_id: "author-1",
        target_user_id: "target-1",
        note_content: "Updated content",
        created_at: "2026-10-01T00:00:00Z",
        updated_at: "2026-10-01T01:00:00Z",
      };

      const singleMock = vi.fn().mockResolvedValue({ data: mockUpdated, error: null });
      const selectMock = vi.fn().mockReturnValue({ single: singleMock });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const updateMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(supabase.from).mockReturnValue({ update: updateMock } as never);

      const result = await updatePrivateNote("note-1", {
        note_content: "Updated content",
      });

      expect(supabase.from).toHaveBeenCalledWith("user_private_notes");
      expect(eqMock).toHaveBeenCalledWith("id", "note-1");
      expect(result).toEqual(mockUpdated);
    });
  });

  describe("deletePrivateNote", () => {
    it("deletes note by id and returns true on success", async () => {
      const selectMock = vi.fn().mockResolvedValue({ data: [{ id: "note-to-delete" }], error: null });
      const eqMock = vi.fn().mockReturnValue({ select: selectMock });
      const deleteMock = vi.fn().mockReturnValue({ eq: eqMock });
      vi.mocked(supabase.from).mockReturnValue({ delete: deleteMock } as never);

      const result = await deletePrivateNote("note-to-delete");

      expect(supabase.from).toHaveBeenCalledWith("user_private_notes");
      expect(eqMock).toHaveBeenCalledWith("id", "note-to-delete");
      expect(selectMock).toHaveBeenCalledWith("id");
      expect(result).toBe(true);
    });
  });
});
