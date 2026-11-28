import React from "react";
import {
  AbsoluteFill,
  Audio,
  Composition,
  Easing,
  Img,
  Loop,
  OffthreadVideo,
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

// ===== থিম: সব রং, গতি, স্প্রিং এক জায়গায় =====
const theme = {
  colors: {
    bg: "#0B1020",
    bgAlt: "#1B2A4A",
    hero: "#4FC3F7",
    accent: "#FFB74D",
    text: "#F5F7FA",
  },
  ease: {
    out: Easing.bezier(0.16, 1, 0.3, 1),
    inOut: Easing.bezier(0.83, 0, 0.17, 1),
    in: Easing.bezier(0.7, 0, 0.84, 0),
  },
  spring: {
    snappy: { damping: 14, stiffness: 160, mass: 0.6 },
    smooth: { damping: 20, stiffness: 90, mass: 1 },
    bouncy: { damping: 11, stiffness: 170, mass: 0.7 },
  },
} as const;

const MAX_WORDS = 6;
const BRAND = "TOP X BANGLA";
const LEAD = 6; // নতুন সিন আগের সিনের ওপর ৬ ফ্রেম ধরে মিলিয়ে ঢোকে
const SFX_NAMES = ["pop", "whoosh", "click", "chime"];
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

type SentenceTiming = { start: number; end: number };
type Seg = { from: number; to: number; words: string[] };

const BN = "০১২৩৪৫৬৭৮৯";
const toBn = (s: string): string => s.replace(/[0-9]/g, (d) => BN[Number(d)]);
const toEn = (s: string): string =>
  s.replace(/[০-৯]/g, (d) => String(BN.indexOf(d)));
const splitWords = (s: string): string[] => s.split(/\s+/).filter(Boolean);

const chunkWords = (words: string[]): string[][] => {
  const chunks: string[][] = [];
  const n = Math.max(1, Math.ceil(words.length / MAX_WORDS));
  const size = Math.max(1, Math.ceil(words.length / n));
  for (let i = 0; i < words.length; i += size) {
    chunks.push(words.slice(i, i + size));
  }
  return chunks;
};

// ===== স্তর ১: ব্যাকগ্রাউন্ড =====
const BgMesh: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const s = Math.max(width, height);
  const d1 = Math.sin(frame / 55 + seed) * 50;
  const d2 = Math.cos(frame / 70 + seed) * 40;
  return (
    <AbsoluteFill style={{ background: theme.colors.bg }}>
      <div
        style={{
          position: "absolute",
          width: s * 0.9,
          height: s * 0.9,
          borderRadius: "50%",
          top: -s * 0.3,
          left: -s * 0.2 + d1,
          filter: "blur(50px)",
          background: `radial-gradient(circle, ${theme.colors.hero}44, transparent 62%)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: s * 0.7,
          height: s * 0.7,
          borderRadius: "50%",
          bottom: -s * 0.3,
          right: -s * 0.2 - d2,
          filter: "blur(70px)",
          background: `radial-gradient(circle, ${theme.colors.accent}30, transparent 65%)`,
        }}
      />
    </AbsoluteFill>
  );
};

// মহাকাশ ছাড়া অন্য বিষয়ে, ছবি না থাকলে: ভেসে ওঠা ধুলোকণা
const Dust: React.FC<{ seed: number }> = ({ seed }) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  return (
    <AbsoluteFill>
      {Array.from({ length: 36 }, (_, i) => {
        const x = random(`dx${seed}-${i}`) * width;
        const y0 = random(`dy${seed}-${i}`) * height;
        const size = 3 + random(`ds${seed}-${i}`) * 7;
        const speed = 0.25 + random(`dv${seed}-${i}`) * 0.6;
        const y = (((y0 - frame * speed) % height) + height) % height;
        const o = 0.15 + 0.25 * Math.abs(Math.sin(frame / 40 + i));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x + Math.sin(frame / 50 + i) * 12,
              top: y,
              width: size,
              height: size,
              borderRadius: "50%",
              backgroundColor: theme.colors.text,
              opacity: o,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

// মহাকাশের বিষয়ে, ছবি না থাকলে: তারা আর কক্ষপথ
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
          backgroundColor: theme.colors.text,
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
            border: `2px solid rgba(79,195,247,${0.3 - i * 0.07})`,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: cx + Math.cos(rad) * r - 12,
            top: cy + Math.sin(rad) * r - 12,
            width: 24,
            height: 24,
            borderRadius: "50%",
            backgroundColor: i === 1 ? theme.colors.accent : theme.colors.hero,
            opacity: 0.85,
          }}
        />
      </React.Fragment>
    );
  });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${theme.colors.bgAlt} 0%, ${theme.colors.bg} 70%)`,
      }}
    >
      {stars}
      {rings}
    </AbsoluteFill>
  );
};

