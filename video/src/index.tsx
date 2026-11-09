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
  weights: ["500", "700"],
  subsets: ["bengali", "latin"],
});

// ================= থিম (সব রং, ছায়া, গোলাকার ভাব এক জায়গায়) =================
const T = {
  bg: "#0B1020",
  bg2: "#1B2A4A",
  hero: "#4FC3F7",
  accent: "#FFB74D",
  text: "#F5F7FA",
  glass:
    "linear-gradient(145deg, rgba(255,255,255,0.16) 0%, rgba(255,255,255,0.04) 100%), rgba(11,16,32,0.58)",
  border: "1px solid rgba(255,255,255,0.2)",
  radius: 32,
  shadow: "0 24px 60px rgba(0,0,0,0.45)",
  textShadow: "0 4px 24px rgba(0,0,0,0.6)",
};

const MAX_WORDS = 6;
const FADE_IN = 6;
const FADE_OUT = 8;
const LEAD = 5; // ভিজ্যুয়াল কথার ৫ ফ্রেম আগে ঢোকে
const BRAND = "TOP X BANGLA";

const ease = Easing.bezier(0.16, 1, 0.3, 1);
const CL = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const glass: React.CSSProperties = {
  background: T.glass,
  border: T.border,
  borderRadius: T.radius,
  boxShadow: T.shadow,
};

type SentenceTiming = { start: number; end: number };
type Seg = { from: number; to: number; words: string[] };

// ================= ছোট সহায়ক =================
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

const useLayout = () => {
  const { width, height } = useVideoConfig();
  const isWide = width > height;
  return { width, height, isWide, pad: isWide ? 140 : 72 };
};

// কনটেন্টের জায়গা: নিচের অংশ সাবটাইটেলের জন্য ফাঁকা
const Stage: React.FC<{ children: React.ReactNode; align?: "center" | "flex-start" }> = ({
  children,
  align = "center",
}) => {
  const { isWide, pad } = useLayout();
  return (
    <AbsoluteFill
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: align,
        paddingLeft: pad,
        paddingRight: pad,
        paddingTop: isWide ? 60 : 0,
        paddingBottom: isWide ? 190 : 300,
      }}
    >
      {children}
    </AbsoluteFill>
  );
};

// ================= ব্যাকগ্রাউন্ড =================
const MOTIONS = ["zoomIn", "panLeft", "zoomOut", "panRight", "drift"] as const;

