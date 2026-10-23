import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight, LockKeyhole, Sparkles } from "lucide-react";
import { useOnline } from "../app/OnlineContext";
import { useApp } from "../app/AppContext";
import { onlineRequest } from "../services/online";
import { categories } from "../games/registry";
import type { Comparison } from "../domain/statistics";
import type { Session } from "../domain/types";
interface RatingResponse extends Comparison {
  index?: number;
  categoryIndices?: number[];
  snapshotDate?: string;
  cohort?: string;
  history?: {
    id: string;
    reference_date: string;
    computed_at: string;
    humanrank_index: number;
  }[];
  rarity?: { reason: string; percentile?: number; interval?: [number, number] };
}
export function OnlineRatingSummary() {
  const online = useOnline(),
    { settings } = useApp();
  const [rating, setRating] = useState<RatingResponse | null>(null),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!online.user || !online.profile?.statistics_consent) {
      setRating(null);
      return;
    }
    let alive = true;
    const context =
      innerWidth < 600 ? "compact" : innerWidth < 1000 ? "medium" : "wide";
    void onlineRequest<RatingResponse>({
      action: "ratings",
      input: settings.input,
      context,
    })
      .then((result) => {
        if (alive) setRating(result);
      })
      .catch((cause) => {
        if (alive) setMessage(cause.message);
      });
    return () => {
      alive = false;
    };
  }, [online.user, online.profile?.statistics_consent, settings.input]);
  return (
    <section className="panel rank-preview">
      <div className="rank-icon">
        <Sparkles size={25} />
      </div>
      <span className="eyebrow">HUMANRANK & PROFILE RARITY</span>
      {rating?.index !== undefined ? (
        <>
          <h2>
            {rating.index}
            <small className="index-denominator"> / 1000</small>
          </h2>
          <p>
            {rating.percentile !== undefined
              ? `${rating.percentile}th percentile · ${rating.status}.`
              : "Overall percentile is not yet stable."}{" "}
            {rating.n} comparable complete profiles.
          </p>
          <div className="category-rating-bars">
            {rating.categoryIndices?.map((value, index) => (
              <div key={categories[index].id}>
                <span>{categories[index].name}</span>
                <progress
                  value={value}
                  max={100}
                  aria-label={`${categories[index].name} index`}
                />
                <strong>{Math.round(value)}</strong>
              </div>
            ))}
          </div>
          <p className="small-note">
            Indices use equal category weights. They are not percentiles.{" "}
            {rating.interval &&
              `Overall percentile interval: ${rating.interval[0].toFixed(0)}–${rating.interval[1].toFixed(0)}.`}
          </p>
          {rating.rarity?.percentile !== undefined && (
            <p>
              <strong>
                Profile-shape unusualness: {rating.rarity.percentile}–
                {rating.rarity.percentile + 5} percentile band
              </strong>
              <br />
              Provisional ·{" "}
              {rating.rarity.interval &&
                `Reference-sample interval ${rating.rarity.interval[0].toFixed(0)}–${rating.rarity.interval[1].toFixed(0)}.`}
            </p>
          )}
          {!!rating.history?.length && (
            <details className="rating-history">
              <summary>Rating history · original references preserved</summary>
              <table>
                <thead>
                  <tr>
                    <th>Recorded</th>
                    <th>Index</th>
                    <th>Reference</th>
                  </tr>
                </thead>
                <tbody>
                  {rating.history.map((entry) => (
                    <tr key={entry.id}>
                      <td>
                        {new Date(entry.computed_at).toLocaleDateString()}
                      </td>
                      <td>{entry.humanrank_index}</td>
                      <td>
                        {new Date(entry.reference_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          )}
          <p className="small-note">
            {rating.rarity?.reason} Reference:{" "}
            {rating.snapshotDate
              ? new Date(rating.snapshotDate).toLocaleDateString()
              : "unavailable"}{" "}
            · {rating.cohort}
          </p>
        </>
      ) : (
        <>
          <h2>
            Good data
            <br />
            comes first.
          </h2>
          <p>
            {message ||
              rating?.reason ||
              "Your personal measurements are ready as you play. Population rankings need real, comparable player data."}
          </p>
          <span className="availability-tag">
            <LockKeyhole size={13} />
            Awaiting qualifying evidence
            {rating ? ` · ${rating.n} profiles` : ""}
          </span>
        </>
      )}
      <Link to="/methodology" className="text-link">
        See what’s needed <ArrowUpRight size={14} />
      </Link>
    </section>
  );
}
export function PopulationComparison({ session }: { session: Session }) {
  const online = useOnline();
  const [comparison, setComparison] = useState<Comparison | null>(null);
  useEffect(() => {
    if (
      !online.user ||
      !online.profile?.statistics_consent ||
      session.mode !== "assessment"
    )
      return;
    let alive = true;
    void onlineRequest<Comparison>({ action: "comparisons", session })
      .then((value) => {
        if (alive) setComparison(value);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [online.user, online.profile?.statistics_consent, session]);
  return (
    <>
      {comparison?.percentile !== undefined ? (
        <>
          <strong>
            {comparison.percentile}th percentile · {comparison.status}
          </strong>
          <p>
            Against {comparison.n} comparable, qualifying HumanRank players.
            This uses your recent repeated assessments, not just this session.{" "}
            {comparison.interval &&
              `Sampling interval: ${comparison.interval[0].toFixed(0)}–${comparison.interval[1].toFixed(0)}.`}
          </p>
        </>
      ) : (
        <>
          <strong>Personal insight, grounded in your play.</strong>
          <p>
            {comparison?.reason ||
              "Population comparisons are not available yet. HumanRank only shows percentiles and profile rarity when enough comparable, qualifying player data exists."}{" "}
            <Link to="/methodology">How scoring works ↗</Link>
          </p>
        </>
      )}
    </>
  );
}
