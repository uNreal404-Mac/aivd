import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getUserVideos: vi.fn(),
  getUserVideoStats: vi.fn(),
}));

vi.mock("@/lib/api/auth", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("@/lib/admin/user-videos", () => ({
  getUserVideos: mocks.getUserVideos,
  getUserVideoStats: mocks.getUserVideoStats,
}));

import { ApiError } from "@/lib/api/error";
import { GET } from "@/app/api/v1/admin/user-videos/route";

const request = () =>
  new NextRequest("https://aivd.test/api/v1/admin/user-videos?userId=someone-else");

describe("GET /api/v1/admin/user-videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserVideos.mockResolvedValue({ videos: [], totalVideos: 0, totalPages: 0 });
    mocks.getUserVideoStats.mockResolvedValue({ total: 0 });
  });

  it("refuses a visitor who is not signed in", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiError("Unauthorized", 401));
    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(mocks.getUserVideos).not.toHaveBeenCalled();
    expect(mocks.getUserVideoStats).not.toHaveBeenCalled();
  });

  it("refuses a signed-in user who is not an administrator", async () => {
    mocks.requireAdmin.mockRejectedValue(new ApiError("Forbidden", 403));
    const response = await GET(request());
    expect(response.status).toBe(403);
    expect(mocks.getUserVideos).not.toHaveBeenCalled();
  });

  it("returns the user's videos to an administrator as before", async () => {
    mocks.requireAdmin.mockResolvedValue({ id: "admin", isAdmin: true });
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ videos: [], totalVideos: 0, totalPages: 0, stats: { total: 0 } });
    expect(mocks.getUserVideos).toHaveBeenCalledWith({ userId: "someone-else", page: 1, limit: 10, status: undefined });
  });
});