// ===== স্তর ২: ছবি (Ken Burns: প্রতি ছবিতে ধীর জুম আর সরানো) =====
const KenBurns: React.FC<{ src: string; index: number; total: number }> = ({
  src,
  index,
  total,
}) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.max(1, total)], [0, 1], {
    easing: theme.ease.inOut,
    ...CL,
  });
  const zoomIn = index % 2 === 0;
  const scale = zoomIn ? 1.12 + p * 0.14 : 1.3 - p * 0.16;
  const dir = index % 4 < 2 ? 1 : -1;
  const tx = (p - 0.5) * 100 * dir;
  const ty = (0.5 - p) * 50 * (index % 3 === 0 ? 1 : -1);
  const rot = index % 5 === 4 ? (p - 0.5) * 3 : 0;
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: theme.colors.bg }}>
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
            "linear-gradient(180deg, rgba(11,16,32,0.6) 0%, rgba(11,16,32,0.38) 45%, rgba(11,16,32,0.8) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ===== স্তর ২ (ক্লিপ): রিলসের মতো ২-৩ সেকেন্ডের দ্রুত কাট =====
type ClipInfo = { file: string; dur: number };

const ClipCut: React.FC<{
  src: string;
  clipFrames: number;
  dur: number;
  first: boolean;
}> = ({ src, clipFrames, dur, first }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [0, Math.max(1, dur)], [0, 1], {
    easing: theme.ease.out,
    ...CL,
  });
  const scale = 1.04 + p * 0.08;
  const flash = first ? 0 : interpolate(frame, [0, 5], [0.3, 0], CL);
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: theme.colors.bg }}>
      <AbsoluteFill style={{ transform: `scale(${scale})` }}>
        <Loop durationInFrames={clipFrames}>
          <OffthreadVideo
            src={staticFile(src)}
            muted
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        </Loop>
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "#ffffff", opacity: flash }} />
    </AbsoluteFill>
  );
};

const ClipReel: React.FC<{ clips: ClipInfo[]; total: number; fps: number }> = ({
  clips,
  total,
  fps,
}) => {
  const n = clips.length;
  const seg = Math.max(1, Math.floor(total / n));
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      {clips.map((c, i) => {
        const from = i * seg;
        const dur = i === n - 1 ? Math.max(1, total - from) : seg;
        const clipFrames = Math.max(1, Math.round((c.dur || 3) * fps));
        return (
          <Sequence key={i} from={from} durationInFrames={dur}>
            <ClipCut src={c.file} clipFrames={clipFrames} dur={dur} first={i === 0} />
          </Sequence>
        );
      })}
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg, rgba(11,16,32,0.6) 0%, rgba(11,16,32,0.38) 45%, rgba(11,16,32,0.8) 100%)",
        }}
      />
    </AbsoluteFill>
  );
};

// ===== স্তর ৪, ৫: সব সিনের ওপরে একবার (রং-মেলানো, দানা, কোণা কালো) =====
const Grade: React.FC = () => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <AbsoluteFill
      style={{
        backgroundColor: theme.colors.hero,
        mixBlendMode: "soft-light",
        opacity: 0.18,
      }}
    />
  </AbsoluteFill>
);

const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const noise = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2'/%3E%3C/filter%3E%3Crect width='220' height='220' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`;
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        backgroundImage: noise,
        backgroundSize: "220px",
        backgroundPosition: `${(frame * 7) % 220}px ${(frame * 13) % 220}px`,
        opacity: 0.06,
        mixBlendMode: "overlay",
      }}
    />
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: "none",
      background:
        "radial-gradient(ellipse at center, transparent 56%, rgba(0,0,0,0.35) 100%)",
    }}
  />
);