const MovingImage: React.FC<{
  src: string;
  motion: (typeof MOTIONS)[number];
  total: number;
  dim: number;
}> = ({ src, motion, total, dim }) => {
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
  const top = (dim * 0.8).toFixed(2);
  const mid = (dim * 0.6).toFixed(2);
  const bot = Math.min(0.92, dim + 0.25).toFixed(2);
  return (
    <AbsoluteFill style={{ overflow: "hidden", backgroundColor: T.bg }}>
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
          background: `linear-gradient(180deg, rgba(11,16,32,${top}) 0%, rgba(11,16,32,${mid}) 45%, rgba(11,16,32,${bot}) 100%)`,
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
          backgroundColor: i % 9 === 0 ? T.hero : T.text,
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
            backgroundColor: i === 1 ? T.accent : T.hero,
            opacity: 0.85,
          }}
        />
      </React.Fragment>
    );
  });
  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(circle at 50% 50%, ${T.bg2} 0%, ${T.bg} 70%)`,
      }}
    >
      {stars}
      {rings}
    </AbsoluteFill>
  );
};

const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at center, rgba(0,0,0,0) 55%, rgba(0,0,0,0.5) 100%)",
    }}
  />
);

// ================= সাবটাইটেল (ভয়েসের সঙ্গে মেলানো) =================
const Caption: React.FC<{ segs: Seg[] }> = ({ segs }) => {
  const frame = useCurrentFrame();
  const { isWide, height } = useLayout();
  const seg = segs.find((s) => frame >= s.from && frame < s.to);
  if (!seg) return null;
  const local = frame - seg.from;
  const o = interpolate(local, [0, 4], [0, 1], CL);
  const y = interpolate(local, [0, 8], [14, 0], { ...CL, easing: ease });
  return (
    <div
      style={{
        position: "absolute",
        left: isWide ? 220 : 56,
        right: isWide ? 220 : 56,
        ...(isWide ? { bottom: 64 } : { top: height * 0.8 }),
        display: "flex",
        justifyContent: "center",
        opacity: o,
        transform: `translateY(${y}px)`,
      }}
    >
      <div
        style={{
          ...glass,
          borderRadius: 28,
          padding: "20px 36px",
          fontFamily,
          fontWeight: 500,
          fontSize: isWide ? 44 : 48,
          lineHeight: 1.45,
          color: T.text,
          textAlign: "center",
        }}
      >
        {seg.words.join(" ")}
      </div>
    </div>
  );
};

// ================= টেমপ্লেট ১: hook (কাইনেটিক টাইপোগ্রাফি) =================
const HookView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isWide } = useLayout();
  const words = splitWords(text);
  const lineW = interpolate(
    frame,
    [words.length * 5, words.length * 5 + 20],
    [0, isWide ? 300 : 380],
    { ...CL, easing: ease }
  );
  return (
    <Stage>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: 28,
          rowGap: 8,
          fontFamily,
          fontWeight: 700,
          fontSize: isWide ? 116 : 136,
          lineHeight: 1.4,
          textAlign: "center",
          textShadow: T.textShadow,
        }}
      >
        {words.map((w, i) => {
          const s = spring({
            frame: frame - i * 5,
            fps,
            config: { damping: 14, stiffness: 120 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: s,
                transform: `translateY(${(1 - s) * 70}px) scale(${0.9 + 0.1 * s})`,
                color: i === words.length - 1 ? T.hero : T.text,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 40,
          height: 10,
          width: lineW,
          borderRadius: 5,
          background: T.hero,
          boxShadow: `0 0 28px ${T.hero}`,
        }}
      />
    </Stage>
  );
};

// ================= টেমপ্লেট ২: keyword_card (গ্লাস কার্ড) =================
const KeywordView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isWide } = useLayout();
  const words = splitWords(text);
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 110 } });
  const float = Math.sin((frame / fps) * 1.3) * 6;
  const barW = interpolate(frame, [6, 26], [0, 96], { ...CL, easing: ease });
  return (
    <Stage>
      <div
        style={{
          ...glass,
          width: "100%",
          maxWidth: isWide ? 1400 : undefined,
          padding: isWide ? "64px 72px" : "72px 56px",
          opacity: s,
          transform: `translateY(${(1 - s) * 60 + float}px) scale(${0.94 + 0.06 * s})`,
        }}
      >
        <div
          style={{
            height: 8,
            width: barW,
            borderRadius: 4,
            background: T.hero,
            marginBottom: 36,
          }}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 24,
            rowGap: 6,
            fontFamily,
            fontWeight: 700,
            fontSize: isWide ? 88 : 100,
            lineHeight: 1.45,
            color: T.text,
          }}
        >
          {words.map((w, i) => {
            const ws = spring({
              frame: frame - 8 - i * 4,
              fps,
              config: { damping: 15, stiffness: 120 },
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  opacity: ws,
                  transform: `translateY(${(1 - ws) * 36}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

// ================= টেমপ্লেট ৩: number_counter (সংখ্যা গোনা) =================
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
  const before = text.slice(0, m.index).trim();
  const after = text.slice(m.index + raw.length).trim();
  return { value, decimals, bn, before, after };
};

