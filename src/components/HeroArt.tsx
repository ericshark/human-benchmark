import type { CSSProperties } from "react";
import { accentStyle, categories } from "../games/registry";
import { Icon } from "./Icon";

/** Decorative ring of the six skills, one node per category. */
export function HeroArt() {
  return (
    <div className="hero-art" aria-hidden="true">
      <span className="hero-ring outer" />
      <span className="hero-ring inner" />
      <div className="hero-orbit">
        {categories.map((category, index) => (
          <span
            key={category.id}
            className="hero-node"
            style={
              {
                ...accentStyle(category.id),
                "--angle": `${index * 60 - 90}deg`,
              } as CSSProperties
            }
          >
            <span className="hero-node-inner">
              <Icon name={category.id} size={20} strokeWidth={1.75} />
            </span>
          </span>
        ))}
      </div>
      <span className="hero-core">
        <strong>6</strong>
        <small>skills</small>
      </span>
    </div>
  );
}
