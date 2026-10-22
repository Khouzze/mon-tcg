'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card, RAR, NEED, COST, PACKS, STEP, wild, hm, horn } from './ui';
import Market from './market';
import Achievements from './achievements';
import Deck from './deck';
import Battle from './battle';

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
  const [deckIds, setDeckIds] = useState([]);
  const [claimable, setClaimable] = useState(0);
  const [fatal, setFatal] = useState('');
  const [tab, setTab] = useState('col');
  const [now, setNow] = useState(Date.now());
  const [res, setRes] = useState(null);
  const [info, setInfo] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    await supabase.rpc('sync_packs');
    await supabase.rpc('sync_market');
    const [c, u, p, k, r, d, a] = await Promise.all([
      supabase.from('cards').select('*'),
      supabase.from('user_cards').select('card_id, stock, level'),
      supabase.from('profiles').select('*').eq('id', uid).single(),
      supabase.from('user_packs').select('*').order('id'),
      supabase.from('pack_rates').select('*'),
      supabase.from('decks').select('card_ids').maybeSingle(),
      supabase.rpc('achievements_state'),
    ]);
    if (c.error || p.error || !p.data) {
      setFatal(c.error?.message || p.error?.message || 'Profil introuvable.'); return;
    }
    if (p.data.coins === undefined) { setFatal('La base de données n\'est pas à jour.'); return; }
    setFatal('');
    setCards((c.data || []).sort((x, y) => RAR.indexOf(x.rarity) - RAR.indexOf(y.rarity) || x.id - y.id));
    setOwn(Object.fromEntries((u.data || []).map((x) => [x.card_id, x])));
    setProfile(p.data); setPacks(k.data || []); setRates(r.data || []);
    setDeckIds(d.data?.card_ids || []);
    setClaimable(((a.data) || []).filter((x) => !x.claimed && x.value >= x.target).length);
  }, [uid]);

  useEffect(() => { load(); const t = setInterval(load, 30000); return () => clearInterval(t); }, [load]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);

  const call = async (fn, args) => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc(fn, args);
    if (error) setErr(error.message);
    await load(); setBusy(false);
    return error ? null : data ?? true;
  };
  const open = async (id) => { if (!busy) { const d = await call('open_pack', { pid: id }); if (d) setRes(d); } };

  if (fatal) {
    return (
      <main className="login">
        <h1>Oups</h1>
        <p className="error">{fatal}</p>
        <p className="muted">Dans Supabase, ouvre <strong>SQL Editor</strong> et lance <strong>v1.sql</strong>, puis <strong>v1b.sql</strong>. Ensuite rafraîchis cette page.</p>
        <button onClick={load}>Réessayer</button>{' '}
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Déconnexion</button>
      </main>
    );
  }
  if (!profile) return <main><p className="muted">Chargement…</p></main>;

  const need = 100 + 50 * (profile.level - 1);
  const owned = Object.keys(own).length;
  const sc = sel && cards.find((c) => c.id === sel);
  const su = sc && own[sc.id];
  const TABS = [['col', `Collection ${owned}/${cards.length}`], ['shop', 'Boutique'], ['deck', 'Deck'], ['battle', 'Combat'], ['hdv', 'HDV'], ['ach', 'Succès' + (claimable ? ` (${claimable})` : '')]];

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
      {packs.length > 4 && <p className="muted">+{packs.length - 4} pack(s) en réserve (ils passent dans un slot dès qu'il se libère)</p>}
      <div className="timers">
        {Object.entries(PACKS).map(([k, v]) => (
          <span key={k}>Prochain pack {v.n} dans {packs.length >= 4 ? 'slots pleins' : hm(new Date(profile['t_' + k]).getTime() + v.h * 3600e3 - now)}</span>
        ))}
      </div>
      {err && <p className="error">{err}</p>}

      <div className="tabs">
        {TABS.map(([k, label]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === 'col' && (
        <div className="cards">
          {cards.map((c) => <Card key={c.id} card={c} uc={own[c.id]} locked={!own[c.id]} onClick={() => own[c.id] && setSel(c.id)} />)}
        </div>
      )}

      {tab === 'shop' && (
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

      {tab === 'deck' && <Deck cards={cards} own={own} deckIds={deckIds} call={call} busy={busy} />}
      {tab === 'battle' && <Battle uid={uid} deckOk={deckIds.length === 5} onDone={load} />}
      {tab === 'hdv' && <Market uid={uid} cards={cards} own={own} profile={profile} call={call} busy={busy} />}
      {tab === 'ach' && <Achievements call={call} busy={busy} onState={setClaimable} />}

      {sc && su && (
        <div className="md" onClick={() => setSel(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <Card card={sc} uc={su} cls="big" />
            <p><strong>Niveau {su.level}{su.level < 10 ? ` - ${su.stock}/${NEED[su.level - 1]}` : ' (max)'}</strong></p>
            {su.level < 10 && (
              <button disabled={busy || su.stock < NEED[su.level - 1] || profile.coins < COST[su.level - 1]}
                onClick={() => call('upgrade_card', { cid: sc.id })}>
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