const CounterView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, isWide, pad } = useLayout();
  const info = parseNumber(text);
  if (!info) return <KeywordView text={text} />;
  const s = spring({ frame, fps, config: { damping: 15, stiffness: 110 } });
  const p = interpolate(frame, [6, 6 + Math.round(fps * 1.6)], [0, 1], {
    ...CL,
    easing: ease,
  });
  const fmt = (v: number): string => {
    let str = v.toFixed(info.decimals);
    if (info.decimals === 0 && info.value >= 1000) {
      str = Number(str).toLocaleString("en-US");
    }
    return info.bn ? toBn(str) : str;
  };
  const finalStr = fmt(info.value);
  const shown = fmt(info.value * p);
  const avail = width - pad * 2 - 112;
  const fontSize = Math.min(isWide ? 200 : 230, Math.floor(avail / (finalStr.length * 0.62)));
  const labelStyle: React.CSSProperties = {
    fontFamily,
    fontWeight: 700,
    fontSize: isWide ? 60 : 72,
    lineHeight: 1.4,
    color: T.text,
    textAlign: "center",
  };
  return (
    <Stage>
      <div
        style={{
          ...glass,
          width: "100%",
          maxWidth: isWide ? 1200 : undefined,
          padding: "56px 56px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          opacity: s,
          transform: `translateY(${(1 - s) * 60}px) scale(${0.94 + 0.06 * s})`,
        }}
      >
        {info.before ? <div style={labelStyle}>{info.before}</div> : null}
        <div
          style={{
            fontFamily,
            fontWeight: 700,
            fontSize,
            lineHeight: 1.25,
            color: T.hero,
            textShadow: `0 0 40px rgba(79,195,247,0.55)`,
          }}
        >
          {shown}
        </div>
        {info.after ? <div style={labelStyle}>{info.after}</div> : null}
        <div
          style={{
            marginTop: 36,
            height: 8,
            width: "60%",
            borderRadius: 4,
            background: "rgba(255,255,255,0.14)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${p * 100}%`,
              background: T.hero,
              borderRadius: 4,
            }}
          />
        </div>
      </div>
    </Stage>
  );
};

