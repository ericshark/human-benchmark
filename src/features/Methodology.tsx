import { Link } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { games } from "../games/registry";

export default function Methodology() {
  return (
    <div className="page methodology-page">
      <div className="page-heading">
        <span className="eyebrow">
          <ShieldCheck size={16} />
          BEHIND THE NUMBERS
        </span>
        <h1>
          Curiosity deserves
          <br />a little clarity.
        </h1>
        <p>What we measure, what we show, and where the limits are.</p>
      </div>
      <div className="methodology-intro panel">
        <h2>Your play. Your actual results.</h2>
        <p>
          HumanRank measures performance in browser games. Your history starts
          empty and grows from completed sessions. Personal records and charts
          come from your play; there are no simulated global rankings.
        </p>
        <p>
          These games do not diagnose health, measure intelligence, or define
          your worth. Sleep, practice, familiarity, accessibility needs, and
          hardware can affect a session.
        </p>
      </div>
      <div className="methodology-grid">
        <section className="panel">
          <span className="eyebrow">01 / MEASUREMENT</span>
          <h2>Milliseconds, with context.</h2>
          <p>
            We use a monotonic browser clock and align visual stimuli to
            rendering frames. This estimates browser-level response time; it
            does not measure the exact instant light reaches your eyes.
          </p>
          <p>
            Display refresh, input devices, browser scheduling, and hardware add
            latency. Compare personal sessions using the same setup. A hidden
            tab, focus loss, or resized arena interrupts assessment instead of
            silently changing timing.
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">02 / PERSONAL RECORDS</span>
          <h2>Same game. Same conditions.</h2>
          <p>
            Records and trends are grouped by game version, mode, and input.
            Practice tutorials are shorter and are not saved. Daily circuits use
            shared seeds and have separate history.
          </p>
          <p>
            Mistakes and timeouts stay in the calculation. Suspiciously short
            responses receive a visible quality flag; slow or inaccurate
            performance is never removed simply for being low.
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">03 / POPULATION RANKINGS</span>
          <h2>Real players come first.</h2>
          <p>
            Percentiles, category ratings, and HumanRank are currently
            unavailable. They require real, opted-in, qualifying player
            distributions under comparable protocols.
          </p>
          <p>
            The planned index gives six categories equal weight. Its actual
            overall percentile must be calculated separately against complete
            profiles. More attempts will not add rating points or give a player
            extra population weight.
          </p>
        </section>
        <section className="panel">
          <span className="eyebrow">04 / PROFILE RARITY</span>
          <h2>Unusual is its own dimension.</h2>
          <p>
            Strong overall performance and an unusual balance of results are
            different things. Rarity will use observed joint profiles, account
            for correlations, and require independent calibration.
          </p>
          <p>
            We will not multiply category percentiles or invert an anomaly score
            into a “1 in X people like you” claim. When evidence is
            insufficient, the comparison stays unavailable.
          </p>
        </section>
      </div>
      <section className="panel protocol-list">
        <span className="eyebrow">GAME PROTOCOLS / VERSION 1</span>
        <h2>Every game has its own yardstick.</h2>
        {games.map((game) => (
          <details key={game.id}>
            <summary>
              {game.name}
              <span>{game.category}</span>
            </summary>
            <p>{game.measurement}</p>
            <Link className="text-link" to={`/play/${game.id}`}>
              Try this game <ArrowRight size={14} />
            </Link>
          </details>
        ))}
      </section>
      <section className="notice">
        <ShieldCheck size={23} />
        <div>
          <strong>Your data stays in your hands.</strong>
          <p>
            Local sessions live in this browser’s IndexedDB storage. Export a
            backup, import it elsewhere, or delete it in Settings. Browser
            storage can be cleared by you or evicted by the browser.
          </p>
        </div>
      </section>
    </div>
  );
}
