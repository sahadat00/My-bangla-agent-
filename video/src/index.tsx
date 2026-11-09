import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Easing,
  Img,
  Sequence,
  interpolate,
  random,
  registerRoot,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/HindSiliguri";
import plan from "../public/plan.json";

const { fontFamily } = loadFont("normal", {
  weights: ["700"],
  subsets: ["bengali", "latin"],
});

const MAX_WORDS = 6;
const BG = "#0B1020";
const BG2 = "#1B2A4A";
const HERO = "#4FC3F7";
const ACCENT = "#FFB74D";
const TEXT = "#F5F7FA";
const FADE = 8;
const BRAND = "TOP X BANGLA";
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type SentenceTiming = { start: number; end: number };

const chunkWords = (words: string[]): string[][] => {
  const chunks: string[][] = [];
  const n = Math.max(1, Math.ceil(words.length / MAX_WORDS));
  const size = Math.max(1, Math.ceil(words.length / n));
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
};

const MOTIONS = ["zoomIn", "panLeft", "zoomOut", "panRight", "drift"] as const;

const MovingImage: React.FC<{
  src: string;
  motion: (typeof MOTIONS)[number];
  total: number;
}> = ({ src, motion, total }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.max(1, total)], [0, 1], CL);
  let scale = 1.15;
  let tx = 0;
  let ty = 0;
  let rot = 0;
  if (motion === "zoomIn") {
    scale = 1.1 + p * 0.25;
  } else if (motion === "zoomOut") {
    scale = 1.35 - p * 0.25;
  } else if (motion === "panLeft") {
    scale = 1.3;
    tx = (0.5 - p) * 140;
  } else if (motion === "panRight") {
    scale = 1.3;
    tx = (p - 0.5) * 140;
  } else {
    scale = 1.25 + p * 0.1;
    rot = (p - 0.5) * 4;
    ty = (0.5 - p) * 60;
  }
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: BG }}>
      <Img
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `translate(${tx}px, ${ty}px) scale(${scale}) rotate(${rot}deg)`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(11,16,32,0.6) 0%, rgba(11,16,32,0.4) 45%, rgba(11,16,32,0.8) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

