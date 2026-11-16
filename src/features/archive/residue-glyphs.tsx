import type { ArchiveItem } from "../../domain/archive";

export type ResidueVariant =
  | "bus-tickets"
  | "keys"
  | "dictionary"
  | "audio-cassette"
  | "floppy-disk"
  | "vhs-tape"
  | "pager"
  | "payphone"
  | "slide-rule"
  | "rotary-phone"
  | "film-canisters"
  | "digital-clock"
  | "generic";

const variants: Record<string, ResidueVariant> = {
  "seed-bus-ticket-collection-01": "bus-tickets",
  "seed-old-keys-01": "keys",
  "seed-old-dictionary-01": "dictionary",
  "seed-audio-cassette-01": "audio-cassette",
  "seed-floppy-disk-01": "floppy-disk",
  "seed-vhs-tape-01": "vhs-tape",
  "seed-numeric-pager-01": "pager",
  "seed-card-payphone-01": "payphone",
  "seed-slide-rule-01": "slide-rule",
  "seed-rotary-telephone-01": "rotary-phone",
  "seed-film-canisters-01": "film-canisters",
  "seed-digital-clock-01": "digital-clock",
};

export function resolveResidueVariant(item: Pick<ArchiveItem, "id">): ResidueVariant {
  return variants[item.id] ?? "generic";
}

export interface ResidueGlyphProps {
  variant: ResidueVariant;
  offset: number;
  fragmentation: number;
}

const rust = "#d94b32";
const violet = "#6851ba";
const ink = "#172624";
const paper = "#eee9dc";
const signal = "#e4b83f";