// ===== মাঝখানে: কথার শব্দ (যে শব্দ বলা হচ্ছে সেটা নীল) =====
const WordsText: React.FC<{
  words: string[];
  durationInFrames: number;
  big?: boolean;
}> = ({ words, durationInFrames, big }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;
  const exitStart = Math.max(1, durationInFrames - 8);
  const perWord = Math.max(1, exitStart / words.length);
  const current = Math.min(words.length - 1, Math.floor(frame / perWord));
  const exitP = interpolate(frame, [exitStart, durationInFrames - 1], [0, 1], {
    easing: theme.ease.in,
    ...CL,
  });
  const base = isWide ? 92 : 104;
  const breathe = 1 + Math.sin(frame / 22) * 0.008;
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
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 22,
          fontFamily,
          fontWeight: 700,
          fontSize: big ? base + 20 : base,
          lineHeight: 1.45,
          textAlign: "center",
          opacity: 1 - exitP,
          transform: `translateY(${-exitP * 40}px) scale(${breathe})`,
        }}
      >
        {words.map((w, i) => {
          const p = spring({
            frame: frame - i * 3,
            fps,
            config: theme.spring.snappy,
          });
          const active = i === current;
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: p,
                transform: `translateY(${interpolate(p, [0, 1], [40, 0])}px) scale(${interpolate(p, [0, 1], [0.94, 1])})`,
                color: active ? theme.colors.hero : theme.colors.text,
                textShadow: active
                  ? `0 0 36px ${theme.colors.hero}88, 0 4px 20px rgba(0,0,0,0.7)`
                  : "0 4px 24px rgba(0,0,0,0.75)",
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

// ===== ওপরে: মূল বিষয় (ছোট) =====
const TopicChip: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;
  const p = spring({ frame: frame - 3, fps, config: theme.spring.bouncy });
  const exitP = interpolate(frame, [dur - 8, dur - 1], [0, 1], {
    easing: theme.ease.in,
    ...CL,
  });
  const float = Math.sin(frame / 30) * 4;
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: isWide ? 70 : height * 0.14,
        display: "flex",
        justifyContent: "center",
        opacity: p * (1 - exitP),
        transform: `translateY(${interpolate(p, [0, 1], [-36, 0]) + float - exitP * 30}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`,
      }}
    >
      <div
        style={{
          padding: "14px 40px",
          borderRadius: 999,
          background: "rgba(11,16,32,0.62)",
          border: `2px solid ${theme.colors.accent}`,
          fontFamily,
          fontWeight: 700,
          fontSize: isWide ? 44 : 50,
          color: theme.colors.text,
          maxWidth: "88%",
          textAlign: "center",
        }}
      >
        {text}
      </div>
    </div>
  );
};

// number_counter: সংখ্যা ০ থেকে গুনে ওঠে
const parseNumber = (text: string) => {
  const m = text.match(/[0-9০-৯]+(?:[.,][0-9০-৯]+)*/);
  if (!m || m.index === undefined) return null;
  const raw = m[0];
  const bn = /[০-৯]/.test(raw);
  const en = toEn(raw);
  const numStr = /^\d{1,3}(,\d{3})+$/.test(en)
    ? en.replace(/,/g, "")
    : en.replace(",", ".");
  const value = parseFloat(numStr);
  if (isNaN(value)) return null;
  const decimals = (numStr.split(".")[1] || "").length;
  return {
    value,
    decimals,
    bn,
    before: text.slice(0, m.index).trim(),
    after: text.slice(m.index + raw.length).trim(),
  };
};

const CounterTop: React.FC<{ text: string; dur: number }> = ({ text, dur }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;
  const info = parseNumber(text);
  if (!info) return <TopicChip text={text} dur={dur} />;
  const p = spring({ frame: frame - 2, fps, config: theme.spring.smooth });
  const exitP = interpolate(frame, [dur - 8, dur - 1], [0, 1], {
    easing: theme.ease.in,
    ...CL,
  });
  const v = interpolate(
    spring({ frame: frame - 4, fps, config: { damping: 30, stiffness: 60 } }),
    [0, 1],
    [0, info.value]
  );
  const fmt = (x: number): string => {
    let s = x.toFixed(info.decimals);
    if (info.decimals === 0 && info.value >= 1000) {
      s = Number(s).toLocaleString("en-US");
    }
    return info.bn ? toBn(s) : s;
  };
  const finalLen = fmt(info.value).length;
  const size = Math.min(isWide ? 130 : 150, Math.floor((width - 200) / (finalLen * 0.62)));
  const label = [info.before, info.after].filter(Boolean).join(" ");
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: isWide ? 40 : height * 0.1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: p * (1 - exitP),
        transform: `translateY(${interpolate(p, [0, 1], [-30, 0]) - exitP * 30}px)`,
      }}
    >
      <div
        style={{
          fontFamily,
          fontWeight: 700,
          fontSize: size,
          lineHeight: 1.2,
          color: theme.colors.accent,
          fontVariantNumeric: "tabular-nums",
          textShadow: "0 4px 28px rgba(0,0,0,0.7)",
        }}
      >
        {fmt(v)}
      </div>
      {label ? (
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize: isWide ? 40 : 46,
            color: theme.colors.text,
            textShadow: "0 4px 20px rgba(0,0,0,0.7)",
          }}
        >
          {label}
        </div>
      ) : null}
    </div>
  );
};

// শেষ সিনে ব্র্যান্ড
const ClosingMark: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isWide = width > height;
  const p = spring({ frame: frame - 10, fps, config: theme.spring.bouncy });
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: isWide ? height * 0.78 : height * 0.76,
        display: "flex",
        justifyContent: "center",
        opacity: p,
        transform: `translateY(${(1 - p) * 40}px) scale(${0.9 + 0.1 * p})`,
      }}
    >
      <div
        style={{
          padding: "18px 56px",
          borderRadius: 999,
          background: "rgba(11,16,32,0.62)",
          border: `2px solid ${theme.colors.hero}`,
          boxShadow: `0 0 60px ${theme.colors.hero}66, 0 0 120px ${theme.colors.hero}33`,
          fontFamily,
          fontWeight: 700,
          fontSize: isWide ? 52 : 58,
          color: theme.colors.text,
        }}
      >
        {BRAND}
      </div>
    </div>
  );
};

