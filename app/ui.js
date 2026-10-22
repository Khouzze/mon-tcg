'use client';

export const RAR = ['LEGENDAIRE', 'ULTIME', 'MYTHIQUE', 'DIAMANT', 'EMERAUDE', 'PLATINE', 'GOLD', 'SILVER', 'BRONZE', 'IRON'];
export const NEED = [2, 4, 8, 15, 30, 60, 100, 150, 250];
export const COST = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000];
export const PACKS = {
  bronze: { n: 'Bronze', price: 100, h: 1 },
  silver: { n: 'Silver', price: 250, h: 2 },
  gold: { n: 'Gold', price: 600, h: 3 },
  elite: { n: 'Elite', price: 1500, h: 6 },
};
export const STEP = { IRON: 1000, BRONZE: 1500, SILVER: 2000, GOLD: 2500, PLATINE: 3000, EMERAUDE: 4500, DIAMANT: 5500, MYTHIQUE: 6500, ULTIME: 7500, LEGENDAIRE: 9000 };
export const wild = (r) => RAR.indexOf(r) <= 4;
export const eff = (v, lv) => Math.round(v * (1 + 0.05 * (lv - 1)));
export const hm = (ms) => {
  const m = Math.max(0, Math.ceil(ms / 60000));
  return `${String(Math.floor(m / 60)).padStart(2, '0')}h:${String(m % 60).padStart(2, '0')}m`;
};
export const left = (iso) => {
  const ms = new Date(iso).getTime() - Date.now();
  const h = Math.max(0, Math.floor(ms / 3600e3));
  return h >= 24 ? `${Math.floor(h / 24)}j ${h % 24}h` : `${h}h ${String(Math.max(0, Math.floor((ms % 3600e3) / 60000))).padStart(2, '0')}m`;
};

// Klaxon synthétisé (aucun fichier audio à héberger)
export function horn(power = 1) {
  try {
    const ac = new (window.AudioContext || window.webkitAudioContext)();
    const blast = (t, d) => {
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.02);
      g.gain.setValueAtTime(0.3, t + d - 0.06); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      g.connect(ac.destination);
      [440, 554, 659].forEach((f, i) => {
        const o = ac.createOscillator(); o.type = i % 2 ? 'square' : 'sawtooth';
        o.frequency.setValueAtTime(f * 1.25, t); o.frequency.exponentialRampToValueAtTime(f, t + 0.1);
        o.detune.value = (i - 1) * 9; o.connect(g); o.start(t); o.stop(t + d);
      });
    };
    const t = ac.currentTime;
    blast(t, 0.35); blast(t + 0.42, 0.35); blast(t + 0.84, 0.9 * power);
    setTimeout(() => ac.close(), 3500);
  } catch (e) {}
}

/**
 * Carte style FUT.
 * - collection : <Card card={c} uc={{level, stock}} />  (stats calculées selon le niveau)
 * - combat     : <Card card={snap} fixed />            (stats déjà calculées par le serveur)
 */
export function Card({ card, uc, locked, fixed, cls = '', onClick }) {
  if (locked) {
    return (
      <div className="lk" onClick={onClick}>
        <div className="fc locked" data-r={card.rarity}><div className="q">?</div></div>
        <div className="lkname">{card.name}</div>
      </div>
    );
  }
  const lv = fixed ? card.level || 1 : uc?.level || 1;
  const s = (v) => (fixed ? v : eff(v, lv));
  const ovr = Math.round((s(card.atk) + s(card.def) + s(card.hp) + s(card.aura)) / 4);
  const prog = !fixed && uc?.stock != null ? (lv >= 10 ? 'NIV MAX' : `NIV ${lv} · ${uc.stock}/${NEED[lv - 1]}`) : `NIV ${lv}`;
  return (
    <div className={`fc ${cls}`} data-r={card.rarity} onClick={onClick}>
      <b className="ovr">{ovr}</b>
      <span className="fam">[{card.family}]</span>
      <div className="portrait">
        {card.image_url ? <img src={card.image_url} alt="" /> : (
          <svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="36" r="20" /><path d="M12 100c0-26 17-40 38-40s38 14 38 40z" /></svg>
        )}
      </div>
      <div className="fname">{card.name}</div>
      <div className="fstats">
        <span><b>{s(card.atk)}</b>ATK</span><span><b>{s(card.def)}</b>DEF</span>
        <span><b>{s(card.hp)}</b>HP</span><span><b>{s(card.aura)}</b>AURA</span>
      </div>
      <div className="lvl">{prog}</div>
    </div>
  );
}
