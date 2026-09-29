export type Tool =
  | "move"
  | "select"
  | "crop"
  | "brush"
  | "pen"
  | "eraser"
  | "text"
  | "fill"
  | "picker";

export interface Stroke {
  tool: "brush" | "pen" | "eraser";
  color: string;
  size: number;
  points: { x: number; y: number }[];
}

export interface Layer {
  id: string;
  naziv: string;
  vidljiv: boolean;
  opacity: number; // 0..100
}

export interface Adjustments {
  brightness: number; // 0..200 (100 = neutral)
  contrast: number; // 0..200
  saturation: number; // 0..200
}

export const NEUTRAL_ADJ: Adjustments = {
  brightness: 100,
  contrast: 100,
  saturation: 100,
};
