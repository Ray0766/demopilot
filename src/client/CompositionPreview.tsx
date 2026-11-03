import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import type { Recipe, Recording } from "../shared/schema";
import {
  cameraAt,
  clamp,
  fittedSlot,
  FRAME,
  outputTimeAt,
  scenePlan,
  sourceTimeAt,
} from "../shared/composition";

export type PreviewState = { time: number; duration: number; playing: boolean };
export type PreviewControls = { toggle(): void; seek(time: number): void };

/** A selected-scene edit preview. The exported film remains a separate view. */
export const CompositionPreview = forwardRef<
  PreviewControls,
  {
    recipe: Recipe;
    recording: Recording;
    index: number;
    token: string;
    onState(state: PreviewState): void;
  }
>(function CompositionPreview(
  { recipe, recording, index, token, onState },
  ref,
) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const frame = useRef<HTMLImageElement | null>(null);
  const frameIdentity = useRef("");
  const playback = useRef({ time: 0, playing: false });
  const hold = useRef<{ started: number; time: number } | null>(null);
  const animation = useRef(0);
  const notified = useRef(-1);
  const notify = useRef(onState);
  notify.current = onState;
  const [status, setStatus] = useState("Preparing edit preview…");
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const scene = recording.scenes[index],
    step = recipe.steps[index];
  let plan: ReturnType<typeof scenePlan> | null = null,
    planError = "";
  try {
    plan = scenePlan(scene, step, recipe.trimWaiting);
  } catch (cause) {
    planError = (cause as Error).message;
  }
  const latest = useRef({ recipe, scene, step, plan });
  latest.current = { recipe, scene, step, plan };
  const timelineKey = JSON.stringify(plan);
  const frameKey = JSON.stringify([
    recipe.title,
    recipe.template,
    step.caption,
    index,
    recipe.steps.length,
    plan?.disclosure,
  ]);

  function publish(force = false) {
    const p = latest.current.plan;
    if (force || Math.abs(playback.current.time - notified.current) > 0.08) {
      notified.current = playback.current.time;
      notify.current({ ...playback.current, duration: p?.duration || 0 });
    }
  }
  function draw() {
    const target = canvas.current,
      source = video.current,
      image = frame.current;
    const { recipe: r, scene: s, step: edit, plan: p } = latest.current;
    if (
      !target ||
      !source ||
      !image ||
      !p ||
      source.readyState < 2 ||
      source.seeking
    )
      return;
    if (
      frameIdentity.current !==
      JSON.stringify([
        r.title,
        r.template,
        edit.caption,
        index,
        r.steps.length,
        p.disclosure,
      ])
    )
      return;
    const ctx = target.getContext("2d");
    if (!ctx) return;
    const crop = cameraAt(s, edit, p, playback.current.time),
      slot = fittedSlot(r.viewport);
    ctx.drawImage(image, 0, 0);
    ctx.drawImage(
      source,
      crop.x * source.videoWidth,
      crop.y * source.videoHeight,
      crop.width * source.videoWidth,
      crop.height * source.videoHeight,
      slot.x,
      slot.y,
      slot.width,
      slot.height,
    );
    target.dataset.time = playback.current.time.toFixed(3);
    target.dataset.caption = edit.caption;
    target.dataset.ready = "true";
  }
  function stop() {
    playback.current.playing = false;
    video.current?.pause();
    cancelAnimationFrame(animation.current);
    hold.current = null;
    publish(true);
  }
  function playSource() {
    const source = video.current;
    if (source && source.paused)
      void source.play().catch(() => {
        stop();
        setError("Preview playback could not start. Retry the preview.");
      });
  }
  function tick() {
    const source = video.current,
      p = latest.current.plan;
    if (!playback.current.playing || !source || !p) return;
    if (hold.current) {
      playback.current.time = Math.min(
        p.duration,
        hold.current.time + (performance.now() - hold.current.started) / 1000,
      );
    } else if (!source.seeking && source.readyState >= 2) {
      const gap =
        p.ranges.length === 2 &&
        source.currentTime >= p.ranges[0][1] &&
        source.currentTime < p.ranges[1][0];
      if (gap) source.currentTime = p.ranges[1][0];
      else {
        playback.current.time = clamp(
          outputTimeAt(p, source.currentTime),
          0,
          p.duration,
        );
        if (
          source.currentTime >= p.ranges.at(-1)![1] - 1 / 30 ||
          source.ended
        ) {
          source.pause();
          playback.current.time = clamp(p.contentEnd, 0, p.duration);
          hold.current = {
            started: performance.now(),
            time: playback.current.time,
          };
        }
      }
    }
    draw();
    publish();
    if (playback.current.time >= p.duration) {
      stop();
      return;
    }
    animation.current = requestAnimationFrame(tick);
  }
  function seek(time: number) {
    const p = latest.current.plan,
      source = video.current;
    if (!p || !source) return;
    playback.current.time = clamp(time, 0, p.duration);
    const frozen = playback.current.time >= p.contentEnd;
    hold.current = frozen
      ? { started: performance.now(), time: playback.current.time }
      : null;
    if (source.readyState >= 1)
      source.currentTime = sourceTimeAt(p, playback.current.time);
    if (frozen) source.pause();
    else if (playback.current.playing) playSource();
    draw();
    publish(true);
  }
  function toggle() {
    const p = latest.current.plan;
    if (!p || !frame.current || !video.current || error) return;
    if (playback.current.playing) {
      stop();
      return;
    }
    if (playback.current.time >= p.duration - 0.03) seek(0);
    playback.current.playing = true;
    if (playback.current.time >= p.contentEnd)
      hold.current = {
        started: performance.now(),
        time: playback.current.time,
      };
    else {
      hold.current = null;
      playSource();
    }
    publish(true);
    cancelAnimationFrame(animation.current);
    animation.current = requestAnimationFrame(tick);
  }
  useImperativeHandle(ref, () => ({ toggle, seek }));
  useEffect(() => {
    seek(playback.current.time);
  }, [timelineKey]);
  useEffect(() => {
    draw();
  }, [recipe, recording, index]);
  useEffect(
    () => () => {
      cancelAnimationFrame(animation.current);
    },
    [],
  );

  useEffect(() => {
    const abort = new AbortController();
    let active = true,
      objectUrl = "";
    setStatus("Updating frame…");
    setError("");
    frame.current = null;
    if (canvas.current) canvas.current.dataset.ready = "false";
    if (!plan) {
      stop();
      setStatus("");
      return;
    }
    const timer = window.setTimeout(() => {
      void (async () => {
        const response = await fetch("/api/preview-frame", {
          method: "POST",
          signal: abort.signal,
          headers: {
            "Content-Type": "application/json",
            "X-DemoPilot-Token": token,
          },
          body: JSON.stringify({ recipe, recordingId: recording.id, index }),
        });
        if (!response.ok)
          throw new Error(
            (await response.json()).error || "Could not prepare the preview.",
          );
        const blob = await response.blob();
        if (!active) return;
        objectUrl = URL.createObjectURL(blob);
        const image = new Image();
        image.src = objectUrl;
        await image.decode();
        if (!active) return;
        frame.current = image;
        frameIdentity.current = frameKey;
        setStatus("");
        draw();
        publish(true);
      })().catch((cause) => {
        if (!active || abort.signal.aborted) return;
        stop();
        setStatus("");
        setError((cause as Error).message);
      });
    }, 60);
    return () => {
      active = false;
      clearTimeout(timer);
      abort.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [frameKey, recording.id, token, retry, Boolean(plan)]);

  return (
    <div className="composition-preview">
      <video
        ref={video}
        className="composition-source"
        src={`/media/recordings/${recording.id}/${scene.file}`}
        preload="auto"
        muted
        playsInline
        aria-hidden="true"
        onLoadedData={() => {
          seek(playback.current.time);
          draw();
        }}
        onSeeked={() => {
          draw();
        }}
        onError={() => {
          stop();
          setError(
            "The source clip could not load. Retry, or record this workflow again.",
          );
        }}
      />
      <canvas
        ref={canvas}
        width={FRAME.width}
        height={FRAME.height}
        tabIndex={0}
        aria-label="Live scene preview"
        role="img"
        data-ready="false"
        onKeyDown={(event) => {
          if (event.key === " " || event.key === "Enter") {
            event.preventDefault();
            toggle();
          }
        }}
      />
      {(status || error || planError) && (
        <div
          className="composition-message"
          role={error || planError ? "alert" : "status"}
        >
          <span>{planError || error || status}</span>
          {error && !planError && (
            <button
              className="secondary"
              onClick={() => {
                video.current?.load();
                setRetry((value) => value + 1);
              }}
            >
              Retry preview
            </button>
          )}
        </div>
      )}
    </div>
  );
});
