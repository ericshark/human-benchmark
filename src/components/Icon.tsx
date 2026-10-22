import {
  Zap,
  Route,
  Grid2X2,
  Waypoints,
  Palette,
  Shuffle,
  Shapes,
  Rotate3D,
  Crosshair,
  Orbit,
  ScanLine,
  Calculator,
  Brain,
  Activity,
  Focus,
  Gauge,
  type LucideProps,
} from "lucide-react";
const icons = {
  zap: Zap,
  route: Route,
  grid: Grid2X2,
  waypoints: Waypoints,
  palette: Palette,
  switch: Shuffle,
  puzzle: Shapes,
  rotate: Rotate3D,
  target: Crosshair,
  orbit: Orbit,
  scan: ScanLine,
  calculator: Calculator,
  reflexes: Zap,
  memory: Brain,
  focus: Focus,
  reasoning: Shapes,
  precision: Crosshair,
  processing: Gauge,
};
export function Icon({ name, ...props }: LucideProps & { name: string }) {
  const Component = icons[name as keyof typeof icons] ?? Activity;
  return <Component {...props} />;
}
