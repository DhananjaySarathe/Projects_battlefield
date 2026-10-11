import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { repository } from "../src/lib/repository";
import { safeUrl, sortProducts } from "../src/lib/types";
const store = new Map<string, string>();
vi.stubGlobal("localStorage", {
  getItem: (key: string) => store.get(key) || null,
  setItem: (key: string, value: string) => store.set(key, value),
  removeItem: (key: string) => store.delete(key),
});
beforeEach(() => {
  store.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-11T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());
describe("local community experience", () => {
  it("requires identity for write actions", async () => {
    await expect(repository.vote("demo-1", true)).rejects.toThrow("Join");
  });
  it("persists votes without duplicates and resets at UTC midnight", async () => {
    await repository.login("Test Explorer");
    await repository.vote("demo-1", true);
    await repository.vote("demo-1", true);
    let data = await repository.load();
    expect(data.products[0].votes_today).toBe(249);
    expect(data.votes).toEqual(["demo-1"]);
    vi.setSystemTime(new Date("2026-10-12T00:00:01Z"));
    data = await repository.load();
    expect(data.products[0].votes_today).toBe(0);
    expect(data.votes).toHaveLength(0);
    const yesterday = await repository.load("2026-10-11");
    expect(yesterday.products[0].votes_today).toBe(249);
  });
  it("issues a single trial code and preserves the demo identity after signout", async () => {
    await repository.login("Test Explorer");
    const id = (await repository.load()).profile!.id;
    const code = await repository.claim("demo-1");
    expect(await repository.claim("demo-1")).toBe(code);
    expect((await repository.load()).claims).toHaveLength(1);
    await repository.logout();
    await repository.login("Test Explorer");
    expect((await repository.load()).profile!.id).toBe(id);
  });
  it("launches products, saves them, and enforces maker edits", async () => {
    await repository.login("Test Maker");
    const input = {
      name: "New Product",
      tagline: "Something useful.",
      description: "A product that solves a meaningful problem for its users.",
      category: "Design",
      tags: ["Test"],
      website: "https://example.com",
      trial_label: "",
      trial_limit: 10,
      screenshot_url: "",
      resource_url: "",
      resource_name: "",
    };
    const id = await repository.create(input);
    await repository.save(id, true);
    await repository.update(id, { ...input, name: "Better Product" });
    const data = await repository.load();
    expect(data.saved).toContain(id);
    expect(data.products.find((p) => p.id === id)?.name).toBe("Better Product");
    await expect(repository.update("demo-1", input)).rejects.toThrow(
      "Only the maker",
    );
  });
  it("accepts useful feedback but rejects repeat reviews", async () => {
    await repository.login("Reviewer");
    await repository.feedback(
      "demo-1",
      "review",
      "Useful forms for my small team.",
      5,
    );
    await expect(
      repository.feedback(
        "demo-1",
        "review",
        "Another review for the same product.",
        4,
      ),
    ).rejects.toThrow("already reviewed");
    expect((await repository.load()).products[0].reviews_count).toBe(13);
  });
  it("rejects executable URL schemes and sorts ties deterministically", () => {
    expect(safeUrl("javascript:alert(1)")).toBe("");
    expect(safeUrl("https://example.com")).toBe("https://example.com/");
    const items = [
      { id: "b", votes_today: 1, created_at: "2026-01-01" },
      { id: "a", votes_today: 1, created_at: "2026-01-01" },
    ] as any;
    expect(sortProducts(items).map((p) => p.id)).toEqual(["a", "b"]);
  });
});
