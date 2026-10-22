'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

const RAR = ['LEGENDAIRE', 'ULTIME', 'MYTHIQUE', 'DIAMANT', 'EMERAUDE', 'PLATINE', 'GOLD', 'SILVER', 'BRONZE', 'IRON'];
const NEED = [2, 4, 8, 15, 30, 60, 100, 150, 250];
const COST = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 20000];
const PACKS = { bronze: { n: 'Bronze', price: 100, h: 1 }, silver: { n: 'Silver', price: 250, h: 2 }, gold: { n: 'Gold', price: 600, h: 3 }, elite: { n: 'Elite', price: 1500, h: 6 } };
const STEP = { IRON: 1000, BRONZE: 1500, SILVER: 2000, GOLD: 2500, PLATINE: 3000, EMERAUDE: 4500, DIAMANT: 5500, MYTHIQUE: 6500, ULTIME: 7500, LEGENDAIRE: 9000 };
const wild = (r) => RAR.indexOf(r) <= 4;
const eff = (v, lv) => Math.round(v * (1 + 0.05 * (lv - 1)));
const hm = (ms) => { const m = Math.max(0, Math.ceil(ms / 60000)); return `${String(Math.floor(m / 60)).padStart(2, '0')}h:${String(m % 60).padStart(2, '0')}m`; };

function horn(power = 1) {
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

function Card({ card, uc, locked, cls = '', onClick }) {
  if (locked) {
    return (
      <div className="lk" onClick={onClick}>
        <div className="fc locked" data-r={card.rarity}><div className="q">?</div></div>
        <div className="lkname">{card.name}</div>
      </div>
    );
  }
  const lv = uc?.level || 1;
  const s = (v) => eff(v, lv);
  const ovr = Math.round((s(card.atk) + s(card.def) + s(card.hp) + s(card.aura)) / 4);
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
      <div className="lvl">NIV {lv}</div>
    </div>
  );
}

function Rates({ kind, rates, onClose }) {
  const rows = [...rates].sort((a, b) => RAR.indexOf(a.rarity) - RAR.indexOf(b.rarity));
  return (
    <div className="md" onClick={onClose}>
      <div className="panel" onClick={(e) => e.stopPropagation()}>
        <h2>Pack {PACKS[kind].n} : taux de drop</h2>
        <table>
          <tbody>{rows.map((r) => (
            <tr key={r.rarity} data-r={r.rarity}><td className="rn">{r.rarity}</td><td>{String(r[kind]).replace('.', ',')} %</td></tr>
          ))}</tbody>
        </table>
        <p className="muted">8 cartes par pack. Tant qu'une rareté n'a aucune carte, les taux sont réajustés sur les autres.</p>
        <button onClick={onClose}>Fermer</button>
      </div>
    </div>
  );
}

function Opening({ res, onClose }) {
  const cards = [...res.cards].sort((a, b) => RAR.indexOf(b.card.rarity) - RAR.indexOf(a.card.rarity));
  const [i, setI] = useState(0);
  const done = i >= cards.length;
  const cur = cards[i];
  useEffect(() => {
    if (done) return;
    const r = cur.card.rarity;
    if (wild(r)) horn(RAR.indexOf(r) <= 1 ? 1.6 : 1);
    const t = setTimeout(() => setI((n) => n + 1), STEP[r]);
    return () => clearTimeout(t);
  }, [i]);
  if (!done) {
    const w = wild(cur.card.rarity);
    return (
      <div className={'ov' + (w ? ' wild' : '')} data-r={cur.card.rarity}>
        <div className="stage" key={i}>
          <Card card={cur.card} uc={{ level: 1 }} cls={'big ' + (w ? 'spin' : 'pop')} />
        </div>
        <div className="rl">{cur.card.rarity}{cur.is_new ? ' · NOUVEAU' : ''}</div>
        <div className="muted">{i + 1} / {cards.length}</div>
        <button className="ghost skip" onClick={() => setI(cards.length)}>Passer</button>
      </div>
    );
  }
  return (
    <div className="ov sum">
      <h2>Pack {PACKS[res.pack].n} ouvert</h2>
      <div className="cards sm">{cards.map((c, k) => <Card key={k} card={c.card} uc={{ level: 1 }} />)}</div>
      <p>+{res.xp} XP · +{res.coins} 🪙{res.bonus ? ` · BONUS : un pack ${PACKS[res.bonus].n} offert !` : ''}</p>
      {res.rewards?.length > 0 && <p>Niveau supérieur ! Pack offert : {res.rewards.map((p) => PACKS[p].n).join(', ')}</p>}
      <button onClick={onClose}>Terminer</button>
    </div>
  );
}

