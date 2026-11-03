import { useEffect, useRef, useState, type SyntheticEvent } from "react";
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Download,
  Film,
  FolderOpen,
  Globe,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  Square,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import {
  captureIdentity,
  recipeSchema,
  stepSchema,
  type Recipe,
  type Recording,
  type ExportResult,
  type Job,
  type Step,
} from "../shared/schema";
import { exampleRecipe } from "../shared/example";
import { readWorkspace, saveWorkspace, restoreExport } from "./workspace";

const bytes = (size: number) => `${(size / 1024 / 1024).toFixed(1)} MB`;
const seconds = (size: number) => `${size.toFixed(1)}s`;
const actionLabels = {
  click: "Click",
  fill: "Type",
  press: "Press key",
  scroll: "Scroll",
  wait: "Wait for",
  navigate: "Navigate",
  hover: "Hover",
  select: "Select option",
};

export function App() {
  const [savedWorkspace] = useState(() => {
    try {
      return readWorkspace(localStorage);
    } catch {
      return null;
    }
  });
  const drafts = useRef(savedWorkspace?.drafts || {});
  const [recipe, setRecipe] = useState<Recipe>(
    () => savedWorkspace?.recipe || exampleRecipe(location.origin),
  );
  const [selected, setSelected] = useState(0);
  const [token, setToken] = useState("");
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [output, setOutput] = useState<ExportResult | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [help, setHelp] = useState(false);
  const [settings, setSettings] = useState(false);
  const [inspector, setInspector] = useState<"scene" | "frame">("scene");
  const [view, setView] = useState<"cut" | "source">("cut");
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState("");
  const [history, setHistory] = useState<Recipe[]>([]);
  const [opening, setOpening] = useState(true);
  const [storageWarning, setStorageWarning] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const step = recipe.steps[selected] || recipe.steps[0];
  const running = job?.status === "running";
  const busy = opening || running;
  const matches = recording
    ? captureIdentity(recording.recipe) === captureIdentity(recipe)
    : false;
  const stale = output
    ? JSON.stringify(output.recipe) !== JSON.stringify(recipe)
    : false;
  const scene = recording?.scenes.find((item) => item.stepId === step.id);
  const previewAvailable = Boolean(
    view === "cut" ? output : recording && scene,
  );
  const videoEvents = {
    onLoadStart: () => {
      setPlaying(false);
      setTime(0);
      setDuration(0);
      setPlaybackError("");
    },
    onLoadedMetadata: (event: SyntheticEvent<HTMLVideoElement>) =>
      setDuration(event.currentTarget.duration),
    onTimeUpdate: (event: SyntheticEvent<HTMLVideoElement>) =>
      setTime(event.currentTarget.currentTime),
    onPlay: () => setPlaying(true),
    onPause: () => setPlaying(false),
    onEnded: () => setPlaying(false),
    onError: () =>
      setPlaybackError(
        "Preview could not load. Reload Studio to retry, or download the export.",
      ),
  };
  function togglePlayback() {
    if (!video.current) return;
    if (video.current.paused)
      void video.current
        .play()
        .catch(() =>
          setPlaybackError("Playback could not start. Reload Studio to retry."),
        );
    else video.current.pause();
  }

  useEffect(() => {
    let active = true;
    fetch("/api/bootstrap")
      .then(async (response) => {
        if (!response.ok)
          throw new Error(
            "Cannot connect to Studio. Restart it and reload this page.",
          );
        return response.json();
      })
      .then(async (data) => {
        if (!active) return;
        setRecordings(data.recordings);
        if (!savedWorkspace) setRecipe(data.example);
        // Older versions stored only the recipe. Match that draft by actions,
        // but never silently substitute footage for a missing explicit ID.
        const item: Recording | undefined = savedWorkspace?.recordingId
          ? data.recordings.find(
              (item: Recording) => item.id === savedWorkspace.recordingId,
            )
          : savedWorkspace?.legacy &&
            data.recordings.find(
              (item: Recording) =>
                captureIdentity(item.recipe) ===
                captureIdentity(savedWorkspace.recipe),
            );
        if (item) {
          setRecording(item);
          setView("source");
          const exportId = drafts.current[item.id]?.exportId;
          if (exportId) {
            try {
              const result = await restoreExport(exportId, item.id);
              if (!active) return;
              setOutput(result);
              setView("cut");
            } catch (cause) {
              if (active) setNotice((cause as Error).message);
            }
          }
        } else if (savedWorkspace?.recordingId) {
          setNotice(
            "The saved recording is unavailable. Your edits are safe; record again to capture new footage.",
          );
        }
        if (active) setToken(data.token);
      })
      .catch((cause) => {
        if (active) setError(cause.message);
      })
      .finally(() => {
        if (active) setOpening(false);
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (opening || !token) return;
    if (recording)
      drafts.current = {
        ...drafts.current,
        [recording.id]: { recipe, exportId: output?.id || null },
      };
    try {
      const saved = saveWorkspace(
        localStorage,
        recipe,
        recording?.id || null,
        output,
        drafts.current,
      );
      drafts.current = saved.drafts;
      setStorageWarning(false);
    } catch {
      setStorageWarning(true);
    }
  }, [recipe, recording, output, opening, token]);
  useEffect(() => {
    if (!help) return;
    const previous = document.activeElement as HTMLElement | null;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setHelp(false);
      if (event.key !== "Tab") return;
      const elements = [
        ...document.querySelectorAll<HTMLElement>(
          ".help-modal button, .help-modal a[href]",
        ),
      ];
      const first = elements[0],
        last = elements.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
      if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    document.querySelector<HTMLElement>(".help-modal button")?.focus();
    return () => {
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [help]);
  useEffect(() => {
    if (!job || job.status !== "running") return;
    let active = true;
    const interval = window.setInterval(async () => {
      try {
        const response = await fetch(`/api/jobs/${job.id}`);
        const next: Job & { error?: string } = await response.json();
        if (!response.ok) throw new Error(next.error || "Job connection lost.");
        if (!active) return;
        setJob(next);
        if (next.status === "complete") {
          if (next.kind === "record") {
            const result = next.result as Recording;
            setRecording(result);
            setRecordings((items) => [result, ...items]);
            setOutput(null);
            setView("source");
            setNotice(
              "Recording saved. Adjust the cut, then export your demo.",
            );
          } else {
            setOutput(next.result as ExportResult);
            setView("cut");
            setTime(0);
            setNotice("Your final MP4 and README GIF are ready.");
          }
        }
        if (next.status === "failed") setError(next.error || "The job failed.");
        if (next.status === "cancelled")
          setNotice("Cancelled. Your previous recording is still available.");
      } catch (cause) {
        if (active) {
          setError(`${(cause as Error).message} Reload Studio to reconnect.`);
          setJob(null);
        }
      }
    }, 650);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [job?.id, job?.status]);

  function change(next: Recipe) {
    setHistory((items) => [...items.slice(-19), structuredClone(recipe)]);
    setRecipe(next);
    setError("");
    setNotice("");
  }
  function patchStep(patch: Partial<Step>) {
    change({
      ...recipe,
      steps: recipe.steps.map((item) =>
        item.id === step.id ? { ...item, ...patch } : item,
      ),
    });
  }
  async function openRecording(item: Recording) {
    setOpening(true);
    setError("");
    setNotice("");
    const draft = drafts.current[item.id];
    // An imported recipe can reconnect to matching footage without losing edits.
    const next =
      !recording && captureIdentity(recipe) === captureIdentity(item.recipe)
        ? recipe
        : draft?.recipe || item.recipe;
    setRecording(item);
    setRecipe(next);
    setHistory([]);
    setSelected(0);
    setOutput(null);
    setView("source");
    setTime(0);
    try {
      if (draft?.exportId) {
        setOutput(await restoreExport(draft.exportId, item.id));
        setView("cut");
      }
    } catch (cause) {
      setNotice((cause as Error).message);
    } finally {
      setOpening(false);
    }
  }
  async function api(url: string, body: unknown) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-DemoPilot-Token": token,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request failed.");
    return data;
  }
  async function start(kind: "record" | "render") {
    setError("");
    setNotice("");
    try {
      const parsed = recipeSchema.safeParse(recipe);
      if (!parsed.success)
        throw new Error(
          parsed.error.issues
            .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
            .join("\n"),
        );
      const next = await api(
        `/api/${kind}`,
        kind === "record"
          ? parsed.data
          : { recipe: parsed.data, recordingId: recording?.id },
      );
      setJob(next);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }
  function saveRecipe() {
    const blob = new Blob([JSON.stringify(recipe, null, 2) + "\n"], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "demo.recipe.json";
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice("Recipe downloaded. Keep it with your project to record again.");
  }
  async function importRecipe(file?: File) {
    if (!file) return;
    try {
      if (file.size > 128 * 1024)
        throw new Error("Recipes must be smaller than 128 KB.");
      change(recipeSchema.parse(JSON.parse(await file.text())));
      setSelected(0);
      setOutput(null);
      setRecording(null);
    } catch (cause) {
      setError(`Could not import recipe: ${(cause as Error).message}`);
    }
  }
  function moveStep(direction: number) {
    const target = selected + direction;
    if (target < 0 || target >= recipe.steps.length) return;
    const steps = [...recipe.steps];
    [steps[selected], steps[target]] = [steps[target], steps[selected]];
    change({ ...recipe, steps });
    setSelected(target);
  }
  const onSample =
    recipe.url === `${location.origin}/sample` ||
    recipe.url === `http://127.0.0.1:${location.port}/sample`;

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="wordmark" href="/" aria-label="DemoPilot home">
          <img src="/icon.svg" alt="" />
          DemoPilot
        </a>
        <div className="project-name">
          {" "}
          <input
            aria-label="Demo title"
            value={recipe.title}
            maxLength={80}
            disabled={busy}
            onChange={(event) =>
              change({ ...recipe, title: event.target.value })
            }
          />
          <span className="saved-label">
            {storageWarning
              ? "Draft not saved · download recipe"
              : "Local draft"}
          </span>
        </div>
        <div className="header-right">
          <span className="local-badge">
            <span />
            Local studio
          </span>
          <button
            className="icon-button"
            aria-label="Open help"
            onClick={() => setHelp(true)}
          >
            <CircleHelp size={19} />
          </button>
          <a
            className="github-link"
            href="https://github.com/Ray0766/demopilot"
            target="_blank"
            rel="noreferrer"
          >
            GitHub
          </a>
        </div>
      </header>
      <div className="project-bar">
        <div className="project-actions">
          <button
            className="quiet"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload size={15} />
            Import
          </button>
          <button className="quiet" onClick={saveRecipe}>
            <Download size={15} />
            Save recipe
          </button>
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            hidden
            onChange={(event) => {
              void importRecipe(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <div className="primary-actions">
            {opening ? (
              <button className="primary" disabled>
                <LoaderCircle size={17} className="spin" />
                Opening saved work…
              </button>
            ) : running ? (
              <>
                <button className="primary recording-button" disabled>
                  <LoaderCircle size={17} className="spin" />
                  {job.kind === "record" ? "Recording…" : "Rendering…"}
                </button>
                <button
                  className="secondary"
                  onClick={() => {
                    void api(`/api/jobs/${job.id}/cancel`, {}).catch((cause) =>
                      setError(cause.message),
                    );
                  }}
                >
                  <Square size={13} />
                  Cancel
                </button>
              </>
            ) : (
              <>
                <button
                  className={matches ? "secondary" : "primary"}
                  disabled={!token}
                  onClick={() => void start("record")}
                >
                  <span className="record-dot" />
                  {recording ? "Record again" : "Record demo"}
                </button>
                <button
                  className={matches ? "primary export-button" : "secondary"}
                  disabled={!matches || !token}
                  onClick={() => void start("render")}
                >
                  <Download size={16} />
                  {output ? "Update export" : "Export MP4 + GIF"}
                </button>
              </>
            )}
            {recording && !matches && (
              <p className="mismatch">
                The workflow changed. Record again to capture the updated steps.
              </p>
            )}
          </div>
        </div>
      </div>
      <main className="workspace">
        <aside className="outline">
          <div className="section-heading">
            <div>
              <h1>Recording recipe</h1>
              <p>Run these steps again, keep your edits.</p>
            </div>
          </div>
          <label className="field url-field">
            <span>
              <Globe size={14} />
              Website to record
            </span>
            <input
              value={recipe.url}
              type="url"
              disabled={busy}
              placeholder="http://localhost:3000"
              onChange={(event) =>
                change({ ...recipe, url: event.target.value })
              }
            />
          </label>
          <div className="outline-label">
            <span>
              Steps <b>{recipe.steps.length}</b>
            </span>
            <button
              className="text-button"
              disabled={busy}
              onClick={() => {
                change(exampleRecipe(location.origin));
                setSelected(0);
                setRecording(null);
                setOutput(null);
              }}
            >
              Load sample
            </button>
          </div>
          <ol className="steps">
            {recipe.steps.map((item, index) => (
              <li key={item.id}>
                <button
                  className={`step-item ${index === selected ? "selected" : ""} ${job?.stepId === item.id && busy ? "recording" : ""}`}
                  onClick={() => {
                    setSelected(index);
                    setInspector("scene");
                  }}
                  aria-current={index === selected ? "step" : undefined}
                >
                  <span className="step-number">
                    {job?.stepId === item.id && busy ? (
                      <LoaderCircle size={16} className="spin" />
                    ) : (
                      String(index + 1).padStart(2, "0")
                    )}
                  </span>
                  <span className="step-copy">
                    <strong>{actionLabels[item.action]}</strong>
                    <small>
                      <span>{item.target || item.value || "page"}</span>
                    </small>
                  </span>
                  <ChevronRight size={15} />
                </button>
              </li>
            ))}
          </ol>
          <button
            className="add-step"
            disabled={busy || recipe.steps.length >= 40}
            onClick={() => {
              change({
                ...recipe,
                steps: [
                  ...recipe.steps,
                  stepSchema.parse({
                    id: `step-${crypto.randomUUID().slice(0, 8)}`,
                    action: "click",
                    target: "role:button:Button name",
                  }),
                ],
              });
              setSelected(recipe.steps.length);
            }}
          >
            <Plus size={16} />
            Add a step
          </button>
          <div className="step-editor">
            <div className="editor-heading">
              <strong>Step {selected + 1} action</strong>
              <div>
                <button
                  className="icon-button"
                  aria-label="Move step up"
                  disabled={busy || selected === 0}
                  onClick={() => moveStep(-1)}
                >
                  <ArrowUp size={14} />
                </button>
                <button
                  className="icon-button"
                  aria-label="Move step down"
                  disabled={busy || selected === recipe.steps.length - 1}
                  onClick={() => moveStep(1)}
                >
                  <ArrowDown size={14} />
                </button>
                <button
                  className="icon-button danger"
                  aria-label="Delete step"
                  disabled={busy || recipe.steps.length === 1}
                  onClick={() => {
                    change({
                      ...recipe,
                      steps: recipe.steps.filter((item) => item.id !== step.id),
                    });
                    setSelected(Math.max(0, selected - 1));
                  }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <label className="field">
              <span>Action</span>
              <select
                value={step.action}
                disabled={busy}
                onChange={(event) =>
                  patchStep({ action: event.target.value as Step["action"] })
                }
              >
                {Object.entries(actionLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            {!["scroll", "navigate"].includes(step.action) && (
              <label className="field">
                <span>
                  Target{" "}
                  <button
                    className="inline-help"
                    aria-label="Target syntax help"
                    onClick={() => setHelp(true)}
                    type="button"
                  >
                    ?
                  </button>
                </span>
                <input
                  aria-label="Target"
                  value={step.target}
                  disabled={busy}
                  placeholder="role:button:New project"
                  onChange={(event) =>
                    patchStep({ target: event.target.value })
                  }
                />
              </label>
            )}
            {["fill", "press", "navigate", "select", "scroll"].includes(
              step.action,
            ) && (
              <label className="field">
                <span>
                  {step.action === "scroll"
                    ? "Distance in pixels"
                    : step.action === "press"
                      ? "Key (e.g. Enter)"
                      : step.action === "navigate"
                        ? "Destination URL"
                        : "Value"}
                </span>
                <input
                  value={step.value}
                  disabled={busy}
                  onChange={(event) => patchStep({ value: event.target.value })}
                />
              </label>
            )}
            <label className="field">
              <span>
                Wait for result <small>optional</small>
              </span>
              <input
                value={step.waitFor}
                disabled={busy}
                placeholder="text:Project created"
                onChange={(event) => patchStep({ waitFor: event.target.value })}
              />
            </label>
          </div>
          {recordings.length > 0 && (
            <label className="field recordings-field">
              <span>
                <FolderOpen size={14} />
                Previous recordings
              </span>
              <select
                aria-label="Previous recordings"
                disabled={busy}
                value={recording?.id || ""}
                onChange={(event) => {
                  const item = recordings.find(
                    (item) => item.id === event.target.value,
                  );
                  if (item) void openRecording(item);
                }}
              >
                <option value="" disabled>
                  Open a recording…
                </option>
                {recordings.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.recipe.title} ·{" "}
                    {new Date(item.createdAt).toLocaleTimeString()}
                  </option>
                ))}
              </select>
            </label>
          )}
          <div className="outline-footer">
            <button
              className="quiet"
              aria-expanded={settings}
              onClick={() => setSettings(!settings)}
            >
              <Settings2 size={16} />
              Recording settings
            </button>
            {settings && (
              <div className="record-settings">
                <label className="field">
                  <span>Viewport</span>
                  <select
                    disabled={busy}
                    value={`${recipe.viewport.width}x${recipe.viewport.height}`}
                    onChange={(event) => {
                      const [width, height] = event.target.value
                        .split("x")
                        .map(Number);
                      change({ ...recipe, viewport: { width, height } });
                    }}
                  >
                    <option value="1280x800">1280 × 800</option>
                    <option value="1440x900">1440 × 900</option>
                    <option value="1920x1080">1920 × 1080</option>
                    {!["1280x800", "1440x900", "1920x1080"].includes(
                      `${recipe.viewport.width}x${recipe.viewport.height}`,
                    ) && (
                      <option
                        value={`${recipe.viewport.width}x${recipe.viewport.height}`}
                      >
                        {recipe.viewport.width} × {recipe.viewport.height}
                      </option>
                    )}
                  </select>
                </label>
                <label className="field">
                  <span>Timeout per action (seconds)</span>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={recipe.timeoutMs / 1000}
                    disabled={busy}
                    onChange={(event) =>
                      change({
                        ...recipe,
                        timeoutMs: Number(event.target.value) * 1000,
                      })
                    }
                  />
                </label>
              </div>
            )}
            <p>
              A fresh browser session, every time.
              <br />
              Use demo data you can share publicly.
            </p>
          </div>
        </aside>
        <section className="editing-area" aria-label="Preview and editing">
          <div className="preview-heading">
            <div className="tabs">
              <button
                aria-pressed={view === "cut"}
                className={view === "cut" ? "active" : ""}
                onClick={() => setView("cut")}
              >
                Final cut
              </button>
              <button
                aria-pressed={view === "source"}
                className={view === "source" ? "active" : ""}
                onClick={() => setView("source")}
              >
                Recorded scene
              </button>
            </div>
            <span className="preview-meta">
              {view === "cut"
                ? "1280 × 900"
                : `${recipe.viewport.width} × ${recipe.viewport.height}`}
              <span />
              30 fps
            </span>
          </div>
          <div className="preview-canvas">
            <div className={`preview-stage ${recipe.template}`}>
              {view === "cut" && output ? (
                <video
                  ref={video}
                  key={output.id}
                  src={output.mp4}
                  poster={output.poster}
                  preload="auto"
                  playsInline
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      togglePlayback();
                    }
                  }}
                  {...videoEvents}
                  aria-label="Final demo video"
                />
              ) : view === "source" && recording && scene ? (
                <video
                  ref={video}
                  key={`${recording.id}-${scene.stepId}`}
                  src={`/media/recordings/${recording.id}/${scene.file}`}
                  poster={`/media/recordings/${recording.id}/${scene.poster}`}
                  preload="auto"
                  playsInline
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === " " || event.key === "Enter") {
                      event.preventDefault();
                      togglePlayback();
                    }
                  }}
                  {...videoEvents}
                  aria-label="Recorded scene video"
                />
              ) : (
                <div className="preview-empty">
                  {onSample ? (
                    <div className="sample-window">
                      <div className="window-chrome">
                        <i />
                        <i />
                        <i />
                        <span>littleboard · sample website</span>
                      </div>
                      <SamplePreview />
                    </div>
                  ) : (
                    <div className="empty-custom">
                      <Clapperboard size={44} />
                      <h2>No footage yet</h2>
                      <p>
                        Check the website address and steps, then select Record
                        demo.
                      </p>
                    </div>
                  )}
                  <span className="sample-label">
                    {onSample
                      ? "Live sample preview · not a recording"
                      : "Your recording will appear here"}
                  </span>
                </div>
              )}
            </div>
          </div>
          {view === "cut" && stale && (
            <p className="stale-badge" role="status">
              Edits pending. Export to update the final cut.
            </p>
          )}
          <div className="transport">
            {previewAvailable && (
              <>
                <button
                  className="icon-button playback-toggle"
                  aria-label={playing ? "Pause preview" : "Play preview"}
                  onClick={togglePlayback}
                >
                  {playing ? <Pause size={16} /> : <Play size={16} />}
                </button>
                <input
                  type="range"
                  className="seek"
                  aria-label="Preview position"
                  min="0"
                  max={duration || 1}
                  step="0.1"
                  value={Math.min(time, duration || 1)}
                  disabled={!duration}
                  onChange={(event) => {
                    const next = Number(event.target.value);
                    if (video.current) video.current.currentTime = next;
                    setTime(next);
                  }}
                />
              </>
            )}
            <span className="preview-status">
              <span className={`status-dot ${recording ? "ready" : ""}`} />
              {output && view === "cut"
                ? "Rendered video"
                : recording && view === "source"
                  ? `Source · scene ${selected + 1}`
                  : onSample
                    ? "Record the sample to start"
                    : "No recording yet"}
            </span>
            <span>
              {previewAvailable
                ? `${seconds(time)} / ${seconds(duration || (view === "cut" ? output?.duration || 0 : scene?.duration || 0))}`
                : "No recording yet"}
            </span>
          </div>
          {playbackError && (
            <p className="playback-error" role="alert">
              {playbackError}
            </p>
          )}
          <div className="timeline-heading">
            <span>
              <Film size={15} />
              Scenes
            </span>
            <span>{recipe.steps.length} in sequence</span>
          </div>
          <div className="timeline">
            {recipe.steps.map((item, index) => {
              const captured = recording?.scenes.find(
                (entry) => entry.stepId === item.id,
              );
              return (
                <button
                  className={`timeline-scene ${selected === index ? "selected" : ""}`}
                  key={item.id}
                  onClick={() => {
                    setSelected(index);
                    setInspector("scene");
                    if (recording) setView("source");
                  }}
                  aria-label={`Edit scene ${index + 1}`}
                >
                  <div className="scene-thumbnail">
                    {captured ? (
                      <img
                        src={`/media/recordings/${recording!.id}/${captured.poster}`}
                        alt=""
                      />
                    ) : (
                      <div className="placeholder-lines">
                        <span />
                        <span />
                        <span />
                      </div>
                    )}
                    <span>{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <div className="scene-caption">
                    {item.caption || actionLabels[item.action]}
                  </div>
                  <span className="scene-duration">
                    {captured ? seconds(captured.duration) : "Not recorded"}
                  </span>
                </button>
              );
            })}
          </div>
        </section>
        <aside className="finish-panel" aria-label="Scene inspector">
          <div
            className="inspector-tabs"
            role="group"
            aria-label="Inspector view"
          >
            <button
              aria-pressed={inspector === "scene"}
              onClick={() => setInspector("scene")}
            >
              Scene
            </button>
            <button
              aria-pressed={inspector === "frame"}
              onClick={() => setInspector("frame")}
            >
              Frame & export
            </button>
          </div>
          {inspector === "scene" ? (
            <section className="cut-editor" aria-label="Scene editing">
              <div className="cut-heading">
                <h2>Scene {selected + 1}</h2>
                <button
                  className="quiet"
                  disabled={!history.length || busy}
                  onClick={() => {
                    const previous = history.at(-1);
                    if (previous) {
                      setRecipe(previous);
                      setSelected(0);
                      setHistory(history.slice(0, -1));
                    }
                  }}
                >
                  <RotateCcw size={14} />
                  Undo
                </button>
              </div>
              <div className="cut-controls">
                <label className="field caption-field">
                  <span>Caption for scene {selected + 1}</span>
                  <textarea
                    value={step.caption}
                    maxLength={160}
                    rows={2}
                    disabled={busy}
                    placeholder="What should the viewer notice?"
                    onChange={(event) =>
                      patchStep({ caption: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>
                    Focus zoom <b>{step.zoom.toFixed(1)}×</b>
                  </span>
                  <input
                    type="range"
                    min="1"
                    max="1.8"
                    step="0.1"
                    value={step.zoom}
                    disabled={busy}
                    onChange={(event) =>
                      patchStep({ zoom: Number(event.target.value) })
                    }
                  />
                  <small>Follows the action target</small>
                </label>
                <label className="field">
                  <span>Hold the result</span>
                  <select
                    value={step.holdMs}
                    disabled={busy}
                    onChange={(event) =>
                      patchStep({ holdMs: Number(event.target.value) })
                    }
                  >
                    {[
                      500, 1000, 1500, 1600, 1800, 2000, 2200, 2800, 3000, 4000,
                      6000, 8000,
                    ].map((ms) => (
                      <option key={ms} value={ms}>
                        {ms / 1000} seconds
                      </option>
                    ))}
                    {![
                      500, 1000, 1500, 1600, 1800, 2000, 2200, 2800, 3000, 4000,
                      6000, 8000,
                    ].includes(step.holdMs) && (
                      <option value={step.holdMs}>
                        {step.holdMs / 1000} seconds
                      </option>
                    )}
                  </select>
                </label>
              </div>
              <div className="trim-controls">
                <h3>Trim scene</h3>
                <label>
                  Start{" "}
                  <input
                    aria-label="Trim start seconds"
                    type="number"
                    min="0"
                    max="60"
                    step="0.1"
                    disabled={busy}
                    value={step.trimStart}
                    onChange={(event) =>
                      patchStep({ trimStart: Number(event.target.value) })
                    }
                  />{" "}
                  s
                </label>
                <label>
                  End{" "}
                  <input
                    aria-label="Trim end seconds"
                    type="number"
                    min="0"
                    max="60"
                    step="0.1"
                    disabled={busy}
                    value={step.trimEnd}
                    onChange={(event) =>
                      patchStep({ trimEnd: Number(event.target.value) })
                    }
                  />{" "}
                  s
                </label>
              </div>
            </section>
          ) : (
            <section
              className="frame-editor"
              aria-label="Frame and export settings"
            >
              {" "}
              <fieldset className="templates" disabled={busy}>
                <legend>Visual style</legend>
                {(["studio", "paper", "midnight"] as const).map((name) => (
                  <label
                    className={`template-option ${recipe.template === name ? "selected" : ""}`}
                    key={name}
                  >
                    <input
                      type="radio"
                      name="template"
                      value={name}
                      checked={recipe.template === name}
                      onChange={() => change({ ...recipe, template: name })}
                    />
                    <span className={`template-preview ${name}`}>
                      <span />
                      <i />
                    </span>
                    <span>
                      <strong>
                        {name.charAt(0).toUpperCase() + name.slice(1)}
                      </strong>
                      <small>
                        {name === "studio"
                          ? "Soft blue frame"
                          : name === "paper"
                            ? "Light green frame"
                            : "Dark blue frame"}
                      </small>
                    </span>
                    {recipe.template === name && <Check size={15} />}
                  </label>
                ))}
              </fieldset>
              <div className="pacing">
                <label className="check-field">
                  <input
                    type="checkbox"
                    checked={recipe.trimWaiting}
                    disabled={busy}
                    onChange={(event) =>
                      change({ ...recipe, trimWaiting: event.target.checked })
                    }
                  />
                  <span>Cut long result waits</span>
                </label>
                <p>
                  Keeps the action and its result. Edited pacing is labeled in
                  the video.
                </p>
              </div>
              <div className="export-summary">
                <h3>Export formats</h3>
                <div>
                  <Film size={18} />
                  <span>
                    <strong>Release video</strong>
                    <small>MP4 · 1280 × 900 · 30 fps</small>
                  </span>
                </div>
                <div>
                  <Clapperboard size={18} />
                  <span>
                    <strong>README animation</strong>
                    <small>GIF · 800 px · first 30 seconds</small>
                  </span>
                </div>
              </div>
            </section>
          )}
          {output && (
            <div className="downloads">
              <h3>
                <Check size={15} />
                {stale ? "Previous export" : "Export ready"}
              </h3>
              <a href={output.mp4} download="demo.mp4">
                Download MP4 <span>{bytes(output.bytes.mp4)}</span>
              </a>
              <a href={output.gif} download="demo.gif">
                Download GIF <span>{bytes(output.bytes.gif)}</span>
              </a>
              <button
                className="text-button"
                onClick={() => {
                  void navigator.clipboard
                    .writeText("![Product demo](docs/demo.gif)")
                    .then(
                      () =>
                        setNotice(
                          "README Markdown copied. Save your GIF to docs/demo.gif in your project.",
                        ),
                      () =>
                        setNotice(
                          "Add this to your README: ![Product demo](docs/demo.gif)",
                        ),
                    );
                }}
              >
                Copy README Markdown
              </button>
              <small>
                {stale
                  ? "Downloads contain the previous export."
                  : "Copy the downloaded GIF into your repository."}
              </small>
            </div>
          )}

          <p className="inspector-note">
            Edits preserve your source footage.
            <br />
            Export to preview the updated cut.
          </p>
        </aside>
      </main>
      <footer className="status-bar" aria-live="polite">
        <span>
          {running ? (
            <>
              <LoaderCircle size={14} className="spin" />
              {job.message}
            </>
          ) : (
            <>
              <Check size={14} />
              {notice ||
                (recording
                  ? "Source footage saved locally."
                  : "Sample data is synthetic. Recording starts a fresh browser session.")}
            </>
          )}
        </span>
        {running ? (
          <progress value={job.progress} max="1" aria-label="Job progress" />
        ) : (
          <span>No account or upload</span>
        )}
      </footer>
      {error && (
        <div className="error-toast" role="alert">
          <div>
            <strong>Could not complete this action.</strong>
            <pre>{error}</pre>
          </div>
          <button
            className="icon-button"
            aria-label="Dismiss error"
            onClick={() => setError("")}
          >
            <X size={18} />
          </button>
        </div>
      )}
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="help-modal"
            role="dialog"
            aria-modal="true"
            aria-label="How to use DemoPilot"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="icon-button close"
              aria-label="Close help"
              onClick={() => setHelp(false)}
            >
              <X />
            </button>
            <h2>Record, edit, export</h2>
            <p>
              Start your website, write the steps, and record. Use the sample to
              try the whole process without an account.
            </p>
            <h3>Choose a reliable target</h3>
            <dl>
              <dt>Button by its accessible name</dt>
              <dd>
                <code>role:button:New project</code>
              </dd>
              <dt>Input by its label</dt>
              <dd>
                <code>label:Project name</code>
              </dd>
              <dt>Exact text or a test ID</dt>
              <dd>
                <code>text:Project created</code>
                <br />
                <code>testid:save-button</code>
              </dd>
              <dt>CSS selector</dt>
              <dd>
                <code>#save</code> or <code>[data-action="save"]</code>
              </dd>
            </dl>
            <p>
              “Wait for result” checks that a target becomes visible before the
              scene ends. Prefer this to guessing a delay.
            </p>
            <p>
              Caption, zoom, hold and trims can change without recording again.
              Click <b>Export MP4 + GIF</b> to see the exact rendered result.
              Changing an action requires a new recording.
            </p>
            <p>
              Record only apps you can operate with shareable demo data. This
              version uses a fresh Chromium session and records one tab without
              sound.
            </p>
            <button className="primary" onClick={() => setHelp(false)}>
              Got it
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function SamplePreview() {
  const container = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);
  useEffect(() => {
    const observer = new ResizeObserver(([entry]) =>
      setScale(entry.contentRect.width / 1280),
    );
    if (container.current) observer.observe(container.current);
    return () => observer.disconnect();
  }, []);
  return (
    <div className="sample-viewport" ref={container}>
      <iframe
        src="/sample"
        title="Synthetic sample website preview"
        tabIndex={-1}
        sandbox="allow-scripts"
        style={{ transform: `scale(${scale})` }}
      />
    </div>
  );
}
