import miguel from './miguel.png';

const FACES = [
  { top: '3%', left: '2%', w: 150, r: -10, o: 0.4 },
  { top: '56%', left: '1%', w: 110, r: 14, o: 0.28 },
  { top: '9%', right: '3%', w: 120, r: 9, o: 0.33 },
  { bottom: '2%', right: '5%', w: 170, r: -7, o: 0.4 },
  { top: '42%', right: '1%', w: 80, r: 20, o: 0.22 },
];
const CARDS = [
  { top: '24%', left: '8%', r: -14, s: 1 },
  { top: '72%', left: '15%', r: 10, s: 0.8 },
  { top: '30%', right: '11%', r: 12, s: 0.9 },
  { bottom: '16%', right: '2%', r: -9, s: 1.1 },
  { top: '2%', left: '46%', r: 6, s: 0.7 },
];
const ICONS = [
  <path key="a" d="M50 22 L56 40 L75 41 L60 52 L66 70 L50 60 L34 70 L40 52 L25 41 L44 40 Z" />,
  <path key="b" d="M26 66 L30 34 L42 50 L50 28 L58 50 L70 34 L74 66 Z M26 72 H74" />,
  <g key="c"><circle cx="50" cy="48" r="22" /><circle cx="42" cy="42" r="2" /><circle cx="58" cy="42" r="2" /><path d="M40 55 Q50 66 60 55" /></g>,
];

export default function Decor() {
  return (
    <div className="decor" aria-hidden="true">
      <svg width="0" height="0" style={{ position: 'absolute' }}>
        <filter id="pencil">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" seed="4" />
          <feDisplacementMap in="SourceGraphic" scale="4" />
        </filter>
      </svg>
      {FACES.map(({ w, r, o, ...pos }, i) => (
        <img key={i} src={miguel.src} alt="" className={i > 2 ? 'hide-m' : ''}
          style={{ ...pos, width: w, opacity: o, transform: `rotate(${r}deg)` }} />
      ))}
      {CARDS.map(({ r, s, ...pos }, i) => (
        <svg key={i} viewBox="0 0 100 140" className={'dcard' + (i > 2 ? ' hide-m' : '')}
          style={{ ...pos, transform: `rotate(${r}deg) scale(${s})` }}>
          <g filter="url(#pencil)" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="6" y="6" width="88" height="128" rx="9" />
            <rect x="14" y="14" width="72" height="80" rx="4" />
            {ICONS[i % 3]}
            <path d="M18 106 H82 M18 116 H62" />
          </g>
        </svg>
      ))}
    </div>
  );
}
