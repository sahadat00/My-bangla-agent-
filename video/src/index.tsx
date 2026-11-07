import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Sequence,
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

type SentenceTiming = { start: number; end: number };

const chunkWords = (words: string[]): string[][] => {
  const chunks: string[][] = [];
  const n = Math.max(1, Math.ceil(words.length / MAX_WORDS));
  const size = Math.ceil(words.length / n);
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
};

const WordsScene: React.FC<{
  words: string[];
  durationInFrames: number;
}> = ({ words, durationInFrames }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const usable = Math.max(1, durationInFrames - 6);
  const perWord = usable / words.length;
  const current = Math.min(words.length - 1, Math.floor(frame / perWord));
  const fade = Math.min(
    1,
    Math.max(0, (durationInFrames - frame) / 6)
  );
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0B1020",
        justifyContent: "center",
        alignItems: "center",
        padding: 80,
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
          fontSize: 104,
          lineHeight: 1.45,
          textAlign: "center",
          opacity: fade,
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
                color: i === current ? "#4FC3F7" : "#F5F7FA",
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

const Main: React.FC = () => {
  const sentences: string[] = (plan as any).sentences;
  const timings: SentenceTiming[] = (plan as any).sentence_timings;
  const scenes: any[] = (plan as any).scenes;
  const fps: number = (plan as any).fps;

  let from = 0;
  const parts: React.ReactNode[] = [];
  scenes.forEach((sc, si) => {
    const sceneFrames: number = sc.duration_frames;
    const ids: number[] = sc.sentences;
    const sceneStart: number = sc.start_sec;
    ids.forEach((id, k) => {
      const t = timings[id - 1];
      const wordsAll = String(sentences[id - 1]).split(/\s+/).filter(Boolean);
      const chunks = chunkWords(wordsAll);
      const sStart = Math.round((t.start - sceneStart) * fps);
      const sEnd =
        k + 1 < ids.length
          ? Math.round((timings[ids[k + 1] - 1].start - sceneStart) * fps)
          : sceneFrames;
      const span = Math.max(chunks.length, sEnd - sStart);
      const each = Math.max(1, Math.floor(span / chunks.length));
      chunks.forEach((ch, ci) => {
        const f0 = from + sStart + ci * each;
        const dur =
          ci === chunks.length - 1 ? span - ci * each : each;
        parts.push(
          <Sequence key={`${si}-${id}-${ci}`} from={f0} durationInFrames={Math.max(1, dur)}>
            <WordsScene words={ch} durationInFrames={Math.max(1, dur)} />
          </Sequence>
        );
      });
    });
    from += sceneFrames;
  });

  return (
    <AbsoluteFill style={{ backgroundColor: "#0B1020" }}>
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
