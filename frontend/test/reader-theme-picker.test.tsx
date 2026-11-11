import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ReaderThemePicker } from "@/components/reader/reader-theme-picker";

describe("ReaderThemePicker", () => {
  it("offers paper, sepia and night themes", () => {
    const onChange = vi.fn();
    render(<ReaderThemePicker value="paper" onChange={onChange} />);

    expect(screen.getByRole("button", { name: "Paper" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Sepia" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Night" }));
    expect(onChange).toHaveBeenCalledWith("night");
  });
});
