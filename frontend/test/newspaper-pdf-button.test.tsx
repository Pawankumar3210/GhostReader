import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NewspaperPdfButton } from "@/components/reader/newspaper-pdf-button";
import type { NewspaperPage } from "@/types/api";

const pages: NewspaperPage[] = [1, 2, 3].map((pageNumber) => ({
  page_number: pageNumber,
  image_url: `https://publisher.example.com/page-${pageNumber}.avif`,
  proxy_url: `/api/v1/images?page=${pageNumber}`,
  label: `Test Edition Page No-${pageNumber}`,
  alt: `Test Edition Page No-${pageNumber}`,
}));

describe("NewspaperPdfButton", () => {
  it("opens a naming dialog with a useful default and page count", () => {
    render(
      <NewspaperPdfButton pages={pages} title="Test Edition" publishedAt="2026-11-10T12:00:00Z" />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Download all 3 pages as PDF" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByLabelText("PDF file name")).toHaveValue(
      "Test Edition - November 10, 2026.pdf",
    );
    expect(screen.getByText(/All 3 newspaper pages/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "High" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "Low" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("radio", { name: "Medium" }));
    expect(screen.getByRole("radio", { name: "Medium" })).toBeChecked();
    expect(screen.getByRole("radio", { name: "High" })).not.toBeChecked();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders nothing without newspaper pages", () => {
    const { container } = render(
      <NewspaperPdfButton pages={[]} title="Article" publishedAt={null} />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