function BusTickets({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.24;
  const tear = 8 + fragmentation * 18;
  return (
    <>
      <g fill={violet} opacity=".48" transform={`translate(${shift} ${-shift * 0.35}) rotate(4 390 255)`}>
        <path d="M180 126H568V354H180V310L194 300 180 288V246L194 236 180 224V182L194 172 180 162Z" />
      </g>
      <g fill={rust} opacity=".82" style={{ mixBlendMode: "multiply" }}>
        <path d={`M128 112H492V210H128L${128 + tear} 194 128 180Z`} />
        <path d="M174 218H574V316H174L190 300 174 284Z" />
        <path d="M226 326H630V410H226L242 394 226 378Z" />
      </g>
      <g fill="none" stroke={paper} strokeWidth="4" opacity=".72">
        <path d="M154 112V210M200 112V210M532 218V316M274 326V410" strokeDasharray="7 9" />
        <path d="M236 146H442M252 174H402M260 252H506M300 278H462M306 360H560M324 384H512" />
      </g>
      <g fill={signal}>
        {Array.from({ length: 6 }).map((_, index) => (
          <rect key={index} x={270 + index * 31} y={132 + (index % 2) * 18} width="18" height="7" />
        ))}
      </g>
      <path d="M116 266H646" stroke={ink} strokeWidth="2" strokeDasharray="2 12" opacity=".48" />
    </>
  );
}

function Keys({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.2;
  const breakGap = 6 + fragmentation * 16;
  return (
    <>
      <g fill="none" stroke={violet} strokeWidth="28" opacity=".48" transform={`translate(${shift} ${-shift * 0.25}) rotate(8 390 260)`}>
        <circle cx="252" cy="346" r="64" />
        <path d="M295 300L514 102M333 330L552 132" />
      </g>
      <g fill="none" stroke={rust} strokeWidth="34" strokeLinecap="square" opacity=".84" style={{ mixBlendMode: "multiply" }}>
        <circle cx="238" cy="348" r="64" />
        <circle cx="364" cy="368" r="59" />
        <path d={`M280 302L376 ${214 - breakGap}M394 ${194 + breakGap}L526 74M405 322L492 236M512 216L586 142`} />
      </g>
      <g fill="none" stroke={paper} strokeWidth="18">
        <path d="M207 330L269 368M217 376L263 326M338 346L390 389M342 393L389 344" />
      </g>
      <g fill={rust}>
        <path d="M506 66H590V98H566V124H540V100H506Z" />
        <path d="M568 134H640V166H616V192H590V168H568Z" />
      </g>
      <path d="M186 414L624 102" stroke={signal} strokeWidth="5" strokeDasharray="28 22" opacity=".9" />
    </>
  );
}

function Dictionary({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.18;
  const crack = 12 + fragmentation * 18;
  return (
    <>
      <path d="M238 94H574V410H238Q190 386 190 338V150Q190 106 238 94Z" fill={violet} opacity=".46" transform={`translate(${shift} ${-shift * 0.3}) rotate(3 390 252)`} />
      <path d="M206 112H546V402H206Q166 378 166 338V162Q166 124 206 112Z" fill={rust} opacity=".84" style={{ mixBlendMode: "multiply" }} />
      <path d="M228 112V402" stroke={paper} strokeWidth="16" opacity=".75" />
      <g fill="none" stroke={paper} strokeWidth="4" opacity=".72">
        <path d="M254 162H492M254 198H468M254 326H500M254 360H454" />
        <path d={`M292 112L318 ${184 - crack} 294 218 336 258 310 298 348 344 326 402M410 112L388 170 424 216 396 268 438 310 412 402`} strokeWidth="7" />
      </g>
      <rect x="272" y="228" width="218" height="70" fill="none" stroke={signal} strokeWidth="5" transform="rotate(-3 381 263)" />
      <path d="M174 142L546 378M184 368L536 132" stroke={paper} strokeWidth="14" opacity=".25" />
      <text x="326" y="273" fill={paper} fontFamily="serif" fontSize="35" letterSpacing="10">字典</text>
    </>
  );
}

function AudioCassette({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.22;
  const reel = 54 - fragmentation * 8;
  return (
    <>
      <g fill={violet} opacity=".46" transform={`translate(${shift} ${-shift * 0.3}) rotate(3 400 260)`}>
        <rect x="126" y="128" width="548" height="270" rx="24" />
      </g>
      <path d="M112 116H654Q680 116 680 142V376Q680 402 654 402H112Q86 402 86 376V142Q86 116 112 116Z" fill={rust} opacity=".84" style={{ mixBlendMode: "multiply" }} />
      <rect x="140" y="154" width="486" height="136" rx="12" fill={paper} opacity=".74" />
      <g fill="none" stroke={ink} strokeWidth="12" opacity=".8">
        <circle cx="250" cy="222" r={reel} />
        <circle cx="516" cy="222" r={reel} />
        <circle cx="250" cy="222" r="18" stroke={signal} />
        <circle cx="516" cy="222" r="18" stroke={signal} />
      </g>
      <path d="M202 326H566L604 388H164Z" fill={violet} opacity=".42" />
      <path d="M250 222C320 146 438 306 516 222C590 142 640 202 694 170" fill="none" stroke={signal} strokeWidth="7" strokeDasharray="38 12" />
      <g fill={ink} opacity=".45">
        <rect x="226" y="338" width="42" height="18" /><rect x="498" y="338" width="42" height="18" />
      </g>
    </>
  );
}

function FloppyDisk({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.2;
  const cut = 18 + fragmentation * 22;
  return (
    <>
      <path d="M214 78H548L640 170V428H214Z" fill={violet} opacity=".46" transform={`translate(${shift} ${-shift * 0.2})`} />
      <path d="M184 96H526L618 188V426H184Z" fill={rust} opacity=".86" style={{ mixBlendMode: "multiply" }} />
      <path d="M276 96H526V230H276Z" fill={paper} opacity=".78" />
      <rect x={350 + cut} y="96" width="96" height="112" fill={ink} opacity=".52" />
      <rect x="248" y="288" width="310" height="138" fill={paper} opacity=".7" />
      <rect x="320" y="320" width="166" height="106" fill={violet} opacity=".46" />
      <circle cx="390" cy="358" r="33" fill="none" stroke={signal} strokeWidth="8" />
      <path d="M184 238H618M226 270H570M286 352H530" stroke={ink} strokeWidth="4" strokeDasharray="14 10" opacity=".48" />
      <path d="M196 410L594 116" stroke={paper} strokeWidth="14" opacity=".2" />
    </>
  );
}

function VhsTape({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.2;
  const gap = 16 + fragmentation * 26;
  return (
    <>
      <path d="M102 142H680V390H102Z" fill={violet} opacity=".46" transform={`translate(${shift} ${-shift * 0.2}) skewX(-3)`} />
      <path d="M82 128H664L704 168V382L674 412H82Z" fill={rust} opacity=".84" style={{ mixBlendMode: "multiply" }} />
      <rect x="148" y="174" width="482" height="148" fill={paper} opacity=".76" />
      <g fill="none" stroke={ink} strokeWidth="15">
        <circle cx="258" cy="248" r="58" />
        <circle cx="518" cy="248" r="58" />
      </g>
      <g fill="none" stroke={signal} strokeWidth="5">
        <circle cx="258" cy="248" r={30 + gap * 0.2} strokeDasharray="16 10" />
        <circle cx="518" cy="248" r={30 + gap * 0.2} strokeDasharray="16 10" />
      </g>
      <path d={`M258 248C340 ${178 - gap} 430 ${326 + gap * 0.4} 518 248`} fill="none" stroke={violet} strokeWidth="16" opacity=".62" />
      <path d="M160 354H626" stroke={paper} strokeWidth="26" opacity=".42" />
      <path d="M94 390H692" stroke={signal} strokeWidth="6" strokeDasharray="54 18" />
    </>
  );
}

function Pager({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.23;
  const loss = 20 + fragmentation * 58;
  return (
    <>
      <path d="M238 116H576L630 168V388H238Z" fill={violet} opacity=".48" transform={`translate(${shift} ${-shift * 0.3}) rotate(-5 420 250)`} />
      <path d="M202 126H552L610 184V388Q610 414 584 414H202Q176 414 176 388V152Q176 126 202 126Z" fill={rust} opacity=".85" style={{ mixBlendMode: "multiply" }} />
      <rect x="242" y="184" width="292" height="96" rx="8" fill={ink} opacity=".86" />
      <g fill={signal}>
        <rect x="270" y="218" width="58" height="14" />
        <rect x={350 + loss} y="218" width="42" height="14" />
        <rect x="448" y="218" width="56" height="14" />
      </g>
      <rect x="550" y="212" width="68" height="104" fill={paper} opacity=".68" />
      <path d="M238 326H526M238 354H468" stroke={paper} strokeWidth="9" opacity=".64" />
      <path d="M122 194H164M102 230H158M132 266H166" stroke={signal} strokeWidth="7" />
      <circle cx="548" cy="350" r="18" fill={violet} />
    </>
  );
}

function Payphone({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.18;
  const slip = 4 + fragmentation * 10;
  return (
    <>
      <rect x="252" y="94" width="350" height="340" rx="22" fill={violet} opacity=".46" transform={`translate(${shift} ${-shift * 0.2})`} />
      <rect x="226" y="104" width="346" height="326" rx="18" fill={rust} opacity=".84" style={{ mixBlendMode: "multiply" }} />
      <path d="M184 112Q132 112 118 166L104 224Q98 248 124 258L168 274Q192 282 202 258L218 218Q226 196 210 184L188 170Q178 162 184 112Z" fill={ink} opacity=".82" />
      <rect x="280" y="146" width="222" height="62" fill={paper} opacity=".75" />
      <rect x="474" y="238" width="34" height="132" fill={signal} opacity=".86" />
      <g fill={paper} opacity=".82">
        {Array.from({ length: 12 }).map((_, index) => (
          <rect key={index} x={278 + (index % 3) * 58 + (index > 5 ? slip : 0)} y={240 + Math.floor(index / 3) * 43} width="34" height="24" />
        ))}
      </g>
      <path d="M198 178C246 84 298 88 334 110" fill="none" stroke={signal} strokeWidth="7" strokeDasharray="20 13" />
    </>
  );
}

function SlideRule({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.24;
  const skip = Math.max(2, Math.round(3 + fragmentation * 3));
  return (
    <>
      <g fill={violet} opacity=".46" transform={`translate(${shift} ${-shift * 0.25}) rotate(2 390 260)`}>
        <rect x="86" y="150" width="628" height="208" />
      </g>
      <g fill={rust} opacity=".84" style={{ mixBlendMode: "multiply" }}>
        <rect x="72" y="136" width="636" height="66" />
        <rect x="104" y="224" width="594" height="60" />
        <rect x="72" y="306" width="636" height="66" />
      </g>
      <g stroke={paper} strokeWidth="4" opacity=".8">
        {Array.from({ length: 31 }).map((_, index) => (
          index % skip === 0 ? null : <path key={index} d={`M${92 + index * 19} 136V${index % 2 ? 166 : 178}M${92 + index * 19} 342V372`} />
        ))}
      </g>
      <rect x="398" y="110" width="54" height="288" fill="none" stroke={signal} strokeWidth="8" />
      <rect x={416 + shift} y="122" width="26" height="264" fill={paper} opacity=".28" />
      <path d="M104 254H698" stroke={ink} strokeWidth="4" strokeDasharray="8 12" />
    </>
  );
}

function RotaryPhone({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.18;
  const missing = Math.round(fragmentation * 4);
  const holes = Array.from({ length: 10 }, (_, index) => {
    const angle = (index / 10) * Math.PI * 2 - Math.PI / 2;
    return { x: 392 + Math.cos(angle) * 82, y: 286 + Math.sin(angle) * 82 };
  });
  return (
    <>
      <path d="M210 172Q222 112 286 106H510Q572 112 584 172L548 194Q526 170 492 166H304Q270 170 246 194Z" fill={violet} opacity=".5" transform={`translate(${shift} ${-shift * 0.3}) rotate(3 398 170)`} />
      <path d="M178 178Q188 112 258 104H502Q572 112 582 178L534 208Q514 180 478 176H282Q246 180 226 208Z" fill={rust} opacity=".86" style={{ mixBlendMode: "multiply" }} />
      <path d="M224 218H558L620 414H158Z" fill={rust} opacity=".75" />
      <circle cx="392" cy="286" r="116" fill={paper} opacity=".74" />
      <circle cx="392" cy="286" r="48" fill={violet} opacity=".55" />
      <g fill={ink}>
        {holes.map((hole, index) => index < missing ? null : <circle key={index} cx={hole.x} cy={hole.y} r="17" />)}
      </g>
      <path d="M558 190C684 244 596 356 678 402" fill="none" stroke={signal} strokeWidth="8" strokeDasharray="14 11" />
    </>
  );
}

function FilmCanisters({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.19;
  const unspool = 30 + fragmentation * 100;
  return (
    <>
      <g fill={violet} opacity=".48" transform={`translate(${shift} ${-shift * 0.25})`}>
        <ellipse cx="242" cy="172" rx="88" ry="30" /><rect x="154" y="172" width="176" height="190" /><ellipse cx="242" cy="362" rx="88" ry="30" />
        <ellipse cx="510" cy="206" rx="76" ry="28" /><rect x="434" y="206" width="152" height="164" /><ellipse cx="510" cy="370" rx="76" ry="28" />
      </g>
      <g fill={rust} opacity=".84" style={{ mixBlendMode: "multiply" }}>
        <ellipse cx="210" cy="158" rx="86" ry="30" /><rect x="124" y="158" width="172" height="194" /><ellipse cx="210" cy="352" rx="86" ry="30" />
        <ellipse cx="456" cy="198" rx="76" ry="27" /><rect x="380" y="198" width="152" height="170" /><ellipse cx="456" cy="368" rx="76" ry="27" />
        <ellipse cx="594" cy="122" rx="58" ry="22" /><rect x="536" y="122" width="116" height="128" /><ellipse cx="594" cy="250" rx="58" ry="22" />
      </g>
      <g fill="none" stroke={paper} strokeWidth="5" opacity=".66">
        <ellipse cx="210" cy="158" rx="56" ry="16" /><ellipse cx="456" cy="198" rx="50" ry="14" /><ellipse cx="594" cy="122" rx="34" ry="10" />
      </g>
      <path d={`M276 318C344 ${392 + unspool * 0.25} 514 ${284 - unspool * 0.2} 690 366`} fill="none" stroke={ink} strokeWidth="28" opacity=".72" />
      <path d={`M276 318C344 ${392 + unspool * 0.25} 514 ${284 - unspool * 0.2} 690 366`} fill="none" stroke={signal} strokeWidth="5" strokeDasharray="8 14" />
    </>
  );
}

function DigitalClock({ offset, fragmentation }: Omit<ResidueGlyphProps, "variant">) {
  const shift = offset * 0.2;
  const faded = 0.25 + fragmentation * 0.45;
  const digit = (x: number, hidden: number[]) => (
    <g transform={`translate(${x} 0)`} fill={signal}>
      {!hidden.includes(0) && <rect x="0" y="190" width="58" height="12" />}
      {!hidden.includes(1) && <rect x="52" y="198" width="12" height="58" />}
      {!hidden.includes(2) && <rect x="52" y="268" width="12" height="58" />}
      {!hidden.includes(3) && <rect x="0" y="324" width="58" height="12" />}
      {!hidden.includes(4) && <rect x="-6" y="268" width="12" height="58" />}
      {!hidden.includes(5) && <rect x="-6" y="198" width="12" height="58" />}
      {!hidden.includes(6) && <rect x="0" y="258" width="58" height="12" />}
    </g>
  );
  return (
    <>
      <path d="M128 150H660L700 208V386H92V208Z" fill={violet} opacity=".46" transform={`translate(${shift} ${-shift * 0.24})`} />
      <path d="M104 164H638L674 214V398H70V214Z" fill={rust} opacity=".84" style={{ mixBlendMode: "multiply" }} />
      <rect x="132" y="190" width="474" height="158" rx="10" fill={ink} opacity=".9" />
      {digit(192, [0, 3, 4])}
      {digit(286, [])}
      <g fill={signal}><circle cx="380" cy="238" r="9" /><circle cx="380" cy="300" r="9" /></g>
      {digit(420, [])}
      <g opacity={faded}>{digit(514, [1])}</g>
      <g fill={paper} opacity=".72">
        <rect x="204" y="126" width="72" height="24" /><rect x="302" y="126" width="72" height="24" /><rect x="400" y="126" width="72" height="24" />
      </g>
      <path d="M110 278H644" stroke={paper} strokeWidth="5" strokeDasharray="42 20" opacity=".34" />
    </>
  );
}

function Generic({ offset }: Omit<ResidueGlyphProps, "variant">) {
  return (
    <>
      <path d="M190 118L465 88 596 252 474 410 168 376 104 224Z" fill={rust} fillOpacity=".78" style={{ mixBlendMode: "multiply" }} />
      <path d={`M${190 + offset} 92L${504 + offset * 0.3} 140L${548 + offset * 0.2} 348L${238 + offset * 0.5} 420L${126 + offset} 238Z`} fill={violet} fillOpacity=".62" style={{ mixBlendMode: "multiply" }} />
    </>
  );
}

export function ResidueGlyph({ variant, offset, fragmentation }: ResidueGlyphProps) {
  const props = { offset, fragmentation };
  let glyph;

  switch (variant) {
    case "bus-tickets": glyph = <BusTickets {...props} />; break;
    case "keys": glyph = <Keys {...props} />; break;
    case "dictionary": glyph = <Dictionary {...props} />; break;
    case "audio-cassette": glyph = <AudioCassette {...props} />; break;
    case "floppy-disk": glyph = <FloppyDisk {...props} />; break;
    case "vhs-tape": glyph = <VhsTape {...props} />; break;
    case "pager": glyph = <Pager {...props} />; break;
    case "payphone": glyph = <Payphone {...props} />; break;
    case "slide-rule": glyph = <SlideRule {...props} />; break;
    case "rotary-phone": glyph = <RotaryPhone {...props} />; break;
    case "film-canisters": glyph = <FilmCanisters {...props} />; break;
    case "digital-clock": glyph = <DigitalClock {...props} />; break;
    default: glyph = <Generic {...props} />;
  }

  return <g data-glyph={variant}>{glyph}</g>;
}
