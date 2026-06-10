import { screen } from "electron";
import type { StatusBarPlacement, StatusBarBounds } from "../../../shared/types";

const BASE_HEIGHT = 64;
const HORIZONTAL_HEIGHT = 52;
const CAPSULE_LENGTH = 340;
const MIN_LENGTH = 160;
const SCREEN_EDGE_OVERLAP = 5;
const TOP_EDGE_Y_OFFSET = 3;

export interface GeometryConfig {
  lightMode: "single" | "triple";
  quotaSlotCount: number;
}

export function computeBounds(
  placement: StatusBarPlacement,
  config: GeometryConfig,
): StatusBarBounds {
  const display = resolveDisplay(placement.displayId);
  const { bounds } = display;

  const isHorizontal = placement.edge === "top" || placement.edge === "bottom";

  // Compute capsule length based on content
  let length = CAPSULE_LENGTH;
  if (config.lightMode === "triple") length += 58;
  length += config.quotaSlotCount * 60;
  length = Math.max(MIN_LENGTH, length);

  const height = isHorizontal ? HORIZONTAL_HEIGHT : BASE_HEIGHT;
  const offsetRatio = placement.offsetRatio;

  // 顶部贴显示器物理边缘；底部贴 workArea 底边（即任务栏上方）。
  if (isHorizontal) {
    const w = Math.min(length, bounds.width - 20);
    const x = Math.round(bounds.x + (bounds.width - w) * offsetRatio);
    if (placement.edge === "top") {
      const y = bounds.y - SCREEN_EDGE_OVERLAP + TOP_EDGE_Y_OFFSET;
      return { x, y, width: w, height };
    } else {
      const workArea = display.workArea;
      const y = workArea.y + workArea.height - height + SCREEN_EDGE_OVERLAP;
      return { x, y, width: w, height };
    }
  } else {
    const h = Math.min(length, bounds.height - 20);
    const w = height;
    const x = placement.edge === "left"
      ? bounds.x - SCREEN_EDGE_OVERLAP
      : bounds.x + bounds.width - w + SCREEN_EDGE_OVERLAP;
    const y = Math.round(bounds.y + (bounds.height - h) * offsetRatio);
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
