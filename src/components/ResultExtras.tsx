import { useState } from "react";
import { useApp } from "../app/AppContext";
import { useOnline } from "../app/OnlineContext";
import { onlineRequest } from "../services/online";
import type { Session } from "../domain/types";
export function ResultExtras({ session }: { session: Session }) {
  const { saveSession } = useApp(),
    online = useOnline();
  const [note, setNote] = useState(session.note ?? ""),
    [message, setMessage] = useState("");
  const [sharePreview, setSharePreview] = useState(false),
    [shareLink, setShareLink] = useState(""),
    [shareError, setShareError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <>
      <section className="panel session-notes">
        <div>
          <span className="eyebrow">YOUR PRIVATE FIELD NOTES</span>
          <h2>What did you notice?</h2>
          <p>
            Optionally note the conditions of this session. Notes are included
            in your local backup and excluded from public cards.
          </p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void saveSession({ ...session, note: note.trim() }).then(() =>
              setMessage("Note saved to this browser."),
            );
          }}
        >
          <label className="sr-only" htmlFor="session-note">
            Private session note
          </label>
          <textarea
            id="session-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            maxLength={300}
            placeholder="A small observation, for next time…"
          />
          <div className="inline-actions">
            <button className="button secondary">Save note</button>
            <span className="small-note" role="status">
              {message}
            </span>
          </div>
        </form>
      </section>
      {online.user && (
        <section className="panel share-panel">
          <h2>Share a discovery.</h2>
          <p>
            Your public card contains the game, measurement, input, protocol,
            and date. It excludes your name, email, and private notes. Links
            expire after 90 days and can be revoked in Settings.
          </p>
          {shareError && (
            <p className="error-text" role="alert">
              {shareError}
            </p>
          )}
          {shareLink ? (
            <a
              className="text-link"
              href={shareLink}
              target="_blank"
              rel="noreferrer"
            >
              Open public result ↗
            </a>
          ) : sharePreview ? (
            <div className="inline-actions">
              <button
                className="button primary"
                disabled={busy}
                onClick={() => {
                  setBusy(true);
                  setShareError("");
                  void (async () => {
                    const owner = online.user?.id;
                    if (
                      !owner ||
                      (session.onlineOwner && session.onlineOwner !== owner)
                    )
                      throw new Error(
                        "Sign in to the account that owns this result before sharing it.",
                      );
                    if (!online.profile?.sync_enabled)
                      throw new Error(
                        "Enable synchronization in Settings before uploading a result for sharing.",
                      );
                    await onlineRequest(
                      {
                        action: "sync",
                        sessions: [session],
                      },
                      owner,
                    );
                    const response = await onlineRequest<{
                      share: { id: string };
                    }>({ action: "share", sessionId: session.id }, owner);
                    setShareLink(
                      `${window.location.origin}/share/${response.share.id}`,
                    );
                    await online.refresh();
                  })()
                    .catch((cause) => setShareError(cause.message))
                    .finally(() => setBusy(false));
                }}
              >
                Upload & create public link
              </button>
              <button
                className="button secondary"
                onClick={() => setSharePreview(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="button secondary"
              onClick={() => setSharePreview(true)}
            >
              Preview public sharing
            </button>
          )}
        </section>
      )}
    </>
  );
}
