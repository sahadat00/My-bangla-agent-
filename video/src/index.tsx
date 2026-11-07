import React from "react";
import {
  AbsoluteFill,
  Composition,
  registerRoot,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { loadFont } from "@remotion/google-fonts/HindSiliguri";

const { fontFamily } = loadFont("normal", {
  weights: ["700"],
  subsets: ["bengali", "latin"],
});

const Hook: React.FC<{ text: string }> = ({ text }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0B1020",
        justifyContent: "center",
        alignItems: "center",
        padding: 90,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "center",
          gap: 24,
          fontFamily,
          fontWeight: 700,
          fontSize: 120,
          lineHeight: 1.4,
          color: "#F5F7FA",
          textAlign: "center",
        }}
      >
        {words.map((w, i) => {
          const s = spring({ frame: frame - i * 6, fps, config: { damping: 14 } });
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                opacity: s,
                transform: `translateY(${(1 - s) * 60}px)`,
                color: i === words.length - 1 ? "#4FC3F7" : "#F5F7FA",
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

const Root: React.FC = () => (
  <Composition
    id="Test"
    component={Hook}
    durationInFrames={90}
    fps={30}
    width={1080}
    height={1920}
    defaultProps={{ text: "মহাবিশ্বে আমরা কি একা?" }}
  />
);

registerRoot(Root);
