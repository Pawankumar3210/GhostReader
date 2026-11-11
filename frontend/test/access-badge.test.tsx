import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AccessBadge } from "@/components/reader/access-badge";

describe("AccessBadge", () => {
  it("renders a trustworthy public label", () => {
    render(<AccessBadge status="PUBLIC_FULL" />);
    expect(screen.getByText("Public · full text")).toBeInTheDocument();
  });

  it("makes a subscription boundary explicit", () => {
    render(<AccessBadge status="SUBSCRIPTION_REQUIRED" />);
    expect(screen.getByText("Subscription required")).toBeInTheDocument();
  });
});
