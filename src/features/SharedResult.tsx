import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { z } from "zod";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { onlineClient, onlineConfigured } from "../services/online";
import { gameById } from "../games/registry";
import { gameIds } from "../domain/types";
const summarySchema = z.object({
  gameId: z.enum(gameIds),
  protocol: z.number(),
  mode: z.string(),
  input: z.string(),
  completedAt: z.string(),
  primary: z.object({
    label: z.string(),
    value: z.number().finite(),
    unit: z.string(),
    digits: z.number().optional(),
  }),
});
export default function SharedResult() {
  const { shareId } = useParams();
  const [summary, setSummary] = useState<z.infer<typeof summarySchema> | null>(
      null,
    ),
    [message, setMessage] = useState("Opening shared result…");
  useEffect(() => {
    let alive = true;
    if (!onlineConfigured || !z.string().uuid().safeParse(shareId).success) {
      setMessage("This public result link is not available.");
      return;
    }
    void onlineClient()
      .then(async (client) => {
        const result = await client.rpc("read_shared_result", {
          p_share: shareId,
        });
        const parsed = summarySchema.safeParse(result.data);
        if (!alive) return;
        if (result.error || !parsed.success)
          setMessage(
            "This result link has expired, was revoked, or is not available.",
          );
        else setSummary(parsed.data);
      })
      .catch(() => {
        if (alive)
          setMessage(
            "The shared result could not be opened. Please try again later.",
          );
      });
    return () => {
      alive = false;
    };
  }, [shareId]);
  return (
    <div className="page">
      <div className="page-heading">
        <h1>{summary ? gameById[summary.gameId].name : "Shared result"}</h1>
      </div>
      {summary ? (
        <section className="session-state">
          <span className="result-label">{summary.primary.label}</span>
          <div className="result-number">
            {summary.primary.value.toFixed(summary.primary.digits ?? 0)}
            <span>{summary.primary.unit}</span>
          </div>
          <p>
            {summary.mode} · {summary.input} · protocol v{summary.protocol} ·{" "}
            {new Date(summary.completedAt).toLocaleDateString()}
          </p>
          <p>
            <ShieldCheck size={14} />
            Personal game performance. This card makes no population-rank claim.
          </p>
          <Link className="button primary" to={`/play/${summary.gameId}`}>
            Try it yourself <ArrowRight size={16} />
          </Link>
        </section>
      ) : (
        <section className="session-state">
          <p role="status">{message}</p>
          <Link className="button primary" to="/games">
            Play a game <ArrowRight size={16} />
          </Link>
        </section>
      )}
    </div>
  );
}
