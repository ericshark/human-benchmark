import { useState } from "react";
import {
  Cloud,
  LogIn,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useOnline } from "../app/OnlineContext";
import { onlineRequest } from "../services/online";

export function OnlineAccount() {
  const online = useOnline();
  const [email, setEmail] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [deleteConfirm, setDeleteConfirm] = useState(false),
    [uploadConfirm, setUploadConfirm] = useState(false);
  async function run(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await operation();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Online operation failed.",
      );
    } finally {
      setBusy(false);
    }
  }
  if (!online.configured)
    return (
      <section className="panel settings-section">
        <div>
          <h2>Take your discoveries with you</h2>
          <p>
            Optional online accounts are supported when a backend is connected.
            Your local games, history, and backups are available now.
          </p>
        </div>
        <div className="privacy-state">
          <Cloud size={24} />
          <strong>Online services are not connected</strong>
          <span>No account is required to keep playing.</span>
        </div>
      </section>
    );
  return (
    <section className="panel settings-section online-account">
      <div>
        <h2>Optional online profile</h2>
        <p>
          Keep your sessions across devices, and separately choose whether to
          contribute to population statistics. Imported local results remain
          personal history.
        </p>
        {online.user && (
          <p>
            <UserRound size={13} />{" "}
            {online.user.email ?? "Anonymous online explorer"}
          </p>
        )}
      </div>
      <div className="online-controls">
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {online.error && (
          <p className="error-text" role="alert">
            {online.error}
          </p>
        )}
        {online.status && <p role="status">{online.status}</p>}
        {!online.user ? (
          <>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void run(() => online.signIn(email));
              }}
            >
              <label htmlFor="account-email">Email for a sign-in link</label>
              <input
                id="account-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
              <button className="button secondary" disabled={busy}>
                <Mail size={15} />
                Email me a sign-in link
              </button>
            </form>
            <button
              className="text-link"
              disabled={busy}
              onClick={() => {
                void run(online.signInGuest);
              }}
            >
              <LogIn size={14} />
              Continue with an anonymous online identity
            </button>
            <p className="small-note">
              Anonymous access must be enabled by the service operator. Clearing
              browser data loses access unless you link an email.
            </p>
          </>
        ) : (
          <>
            {online.user.is_anonymous && (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void run(() => online.signIn(email));
                }}
              >
                <label htmlFor="link-email">Link email to this identity</label>
                <input
                  id="link-email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <button className="button secondary" disabled={busy}>
                  Send verification link
                </button>
              </form>
            )}
            {!online.profile && (
              <button
                className="button secondary"
                disabled={busy}
                onClick={() => {
                  void run(() => online.setPreferences(false, false));
                }}
              >
                <ShieldCheck size={15} />
                Create my private profile
              </button>
            )}
            {online.profile && (
              <>
                <label className="toggle-row">
                  <span>
                    Sync future sessions to my account
                    <small>
                      Your existing local history uploads only when you choose
                      it below.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={online.profile.sync_enabled}
                    disabled={busy}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      void run(() =>
                        online.setPreferences(
                          enabled,
                          online.profile!.statistics_consent,
                        ),
                      );
                    }}
                  />
                </label>
                <label className="toggle-row">
                  <span>
                    Contribute qualifying assessments
                    <small>
                      Opt in to population statistics. Rated sessions require a
                      separate start action.
                    </small>
                  </span>
                  <input
                    type="checkbox"
                    checked={online.profile.statistics_consent}
                    disabled={busy}
                    onChange={(event) => {
                      const enabled = event.target.checked;
                      void run(() =>
                        online.setPreferences(
                          online.profile!.sync_enabled,
                          enabled,
                        ),
                      );
                    }}
                  />
                </label>
              </>
            )}
            {online.profile?.sync_enabled &&
              (uploadConfirm ? (
                <div className="upload-confirm">
                  <p>
                    Upload existing local sessions to this account and download
                    its history? Local imports will not become rated results.
                  </p>
                  <div className="inline-actions">
                    <button
                      className="button primary"
                      disabled={busy || online.busy}
                      onClick={() => {
                        void run(async () => {
                          await online.syncNow();
                          setUploadConfirm(false);
                        });
                      }}
                    >
                      Sync this history
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setUploadConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="button secondary"
                  disabled={busy || online.busy}
                  onClick={() => setUploadConfirm(true)}
                >
                  <RefreshCw size={15} />
                  Sync existing history & retry uploads
                </button>
              ))}
            <button
              className="button ghost"
              onClick={() => {
                void run(online.signOut);
              }}
              disabled={busy}
            >
              <LogOut size={15} />
              Sign out
            </button>
            {!!online.shares.length && (
              <div className="share-list">
                <h3>Public result links</h3>
                {online.shares.map((share) => (
                  <div key={share.id}>
                    <a
                      href={`/share/${share.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Result · {new Date(share.created_at).toLocaleDateString()}
                    </a>
                    <button
                      className="text-link"
                      disabled={busy}
                      onClick={() => {
                        void run(async () => {
                          await onlineRequest({
                            action: "revoke-share",
                            shareId: share.id,
                          });
                          await online.refresh();
                        });
                      }}
                    >
                      Revoke link
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="online-delete">
              {deleteConfirm ? (
                <>
                  <p className="error-text">
                    Delete your online account, sessions, and public links?
                    Local history will remain.
                  </p>
                  <div className="inline-actions">
                    <button
                      className="button danger"
                      disabled={busy}
                      onClick={() => {
                        void run(online.deleteAccount);
                      }}
                    >
                      Delete online account
                    </button>
                    <button
                      className="button secondary"
                      onClick={() => setDeleteConfirm(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              ) : (
                <button
                  className="text-link error-text"
                  onClick={() => setDeleteConfirm(true)}
                >
                  <Trash2 size={14} />
                  Delete online account and data
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