export default function Game({ session }) {
  const uid = session.user.id;
  const [profile, setProfile] = useState(null);
  const [cards, setCards] = useState([]);
  const [own, setOwn] = useState({});
  const [packs, setPacks] = useState([]);
  const [rates, setRates] = useState([]);
  const [tab, setTab] = useState('col');
  const [now, setNow] = useState(Date.now());
  const [res, setRes] = useState(null);
  const [info, setInfo] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await supabase.rpc('sync_packs');
    const [c, u, p, k, r] = await Promise.all([
      supabase.from('cards').select('*'),
      supabase.from('user_cards').select('card_id, stock, level'),
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('user_packs').select('*').order('id'),
      supabase.from('pack_rates').select('*'),
    ]);
    setCards((c.data || []).sort((a, b) => RAR.indexOf(a.rarity) - RAR.indexOf(b.rarity) || a.id - b.id));
    setOwn(Object.fromEntries((u.data || []).map((x) => [x.card_id, x])));
    setProfile(p.data); setPacks(k.data || []); setRates(r.data || []);
  }, [uid]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const call = async (fn, args) => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc(fn, args);
    if (error) setErr(error.message);
    await load(); setBusy(false);
    return error ? null : data;
  };
  const open = async (id) => { if (!busy) { const d = await call('open_pack', { pid: id }); if (d) setRes(d); } };

  if (!profile) return <main><p className="muted">Chargement…</p></main>;
  const need = 100 + 50 * (profile.level - 1);
  const owned = Object.keys(own).length;
  const sc = sel && cards.find((c) => c.id === sel);
  const su = sc && own[sc.id];

  return (
    <main className="game">
      <header className="top">
        <div className="who"><strong>{session.user.user_metadata?.full_name || profile.username || 'Joueur'}</strong>
          <span className="lv">Niv {profile.level}</span>
          <div className="xpbar" title={`${profile.xp} / ${need} XP`}><i style={{ width: `${(profile.xp / need) * 100}%` }} /></div></div>
        <div className="coins">🪙 {profile.coins}</div>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </header>

      <div className="slots">
        {[0, 1, 2, 3].map((n) => {
          const pk = packs[n];
          return pk ? (
            <div key={pk.id} className="slot full" data-p={pk.pack} onClick={() => open(pk.id)}>
              <span>PACK<br />{PACKS[pk.pack].n.toUpperCase()}</span>
              <span className="i" onClick={(e) => { e.stopPropagation(); setInfo(pk.pack); }}>i</span>
            </div>
          ) : <div key={n} className="slot" />;
        })}
      </div>
      {packs.length > 4 && <p className="muted">+{packs.length - 4} pack(s) en réserve</p>}
      <div className="timers">
        {Object.entries(PACKS).map(([k, v]) => (
          <span key={k}>Prochain pack {v.n} dans {packs.length >= 4 ? 'slots pleins' : hm(new Date(profile['t_' + k]).getTime() + v.h * 3600e3 - now)}</span>
        ))}
      </div>
      {err && <p className="error">{err}</p>}

      <div className="tabs">
        <button className={tab === 'col' ? 'on' : ''} onClick={() => setTab('col')}>Collection {owned}/{cards.length}</button>
        <button className={tab === 'shop' ? 'on' : ''} onClick={() => setTab('shop')}>Boutique</button>
      </div>

      {tab === 'col' ? (
        <div className="cards">
          {cards.map((c) => <Card key={c.id} card={c} uc={own[c.id]} locked={!own[c.id]} onClick={() => own[c.id] && setSel(c.id)} />)}
        </div>
      ) : (
        <div className="shop">
          {Object.entries(PACKS).reverse().map(([k, v]) => (
            <div key={k} className="slot full shopitem" data-p={k}>
              <span>PACK<br />{v.n.toUpperCase()}</span>
              <span className="i" onClick={() => setInfo(k)}>i</span>
              <button disabled={busy || profile.coins < v.price || packs.length >= 4} onClick={() => call('buy_pack', { kind: k })}>🪙 {v.price}</button>
            </div>
          ))}
        </div>
      )}

      {sc && su && (
        <div className="md" onClick={() => setSel(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <Card card={sc} uc={su} cls="big" />
            <p><strong>Niveau {su.level}{su.level < 10 ? ` - ${su.stock}/${NEED[su.level - 1]}` : ' (max)'}</strong></p>
            {su.level < 10 && (
              <button disabled={busy || su.stock < NEED[su.level - 1] || profile.coins < COST[su.level - 1]}
                onClick={async () => { await call('upgrade_card', { cid: sc.id }); }}>
                Améliorer (🪙 {COST[su.level - 1]})
              </button>
            )}
            <button className="ghost" onClick={() => setSel(null)}>Fermer</button>
          </div>
        </div>
      )}
      {info && <Rates kind={info} rates={rates} onClose={() => setInfo(null)} />}
      {res && <Opening res={res} onClose={() => setRes(null)} />}
    </main>
  );
}