// ================= টেমপ্লেট ৪: image_kenburns (ছবি প্রধান) =================
const ImageLabelView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isWide, pad, height } = useLayout();
  const words = splitWords(text);
  const barH = interpolate(frame, [0, 22], [0, 100], { ...CL, easing: ease });
  return (
    <div
      style={{
        position: "absolute",
        left: pad,
        right: pad,
        ...(isWide ? { bottom: 230 } : { top: height * 0.56 }),
        display: "flex",
        alignItems: "stretch",
        gap: 28,
      }}
    >
      <div
        style={{
          width: 10,
          borderRadius: 5,
          background: T.hero,
          transformOrigin: "top",
          transform: `scaleY(${barH / 100})`,
        }}
      />
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          columnGap: 22,
          rowGap: 6,
          fontFamily,
          fontWeight: 700,
          fontSize: isWide ? 84 : 92,
          lineHeight: 1.4,
          color: T.text,
          textShadow: T.textShadow,
        }}
      >
        {words.map((w, i) => {
          const s = spring({
            frame: frame - 6 - i * 4,
            fps,
            config: { damping: 15, stiffness: 120 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: s,
                transform: `translateX(${(1 - s) * -40}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </div>
  );
};

// ================= টেমপ্লেট ৫: process_steps (ধাপের টাইমলাইন) =================
const splitSteps = (text: string): string[] => {
  let parts = text
    .split(/\s*(?:→|->|>|,|،|\||·|›)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length < 2) {
    const w = splitWords(text);
    if (w.length < 2) return [text];
    const n = Math.min(3, Math.max(2, Math.ceil(w.length / 2)));
    const size = Math.ceil(w.length / n);
    parts = [];
    for (let i = 0; i < w.length; i += size) {
      parts.push(w.slice(i, i + size).join(" "));
    }
  }
  return parts.slice(0, 4);
};

const ProcessView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isWide } = useLayout();
  const steps = splitSteps(text);
  const NODE = 76;
  const GAP = 36;
  const lineH = (steps.length - 1) * (NODE + GAP);
  const prog = interpolate(frame, [4, 4 + steps.length * 10], [0, 1], {
    ...CL,
    easing: ease,
  });
  return (
    <Stage>
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: isWide ? 1200 : undefined,
          display: "flex",
          flexDirection: "column",
          gap: GAP,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: NODE / 2 - 2,
            top: NODE / 2,
            width: 4,
            height: lineH * prog,
            borderRadius: 2,
            background: "rgba(79,195,247,0.55)",
          }}
        />
        {steps.map((st, i) => {
          const s = spring({
            frame: frame - i * 10,
            fps,
            config: { damping: 15, stiffness: 120 },
          });
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 28,
                opacity: s,
                transform: `translateX(${(1 - s) * 50}px)`,
              }}
            >
              <div
                style={{
                  width: NODE,
                  height: NODE,
                  flexShrink: 0,
                  borderRadius: NODE / 2,
                  background: T.hero,
                  color: T.bg,
                  fontFamily,
                  fontWeight: 700,
                  fontSize: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  boxShadow: "0 0 30px rgba(79,195,247,0.5)",
                }}
              >
                {toBn(String(i + 1))}
              </div>
              <div
                style={{
                  ...glass,
                  flex: 1,
                  padding: "24px 36px",
                  fontFamily,
                  fontWeight: 700,
                  fontSize: isWide ? 56 : 62,
                  lineHeight: 1.4,
                  color: T.text,
                }}
              >
                {st}
              </div>
            </div>
          );
        })}
      </div>
    </Stage>
  );
};

// ================= টেমপ্লেট ৬: comparison (দুই পাশ) =================
const splitVs = (text: string): string[] | null => {
  const p = text
    .split(/\s*(?:বনাম|vs\.?|VS|Vs|\||—|–|↔|×)\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return p.length === 2 ? p : null;
};

const CompareView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isWide } = useLayout();
  const parts = splitVs(text);
  if (!parts) return <KeywordView text={text} />;
  const a = spring({ frame, fps, config: { damping: 15, stiffness: 110 } });
  const b = spring({ frame: frame - 8, fps, config: { damping: 15, stiffness: 110 } });
  const v = spring({ frame: frame - 16, fps, config: { damping: 11, stiffness: 140 } });
  const dir = isWide ? "X" : "Y";
  const cardStyle: React.CSSProperties = {
    ...glass,
    flex: 1,
    width: isWide ? undefined : "100%",
    padding: "48px 40px",
    fontFamily,
    fontWeight: 700,
    fontSize: isWide ? 72 : 78,
    lineHeight: 1.4,
    textAlign: "center",
    color: T.text,
  };
  return (
    <Stage>
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: isWide ? "row" : "column",
          alignItems: "center",
          gap: 24,
        }}
      >
        <div
          style={{
            ...cardStyle,
            opacity: a,
            transform: `translate${dir}(${(1 - a) * -80}px)`,
          }}
        >
          {parts[0]}
        </div>
        <div
          style={{
            width: 96,
            height: 96,
            flexShrink: 0,
            borderRadius: 48,
            background: T.accent,
            color: T.bg,
            fontFamily,
            fontWeight: 700,
            fontSize: 40,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transform: `scale(${v})`,
          }}
        >
          VS
        </div>
        <div
          style={{
            ...cardStyle,
            border: "2px solid rgba(79,195,247,0.75)",
            opacity: b,
            transform: `translate${dir}(${(1 - b) * 80}px)`,
          }}
        >
          {parts[1]}
        </div>
      </div>
    </Stage>
  );
};

// ================= টেমপ্লেট ৭: statement (মাস্ক রিভিল) =================
const StatementView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isWide } = useLayout();
  const words = splitWords(text);
  const bar = interpolate(frame, [0, 24], [0, 1], { ...CL, easing: ease });
  return (
    <Stage>
      <div
        style={{
          display: "flex",
          alignItems: "stretch",
          gap: 36,
          width: "100%",
          maxWidth: isWide ? 1400 : undefined,
        }}
      >
        <div
          style={{
            width: 10,
            borderRadius: 5,
            background: T.hero,
            transformOrigin: "top",
            transform: `scaleY(${bar})`,
          }}
        />
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            columnGap: 24,
            rowGap: 26,
            fontFamily,
            fontWeight: 700,
            fontSize: isWide ? 96 : 108,
            lineHeight: 1.4,
            color: T.text,
            textShadow: T.textShadow,
          }}
        >
          {words.map((w, i) => {
            const s = spring({
              frame: frame - 6 - i * 5,
              fps,
              config: { damping: 18, stiffness: 120 },
            });
            return (
              <span
                key={i}
                style={{
                  display: "inline-block",
                  overflow: "hidden",
                  padding: "0.22em 0.04em",
                  margin: "-0.22em 0",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: `translateY(${(1 - s) * 115}%)`,
                  }}
                >
                  {w}
                </span>
              </span>
            );
          })}
        </div>
      </div>
    </Stage>
  );
};

// ================= টেমপ্লেট ৮: closing (সমাপ্তি + ব্র্যান্ড) =================
const ClosingView: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { isWide } = useLayout();
  const words = splitWords(text);
  const delay = words.length * 5 + 10;
  const b = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 120 } });
  return (
    <Stage>
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          columnGap: 24,
          rowGap: 8,
          fontFamily,
          fontWeight: 700,
          fontSize: isWide ? 96 : 110,
          lineHeight: 1.4,
          textAlign: "center",
          color: T.text,
          textShadow: T.textShadow,
        }}
      >
        {words.map((w, i) => {
          const s = spring({
            frame: frame - i * 5,
            fps,
            config: { damping: 15, stiffness: 120 },
          });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: s,
                transform: `translateY(${(1 - s) * 50}px)`,
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
      <div
        style={{
          ...glass,
          marginTop: 56,
          borderRadius: 999,
          padding: "22px 56px",
          fontFamily,
          fontWeight: 700,
          fontSize: isWide ? 52 : 58,
          letterSpacing: 0,
          color: T.hero,
          opacity: b,
          transform: `translateY(${(1 - b) * 30}px) scale(${0.92 + 0.08 * b})`,
          boxShadow: `0 0 44px rgba(79,195,247,0.35), ${T.shadow}`,
        }}
      >
        {BRAND}
      </div>
    </Stage>
  );
};

// ================= টেমপ্লেট বাছাই =================
const DIM: Record<string, number> = {
  hook: 0.5,
  keyword_card: 0.65,
  number_counter: 0.7,
  image_kenburns: 0.22,
  process_steps: 0.7,
  comparison: 0.7,
  statement: 0.62,
  closing: 0.72,
};

const Content: React.FC<{ template: string; text: string }> = ({ template, text }) => {
  switch (template) {
    case "hook":
      return <HookView text={text} />;
    case "number_counter":
      return <CounterView text={text} />;
    case "image_kenburns":
      return <ImageLabelView text={text} />;
    case "process_steps":
      return <ProcessView text={text} />;
    case "comparison":
      return <CompareView text={text} />;
    case "statement":
      return <StatementView text={text} />;
    case "closing":
      return <ClosingView text={text} />;
    default:
      return <KeywordView text={text} />;
  }
};

// ================= সিন =================
const SceneView: React.FC<{
  sc: any;
  index: number;
  sentences: string[];
  timings: SentenceTiming[];
  fps: number;
  lead: number;
}> = ({ sc, index, sentences, timings, fps, lead }) => {
  const frame = useCurrentFrame();
  const total: number = sc.duration_frames + lead;
  const ids: number[] = sc.sentences;
  const hasImage = !!sc.image_file;
  const template: string = sc.template;
  const motion = MOTIONS[index % MOTIONS.length];
  const opacity = Math.min(
    interpolate(frame, [0, Math.max(FADE_IN, lead + 1)], [0, 1], CL),
    interpolate(frame, [total - FADE_OUT, total], [1, 0], CL)
  );
  const pop = interpolate(frame, [total - FADE_OUT, total], [1, 0.97], {
    ...CL,
    easing: Easing.in(Easing.quad),
  });

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

  const rawText = String(sc.on_screen_text || "").trim();
  const text =
    rawText ||
    splitWords(String(sentences[ids[0] - 1] || "")).slice(0, MAX_WORDS).join(" ");

  return (
    <AbsoluteFill style={{ opacity }}>
      {hasImage ? (
        <MovingImage
          src={sc.image_file}
          motion={motion}
          total={total}
          dim={DIM[template] ?? 0.65}
        />
      ) : (
        <SpaceMotion seed={index + 1} />
      )}
      <Vignette />
      <AbsoluteFill style={{ transform: `scale(${pop})` }}>
        <Content template={template} text={text} />
      </AbsoluteFill>
      <Caption segs={segs} />
    </AbsoluteFill>
  );
};

const Main: React.FC = () => {
  const sentences: string[] = (plan as any).sentences;
  const timings: SentenceTiming[] = (plan as any).sentence_timings;
  const scenes: any[] = (plan as any).scenes;
  const fps: number = (plan as any).fps;
  let cursor = 0;
  const parts: React.ReactNode[] = [];
  scenes.forEach((sc, i) => {
    const lead = i === 0 ? 0 : LEAD;
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
        />
      </Sequence>
    );
    cursor += sc.duration_frames;
  });
  return (
    <AbsoluteFill style={{ backgroundColor: T.bg }}>
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
