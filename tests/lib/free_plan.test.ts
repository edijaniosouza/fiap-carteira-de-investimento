import { describe, expect, it } from "vitest";
import { FREE_PLAN_LIMITS } from "@/lib/free_plan";
import { cn } from "@/lib/utils";

describe("free_plan", () => {
  it("allows a single portfolio", () => {
    expect(FREE_PLAN_LIMITS.max_portfolios).toBe(1);
  });
});

describe("utils", () => {
  it("re-exports cn to join class names", () => {
    expect(cn("a", false && "b", "c")).toContain("a");
    expect(cn("a", false && "b", "c")).toContain("c");
    expect(cn("a", false && "b", "c")).not.toContain("b");
  });
});
