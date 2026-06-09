import { screen } from "electron";
import type { StatusBarPlacement, StatusBarBounds } from "../../../shared/types";

const BASE_HEIGHT = 48; // Approximate: system icon size / 2
const CAPSULE_LENGTH = 280;
const MIN_LENGTH = 120;

export interface GeometryConfig {
  lightMode: "single" | "triple";
  quotaSlotCount: number;
}

export function computeBounds(
  placement: StatusBarPlacement,
  config: GeometryConfig,
): StatusBarBounds {
  const display = resolveDisplay(placement.displayId);
  const { workArea } = display;

  const isHorizontal = placement.edge === "top" || placement.edge === "bottom";

  // Compute capsule length based on content
  let length = CAPSULE_LENGTH;
  if (config.lightMode === "triple") length += 40;
  length += config.quotaSlotCount * 60;
  length = Math.max(MIN_LENGTH, length);

  const height = BASE_HEIGHT;
  const offsetRatio = placement.offsetRatio;

  if (isHorizontal) {
    const w = Math.min(length, workArea.width - 20);
    const x = Math.round(workArea.x + (workArea.width - w) * offsetRatio);
    const y = placement.edge === "top"
      ? workArea.y
      : workArea.y + workArea.height - height;
    return { x, y, width: w, height };
  } else {
    const h = Math.min(length, workArea.height - 20);
    const w = height;
    const x = placement.edge === "left"
      ? workArea.x
      : workArea.x + workArea.width - w;
    const y = Math.round(workArea.y + (workArea.height - h) * offsetRatio);
    return { x, y, width: w, height: h };
  }
}

export function computePlacementFromPosition(
  mouseX: number,
  mouseY: number,
): StatusBarPlacement {
  const display = screen.getDisplayNearestPoint({ x: mouseX, y: mouseY });
  const { workArea } = display;

  const distances = {
    top: mouseY - workArea.y,
    bottom: (workArea.y + workArea.height) - mouseY,
    left: mouseX - workArea.x,
    right: (workArea.x + workArea.width) - mouseX,
  };

  const edge = (Object.entries(distances).sort(([, a], [, b]) => a - b)[0][0]) as StatusBarPlacement["edge"];

  const isHorizontal = edge === "top" || edge === "bottom";
  let offsetRatio: number;
  if (isHorizontal) {
    offsetRatio = (mouseX - workArea.x) / workArea.width;
  } else {
    offsetRatio = (mouseY - workArea.y) / workArea.height;
  }
  offsetRatio = Math.max(0.05, Math.min(0.95, offsetRatio));

  return {
    edge,
    displayId: display.id.toString(),
    offsetRatio,
  };
}

function resolveDisplay(displayId: string): Electron.Display {
  const displays = screen.getAllDisplays();
  const found = displays.find((d) => d.id.toString() === displayId);
  if (found) return found;
  return screen.getPrimaryDisplay();
}
