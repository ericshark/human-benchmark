import type { CSSProperties } from "react";
import type { CategoryId } from "../domain/types";
import { getCategory } from "./definitions";

export * from "./definitions";

export function accentStyle(id: CategoryId): CSSProperties {
  return { "--cat": getCategory(id).color } as CSSProperties;
}
