import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewspaperPages } from "@/components/reader/newspaper-pages";
import type { NewspaperPage } from "@/types/api";

const pages: NewspaperPage[] = [1, 2, 3].map((pageNumber) => ({
  page_number: pageNumber,
  image_url: `https://publisher.example.com/page-${pageNumber}.avif`,
  proxy_url: `/api/v1/images?page=${pageNumber}`,
  label: `Test Edition Page No-${pageNumber}`,
  alt: `Test Edition Page No-${pageNumber}`,
}));

describe("NewspaperPages", () => {
  it("renders every public page and opens a keyboard-navigable viewer", () => {
    render(<NewspaperPages pages={pages} editionTitle="Test Edition" />);

    expect(screen.getByRole("heading", { name: "All 3 pages" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open page 1 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open page 2 of 3" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open page 3 of 3" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open page 2 of 3" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Page 2 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Next page" }));
    expect(screen.getByText("Page 3 of 3")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Close page viewer" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
