import { useState } from "react";
import {
  Check,
  Download,
  HardDrive,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  Upload,
} from "lucide-react";
import { useApp } from "../app/AppContext";
import type { InputClass } from "../domain/types";
import { OnlineAccount } from "../components/OnlineAccount";
import { useOnline } from "../app/OnlineContext";

export default function Settings() {
  const online = useOnline();
  const {
    settings,
    updateSettings,
    exportData,
    importData,
    deleteData,
    sessions,
  } = useApp();
  const [name, setName] = useState(settings.name),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false),
    [busy, setBusy] = useState(false);
  async function importFile(file?: File) {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("Choose a backup smaller than 10 MB.");
      const count = await importData(await file.text());
      setMessage(
        `Backup validated. ${count} sessions processed; existing records were preserved.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "This backup could not be imported.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="page settings-page">
      <div className="page-heading">
        <span className="eyebrow">MAKE YOURSELF AT HOME</span>
        <h1>Your playground. Your preferences.</h1>
        <p>
          Your data belongs to you. Keep it local, take a copy, or start fresh.
        </p>
      </div>
      <div role="status" aria-live="polite">
        {message && (
          <div className="notice">
            <Check size={20} />
            <p>{message}</p>
          </div>
        )}
      </div>
      {error && (
        <div className="notice warning" role="alert">
          {error}
        </div>
      )}
      <section className="panel settings-section">
        <div>
          <h2>Your local profile</h2>
          <p>A name for your own discoveries. No account or email required.</p>
        </div>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) {
              setError("Please enter a name.");
              return;
            }
            updateSettings({ ...settings, name: name.trim() });
            setError("");
            setMessage("Your name is saved in this browser.");
          }}
        >
          <label htmlFor="display-name">Explorer name</label>
          <div className="inline-actions">
            <input
              id="display-name"
              maxLength={32}
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
            <button className="button secondary" type="submit">
              Save name
            </button>
          </div>
        </form>
      </section>
      <section className="panel settings-section">
        <div>
          <h2>Your input setup</h2>
          <p>
            Mouse and trackpad cannot be reliably distinguished by the browser.
            Tell us which you use; comparable records stay grouped together.
          </p>
        </div>
        <label className="setting-field">
          Preferred input
          <select
            value={settings.input}
            onChange={(event) =>
              updateSettings({
                ...settings,
                input: event.target.value as InputClass,
              })
            }
          >
            {["mouse", "trackpad", "touch", "keyboard"].map((input) => (
              <option key={input} value={input}>
                {input[0].toUpperCase() + input.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </section>
      <section className="panel settings-section">
        <div>
          <h2>Make it feel right</h2>
          <p>Quiet by default. Clear feedback. Choose what works for you.</p>
        </div>
        <div className="preference-controls">
          <div className="theme-options">
            <button
              className={`button secondary ${settings.theme === "dark" ? "selected-option" : ""}`}
              aria-pressed={settings.theme === "dark"}
              onClick={() => updateSettings({ ...settings, theme: "dark" })}
            >
              <Moon size={16} />
              Dark
            </button>
            <button
              className={`button secondary ${settings.theme === "light" ? "selected-option" : ""}`}
              aria-pressed={settings.theme === "light"}
              onClick={() => updateSettings({ ...settings, theme: "light" })}
            >
              <Sun size={16} />
              Light
            </button>
          </div>
          <label className="toggle-row">
            <span>
              Reduce decorative motion
              <small>Your system preference is also respected.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.reducedMotion}
              onChange={(event) =>
                updateSettings({
                  ...settings,
                  reducedMotion: event.target.checked,
                })
              }
            />
          </label>
          <label className="toggle-row">
            <span>
              Completion sound
              <small>A subtle note after your session ends.</small>
            </span>
            <input
              type="checkbox"
              checked={settings.sound}
              onChange={(event) =>
                updateSettings({ ...settings, sound: event.target.checked })
              }
            />
          </label>
        </div>
      </section>
      <section className="panel settings-section">
        <div>
          <h2>Your local history</h2>
          <p>
            {sessions.length} sessions in this browser. Browser storage may be
            cleared or evicted; an exported backup gives you a copy.
          </p>
        </div>
        <div className="data-actions">
          <button className="button secondary" onClick={exportData}>
            <Download size={16} />
            Export my data
          </button>
          <label className="button secondary file-button">
            <Upload size={16} />
            {busy ? "Validating backup…" : "Import a backup"}
            <input
              type="file"
              accept="application/json,.json"
              aria-label="Import a backup"
              disabled={busy}
              onChange={(event) => {
                void importFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </label>
          <button
            className="button ghost"
            onClick={() => {
              void (async () => {
                try {
                  const granted = await navigator.storage?.persist();
                  setMessage(
                    granted
                      ? "Persistent storage is enabled. You can still delete data in your browser settings."
                      : "This browser did not grant persistent storage. Keep an exported backup.",
                  );
                } catch {
                  setError(
                    "Persistent storage is not available in this browser.",
                  );
                }
              })();
            }}
          >
            <HardDrive size={16} />
            Protect local storage
          </button>
        </div>
      </section>
      <section className="panel settings-section">
        <div>
          <h2>Privacy, by default</h2>
          <p>
            Local play sends no game results to a server. Online synchronization
            and population statistics will require explicit choices when
            enabled.
          </p>
        </div>
        <div className="privacy-state">
          <ShieldCheck size={23} />
          <strong>
            {online.user ? "Online profile is optional" : "Local-only profile"}
          </strong>
          <span>
            Population contribution:{" "}
            {online.profile?.statistics_consent ? "on" : "off"}
          </span>
          <span>Public profile: off</span>
        </div>
      </section>
      <OnlineAccount />
      <section className="panel settings-section danger-section">
        <div>
          <h2>A fresh start</h2>
          <p>
            Delete all local sessions, preferences, and circuit progress from
            this browser. Export a backup first if you want to keep them.
          </p>
        </div>
        <div>
          {confirmDelete ? (
            <>
              <p className="error-text">
                Permanently delete all local history and settings?
              </p>
              <div className="inline-actions">
                <button
                  className="button danger"
                  disabled={busy}
                  onClick={() => {
                    setBusy(true);
                    void deleteData()
                      .then(() => {
                        setConfirmDelete(false);
                        setName("Explorer");
                        setMessage("Local history and preferences deleted.");
                      })
                      .catch(() =>
                        setError(
                          "Deletion could not be completed. Please check your browser storage.",
                        ),
                      )
                      .finally(() => setBusy(false));
                  }}
                >
                  Yes, delete local data
                </button>
                <button
                  className="button secondary"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep my data
                </button>
              </div>
            </>
          ) : (
            <button
              className="button danger"
              onClick={() => setConfirmDelete(true)}
            >
              <Trash2 size={16} />
              Delete local data
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