const SpaceMotion: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const stars = Array.from({ length: 70 }, (_, i) => {
    const x = random(`x${seed}-${i}`) * width;
    const y = random(`y${seed}-${i}`) * height;
    const size = 2 + random(`s${seed}-${i}`) * 5;
    const speed = 0.2 + random(`v${seed}-${i}`) * 0.8;
    const tw = 0.4 + 0.6 * Math.abs(Math.sin((frame / 30) * speed * 2 + i));
    const yy = (y + frame * speed * 0.6) % height;
    return (
      <div
        key={i}
        style={{
          position: "absolute",
          left: x,
          top: yy,
          width: size,
          height: size,
          borderRadius: "50%",
          backgroundColor: i % 9 === 0 ? HERO : TEXT,
          opacity: tw,
        }}
      />
    );
  });
  const cx = width / 2;
  const cy = height / 2;
  const rings = [260, 420, 600].map((r, i) => {
    const ang = (frame / 30) * (40 - i * 10) + seed * 40;
    const rad = (ang * Math.PI) / 180;
    return (
      <React.Fragment key={r}>
        <div
          style={{
            position: "absolute",
            left: cx - r,
            top: cy - r,
            width: r * 2,
            height: r * 2,
            borderRadius: "50%",
            border: `2px solid rgba(79,195,247,${0.35 - i * 0.08})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: cx + Math.cos(rad) * r - 14,
            top: cy + Math.sin(rad) * r - 14,
            width: 28,
            height: 28,
            borderRadius: "50%",
            backgroundColor: i === 1 ? ACCENT : HERO,
            boxShadow: `0 0 30px ${HERO}`,
          }}
        />
      </React.Fragment>
    );
  });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${BG2} 0%, ${BG} 70%)`,
      }}
    >
      {stars}
      {rings}
    </AbsoluteFill>
  );
};

// মাঝখানে কথার শব্দ: যে শব্দ বলা হচ্ছে সেটা নীল
const WordsText: React.FC<{
  words: string[];
  durationInFrames: number;
  big?: boolean;
}> = ({ words, durationInFrames, big }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;
  const usable = Math.max(1, durationInFrames - 6);
  const perWord = usable / words.length;
  const current = Math.min(words.length - 1, Math.floor(frame / perWord));
  const fade = Math.min(1, Math.max(0, (durationInFrames - frame) / 6));
  const base = isWide ? 92 : 104;
  return (
    <AbsoluteFill
      style={{
        justifyContent: "center",
        alignItems: "center",
        padding: isWide ? 140 : 80,
      }}
    >
      <div
        style={{
          width: "100%",
          maxHeight: "75%",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 22,
          fontFamily,
          fontWeight: 700,
          fontSize: big ? base + 20 : base,
          lineHeight: 1.45,
          textAlign: "center",
          opacity: fade,
          textShadow: "0 4px 24px rgba(0,0,0,0.7)",
        }}
      >
        {words.map((w, i) => {
          const s = spring({
            frame: frame - i * perWord,
            fps,
            config: { damping: 14 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: s,
                transform: `translateY(${(1 - s) * 50}px)`,
                color: i === current ? HERO : TEXT,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

// ওপরে ছোট করে মূল বিষয় (on_screen_text)
const TopicChip: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;
  const s = spring({ frame: frame - 4, fps, config: { damping: 15 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: isWide ? 70 : height * 0.1,
        display: "flex",
        justifyContent: "center",
        opacity: s,
        transform: `translateY(${(1 - s) * -24}px)`,
      }}
    >
      <div
        style={{
          padding: "14px 40px",
          borderRadius: 999,
          background: "rgba(11,16,32,0.6)",
          border: "1px solid rgba(79,195,247,0.6)",
          fontFamily,
          fontWeight: 700,
          fontSize: isWide ? 44 : 50,
          color: HERO,
          maxWidth: "88%",
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>
  );
};

const ClosingMark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, height } = useVideoConfig();
  const s = spring({ frame: frame - 10, fps, config: { damping: 16 } });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: height * 0.86,
        textAlign: "center",
        fontFamily,
        fontWeight: 700,
        fontSize: 60,
        color: HERO,
        opacity: s,
        transform: `translateY(${(1 - s) * 30}px)`,
        textShadow: "0 4px 20px rgba(0,0,0,0.7)",
      }}
    >
      {BRAND}
    </div>
  );
};

const SceneView: React.FC<{
  sc: any;
  index: number;
  sentences: string[];
  timings: SentenceTiming[];
  fps: number;
}> = ({ sc, index, sentences, timings, fps }) => {
  const frame = useCurrentFrame();
  const total: number = sc.duration_frames;
  const ids: number[] = sc.sentences;
  const hasImage = !!sc.image_file;
  const motion = MOTIONS[index % MOTIONS.length];
  const topic = String(sc.on_screen_text || "").trim();
  const opacity = Math.min(
    interpolate(frame, [0, FADE], [0, 1], CL),
    interpolate(frame, [total - FADE, total], [1, 0], CL)
  );
  const texts: React.ReactNode[] = [];
  ids.forEach((id, k) => {
    const t = timings[id - 1];
    const words = String(sentences[id - 1] || "").split(/\s+/).filter(Boolean);
    if (!t || words.length === 0) return;
    const chunks = chunkWords(words);
    const sStart = Math.round((t.start - sc.start_sec) * fps);
    const sEnd =
      k + 1 < ids.length
        ? Math.round((timings[ids[k + 1] - 1].start - sc.start_sec) * fps)
        : total;
    const span = Math.max(chunks.length, sEnd - sStart);
    const each = Math.max(1, Math.floor(span / chunks.length));
    chunks.forEach((ch, ci) => {
      const f0 = sStart + ci * each;
      const dur = ci === chunks.length - 1 ? span - ci * each : each;
      texts.push(
        <Sequence
          key={`${id}-${ci}`}
          from={f0}
          durationInFrames={Math.max(1, dur)}
        >
          <WordsText
            words={ch}
            durationInFrames={Math.max(1, dur)}
            big={sc.template === "hook"}
          />
        </Sequence>
      );
    });
  });
  return (
    <AbsoluteFill style={{ opacity }}>
      {hasImage ? (
        <MovingImage src={sc.image_file} motion={motion} total={total} />
      ) : (
        <SpaceMotion seed={index + 1} />
      )}
      {topic && sc.template !== "closing" ? <TopicChip text={topic} /> : null}
      {texts}
      {sc.template === "closing" ? <ClosingMark /> : null}
    </AbsoluteFill>
  );
};

const Main: React.FC = () => {
  const sentences: string[] = (plan as any).sentences;
  const timings: SentenceTiming[] = (plan as any).sentence_timings;
  const scenes: any[] = (plan as any).scenes;
  const fps: number = (plan as any).fps;
  let from = 0;
  const parts: React.ReactNode[] = [];
  scenes.forEach((sc, i) => {
    parts.push(
      <Sequence
        key={i}
        from={from}
        durationInFrames={Math.max(1, sc.duration_frames)}
      >
        <SceneView
          sc={sc}
          index={i}
          sentences={sentences}
          timings={timings}
          fps={fps}
        />
      </Sequence>
    );
    from += sc.duration_frames;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: BG }}>
      {parts}
      <Audio src={staticFile("voice.mp3")} />
    </AbsoluteFill>
  );
};

const Root: React.FC = () => (
  <Composition
    id="Main"
    component={Main}
    durationInFrames={Math.max(1, (plan as any).total_frames)}
    fps={(plan as any).fps}
    width={(plan as any).ratio === "16:9" ? 1920 : 1080}
    height={(plan as any).ratio === "16:9" ? 1080 : 1920}
  />
);

registerRoot(Root);
