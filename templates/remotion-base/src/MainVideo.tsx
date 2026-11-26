import React from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';

export const MainVideo: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const opacity = interpolate(frame, [0, 15], [0, 1], { extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 30% 20%, #1e293b 0%, #090d16 70%)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 96,
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          transform: `scale(${scale})`,
          opacity,
          color: '#f8fafc',
          fontSize: 72,
          fontWeight: 800,
          textAlign: 'center',
          lineHeight: 1.15,
        }}
      >
        {title}
      </div>
    </AbsoluteFill>
  );
};
