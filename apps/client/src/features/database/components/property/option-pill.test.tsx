import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { OptionPill } from "./option-pill";
import { resolveOptionColor } from "./option-colors";

function renderPill(color: string | undefined, label: string) {
  return render(
    <MantineProvider>
      <OptionPill color={color} label={label} />
    </MantineProvider>,
  );
}

describe("OptionPill", () => {
  it("renders the label text", () => {
    renderPill("blue", "Todo");
    expect(screen.getByText("Todo")).toBeTruthy();
  });

  it("fills the pill with the resolved color background", () => {
    renderPill("green", "Doing");
    const pill = screen.getByText("Doing");
    expect(pill.style.background).toContain(
      hexToRgb(resolveOptionColor("green").bg),
    );
  });

  it("falls back to the default color for an unknown key", () => {
    renderPill("not-a-color", "Mystery");
    const pill = screen.getByText("Mystery");
    expect(pill.style.background).toContain(
      hexToRgb(resolveOptionColor("not-a-color").bg),
    );
  });
});

// jsdom serializes inline backgrounds as rgb(); convert the palette hex so the
// assertion is robust to that normalization.
function hexToRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
}
