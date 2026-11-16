import { forwardRef } from "react";

import type { ObservationTrace } from "../../lib/observation-trace";

const focusColors = {
  shape: "#d5563f",
  material: "#6c56b4",
  text: "#e3ad24",
  usage: "#2f766e",
  memory: "#b94d68",
} as const;

function hash(value: string) {
  let result = 0;
  for (const character of value) result = (result * 31 + character.charCodeAt(0)) >>> 0;
  return result;
}

export const PersonalResiduePoster = forwardRef<SVGSVGElement, { trace: ObservationTrace }>(
  function PersonalResiduePoster({ trace }, ref) {
    const matched = trace.attempts.filter((attempt) => attempt.matchedCuratorialAnswer).length;

    return (
      <svg
        ref={ref}
        className="personal-residue-poster"
        role="img"
        aria-label="我的观察残差"
        viewBox="0 0 800 1000"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="800" height="1000" fill="#eee9dc" />
        <path d="M54 52H746V948H54Z" fill="none" stroke="#172624" strokeWidth="2" />
        <text x="82" y="108" fill="#172624" fontFamily="serif" fontSize="38">PERSONAL RESIDUE</text>
        <text x="84" y="145" fill="#172624" fontFamily="sans-serif" fontSize="18">个人观察残差 / 本地生成，不进入公共档案</text>
        <line x1="82" y1="178" x2="718" y2="178" stroke="#172624" strokeWidth="2" />

        {trace.attempts.map((attempt, index) => {
          const seed = hash(attempt.challengeId);
          const y = 235 + index * Math.min(112, 560 / Math.max(trace.attempts.length, 1));
          const width = 250 + seed % 270;
          const offset = seed % 96;
          const color = focusColors[attempt.focus];
          return (
            <g key={attempt.challengeId} data-focus={attempt.focus}>
              <path
                d={`M${110 + offset} ${y} H${110 + offset + width} L${92 + offset + width} ${y + 54} H${94 + offset} Z`}
                fill={color}
                fillOpacity={attempt.matchedCuratorialAnswer ? 0.68 : 0.34}
                stroke="#172624"
                strokeWidth={attempt.matchedCuratorialAnswer ? 2 : 4}
                strokeDasharray={attempt.matchedCuratorialAnswer ? undefined : "12 9"}
              />
              <circle cx={100 + (seed % 560)} cy={y + 27} r="9" fill="#eee9dc" stroke="#172624" strokeWidth="2" />
              <text x="84" y={y - 10} fill="#172624" fontFamily="monospace" fontSize="14">
                {String(index + 1).padStart(2, "0")} / {attempt.focus.toUpperCase()}
              </text>
            </g>
          );
        })}

        <line x1="82" y1="850" x2="718" y2="850" stroke="#172624" strokeWidth="2" />
        <text x="82" y="900" fill="#172624" fontFamily="serif" fontSize="48">{trace.attempts.length}</text>
        <text x="142" y="895" fill="#172624" fontFamily="sans-serif" fontSize="17">次观察</text>
        <text x="338" y="900" fill="#172624" fontFamily="serif" fontSize="48">{matched}</text>
        <text x="398" y="895" fill="#172624" fontFamily="sans-serif" fontSize="17">次一致</text>
        <text x="586" y="900" fill="#172624" fontFamily="serif" fontSize="48">{trace.attempts.length - matched}</text>
        <text x="646" y="895" fill="#172624" fontFamily="sans-serif" fontSize="17">次不同</text>
        <text x="84" y="937" fill="#172624" fontFamily="monospace" fontSize="13">MACHINE MISREAD ARCHIVE / TRACE V1</text>
      </svg>
    );
  },
);