// ===== সিন =====
const SceneView: React.FC<{
  sc: any;
  index: number;
  sentences: string[];
  timings: SentenceTiming[];
  fps: number;
  lead: number;
  domain: string;
  sfxReady: boolean;
}> = ({ sc, index, sentences, timings, fps, lead, domain, sfxReady }) => {
  const frame = useCurrentFrame();
  const total: number = sc.duration_frames + lead;
  const ids: number[] = sc.sentences;
  const hasImage = !!sc.image_file;
  const clips: ClipInfo[] = Array.isArray(sc.clips) ? sc.clips : [];
  const topic = String(sc.on_screen_text || "").trim();
  const opacity =
    lead > 0
      ? interpolate(frame, [0, lead], [0, 1], { easing: theme.ease.out, ...CL })
      : 1;

  const segs: Seg[] = [];
  ids.forEach((id, k) => {
    const t = timings[id - 1];
    const words = splitWords(String(sentences[id - 1] || ""));
    if (!t || words.length === 0) return;
    const chunks = chunkWords(words);
    const sStart = Math.round((t.start - sc.start_sec) * fps) + lead;
    const sEnd =
      k + 1 < ids.length
        ? Math.round((timings[ids[k + 1] - 1].start - sc.start_sec) * fps) + lead
        : total;
    const span = Math.max(chunks.length, sEnd - sStart);
    const each = Math.max(1, Math.floor(span / chunks.length));
    chunks.forEach((ch, ci) => {
      segs.push({
        from: sStart + ci * each,
        to: ci === chunks.length - 1 ? sStart + span : sStart + (ci + 1) * each,
        words: ch,
      });
    });
  });

  const sfx = String(sc.sfx || "none");
  const playSfx = sfxReady && SFX_NAMES.includes(sfx);

  return (
    <AbsoluteFill style={{ opacity }}>
      {clips.length > 0 ? (
        <>
          <BgMesh seed={index + 1} />
          <ClipReel clips={clips} total={total} fps={fps} />
        </>
      ) : hasImage ? (
        <>
          <BgMesh seed={index + 1} />
          <KenBurns src={sc.image_file} index={index} total={total} />
        </>
      ) : domain === "space" ? (
        <SpaceMotion seed={index + 1} />
      ) : (
        <>
          <BgMesh seed={index + 1} />
          <Dust seed={index + 1} />
        </>
      )}
      {topic && sc.template !== "closing" ? (
        sc.template === "number_counter" ? (
          <CounterTop text={topic} dur={total} />
        ) : (
          <TopicChip text={topic} dur={total} />
        )
      ) : null}
      {segs.map((sg, i) => (
        <Sequence
          key={i}
          from={sg.from}
          durationInFrames={Math.max(1, sg.to - sg.from)}
        >
          <WordsText
            words={sg.words}
            durationInFrames={Math.max(1, sg.to - sg.from)}
            big={sc.template === "hook"}
          />
        </Sequence>
      ))}
      {sc.template === "closing" ? <ClosingMark /> : null}
      {playSfx ? (
        <Sequence from={Math.max(0, lead - 3)}>
          <Audio src={staticFile(`sfx/${sfx}.wav`)} volume={0.35} />
        </Sequence>
      ) : null}
    </AbsoluteFill>
  );
};

const Main: React.FC = () => {
  const p = plan as any;
  const sentences: string[] = p.sentences;
  const timings: SentenceTiming[] = p.sentence_timings;
  const scenes: any[] = p.scenes;
  const fps: number = p.fps;
  const domain: string = p.domain || "general";
  const sfxReady = !!p.sfx_ready;
  let cursor = 0;
  const parts: React.ReactNode[] = [];
  scenes.forEach((sc, i) => {
    const lead = i === 0 ? 0 : Math.min(LEAD, cursor);
    parts.push(
      <Sequence
        key={i}
        from={cursor - lead}
        durationInFrames={Math.max(1, sc.duration_frames + lead)}
      >
        <SceneView
          sc={sc}
          index={i}
          sentences={sentences}
          timings={timings}
          fps={fps}
          lead={lead}
          domain={domain}
          sfxReady={sfxReady}
        />
      </Sequence>
    );
    cursor += sc.duration_frames;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: theme.colors.bg }}>
      {parts}
      <Grade />
      <Grain />
      <Vignette />
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
