'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Card } from './ui';

const TAUNTS = [
  "T'as sorti ça d'un booster Bronze ?",
  'Ton deck sent la défaite à trois kilomètres.',
  'Même un transpalette te battrait.',
  "Je vais t'écraser comme une télé tombée du balcon.",
  'Dis bonjour à ta défaite, elle t’attend.',
  "C'est ça ton deck ? Je croyais que c'était une blague.",
  "Tu joues ou tu fais de la figuration ?",
];
const REPLY = [
  'Hahaha, tu oses me parler ?',
  'Retiens ton souffle, ça va piquer.',
  'Mon t-shirt GLC a déjà gagné.',
  'Cause toujours, moi je joue.',
  'Tu parles beaucoup pour quelqu’un avec ce deck.',
  'Continue, ça me motive.',
];
const ROUND_WIN = ['Et une de plus pour GLC.', 'Trop facile.', 'Tu vois la différence ?', 'GLC en mode boss.'];
const ROUND_LOSE = ['Chance du débutant.', 'Rien d’inquiétant, c’était voulu.', 'Hum. Joue encore.', 'Je t’ai laissé celle-là.'];
const GLC_WIN = ['GLC > toi. Ça s’écrit tout seul.', 'Retourne ouvrir des packs Bronze.', 'Ez. Revanche quand tu veux.'];
const GLC_LOSE = ['C’était de la chance... Revanche. Maintenant.', 'Mon t-shirt est vexé.', 'Ok. Respect. Un peu. Rejoue.'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

function Glc({ mood }) {
  const mouth = mood === 'win' ? 'M48 54q12 12 24 0' : mood === 'sad' ? 'M50 60q10-9 20 0' : 'M50 56h20';
  return (
    <svg viewBox="0 0 120 150" className="glc" aria-label="GLC">
      <path d="M14 150c0-34 20-56 46-56s46 22 46 56z" fill="#f4f4f4" stroke="#222" strokeWidth="2.5" />
      <text x="60" y="130" textAnchor="middle" fontWeight="800" fontSize="22" fill="#111" fontFamily="Impact, sans-serif">GLC</text>
      <rect x="52" y="76" width="16" height="20" rx="4" fill="#e0ac69" />
      <circle cx="60" cy="48" r="28" fill="#f1c27d" stroke="#222" strokeWidth="2.5" />
      <path d="M32 44c-2-22 14-34 28-34s30 10 28 34c-6-10-14-14-28-14s-22 4-28 14z" fill="#2b1d14" />
      <circle cx="49" cy="48" r="3" fill="#111" /><circle cx="71" cy="48" r="3" fill="#111" />
      <path d={mood === 'sad' ? 'M43 40l12 4M77 40l-12 4' : 'M43 43l12-3M77 43l-12-3'} stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      <path d={mouth} stroke="#111" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </svg>
  );
}

export default function Battle({ uid, deckOk, onDone }) {
  const [list, setList] = useState([]);
  const [players, setPlayers] = useState([]);
  const [fam, setFam] = useState([]);
  const [bid, setBid] = useState(null);
  const [b, setB] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [say, setSay] = useState('Prêt à perdre ?');
  const [mood, setMood] = useState('smug');
  const lastStatus = useRef(null);

  const loadList = useCallback(async () => {
    const [l, p, f] = await Promise.all([
      supabase.rpc('my_battles'),
      supabase.from('profiles').select('id, username, level').neq('id', uid).order('username'),
      supabase.from('family_adv').select('*'),
    ]);
    setList(l.data || []); setPlayers(p.data || []); setFam(f.data || []);
  }, [uid]);

  const loadBattle = useCallback(async (id) => {
    const { data, error } = await supabase.rpc('get_battle', { bid: id });
    if (error) setErr(error.message); else setB(data);
  }, []);

  useEffect(() => {
    if (bid) return;
    loadList();
    const t = setInterval(loadList, 5000);
    return () => clearInterval(t);
  }, [bid, loadList]);

  useEffect(() => {
    if (!bid) return;
    loadBattle(bid);
    const t = setInterval(() => loadBattle(bid), 3000);
    return () => clearInterval(t);
  }, [bid, loadBattle]);

  // GLC réagit à la fin du combat
  useEffect(() => {
    if (!b) return;
    if (b.ai && b.status === 'finished' && lastStatus.current === 'active') {
      setSay(pick(b.won ? GLC_LOSE : GLC_WIN)); setMood(b.won ? 'sad' : 'win');
    }
    if (b.status === 'finished' && lastStatus.current === 'active') onDone?.();
    lastStatus.current = b.status;
  }, [b?.status]);

  const run = async (fn, args) => {
    setBusy(true); setErr('');
    const { data, error } = await supabase.rpc(fn, args);
    setBusy(false);
    if (error) { setErr(error.message); return null; }
    return data ?? true;
  };

  const vsAi = async () => {
    const id = await run('start_ai_battle');
    if (id) { lastStatus.current = 'active'; setSay('Prêt à perdre ?'); setMood('smug'); setB(null); setBid(id); }
  };
  const defy = async (opp) => {
    const id = await run('challenge', { opp });
    if (id) { setB(null); setBid(id); }
  };
  const answer = async (id, accept) => {
    const ok = await run('answer_challenge', { bid: id, accept });
    if (ok) { if (accept) { setB(null); setBid(id); } else loadList(); }
  };
  const play = async (cid) => {
    const r = await run('play_card', { bid, cid });
    if (!r || r === true) return;
    setB(r);
    if (r.ai && r.log?.length) {
      const last = r.log[r.log.length - 1];
      if (r.status === 'active') { setSay(pick(last.won ? ROUND_LOSE : ROUND_WIN)); setMood(last.won ? 'sad' : 'win'); }
    }
  };
  const taunt = () => { setSay(`« ${pick(TAUNTS)} »  →  ${pick(REPLY)}`); setMood('smug'); };
  const back = () => { setBid(null); setB(null); setErr(''); lastStatus.current = null; };

  /* ---------- Vue d'un combat ---------- */
  if (bid) {
    if (!b) return <p className="muted">Chargement du combat…{err && <span className="error"> {err}</span>}</p>;
    const myTurn = b.status === 'active' && b.my_cur == null && b.s_me < 3 && b.s_opp < 3;
    const waiting = b.status === 'active' && b.my_cur != null;
    return (
      <div className="arena">
        <button className="ghost" onClick={back}>← Retour aux combats</button>
        <h2 className="score">
          <span>Toi</span><b>{b.s_me}</b><i>–</i><b>{b.s_opp}</b><span>{b.opp_name}</span>
        </h2>
        <p className="muted center">BO5 · manche {Math.min(b.round, 5)} · premier à 3 manches</p>
        {err && <p className="error center">{err}</p>}

        {b.ai && (
          <div className="glcbox">
            <Glc mood={mood} />
            <div className="bubble">{say}</div>
            <button className="ghost" onClick={taunt}>Provoquer GLC</button>
          </div>
        )}

        {b.status === 'pending' && <p className="center">En attente que {b.opp_name} accepte ton défi…</p>}

        <h3>Deck de {b.opp_name}</h3>
        <div className="deckrow">
          {b.d_opp.map((c) => (
            <div key={c.id} className={b.used_opp.includes(c.id) ? 'used' : ''}><Card card={c} fixed cls="mini" /></div>
          ))}
          {b.d_opp.length === 0 && <p className="muted">Deck visible dès que le défi est accepté.</p>}
        </div>

        {b.log.length > 0 && (
          <ul className="roundlog">
            {b.log.map((l) => (
              <li key={l.round} className={l.won ? 'w' : 'l'}>
                <span>Manche {l.round}</span>
                <strong>{l.me.name} ({l.me.power})</strong> <em>vs</em> <strong>{l.opp.name} ({l.opp.power})</strong>
                <span>{l.won ? 'Gagnée' : 'Perdue'}</span>
              </li>
            ))}
          </ul>
        )}

        {b.status === 'finished' && (
          <div className={'banner ' + (b.won ? 'win' : 'lose')}>
            <h2>{b.won ? 'VICTOIRE' : 'DÉFAITE'}</h2>
            {b.reward?.capped
              ? <p>Limite de récompenses du jour atteinte (tu peux quand même jouer pour le fun).</p>
              : b.reward && <p>+{b.reward.coins} 🪙 · +{b.reward.xp} XP{b.reward.rewards?.length ? ' · niveau supérieur, pack offert !' : ''}</p>}
            {b.ai && <button onClick={vsAi} disabled={busy}>Revanche contre GLC</button>}
          </div>
        )}

        <h3>Ton deck {myTurn && <small>· choisis ta carte</small>}{waiting && <small>· en attente de {b.opp_name}…</small>}</h3>
        <div className="deckrow">
          {b.d_me.map((c) => {
            const used = b.used_me.includes(c.id);
            const can = myTurn && !used && !busy;
            return (
              <div key={c.id} className={(used ? 'used ' : '') + (can ? 'playable ' : '') + (b.my_cur === c.id ? 'chosen' : '')}>
                <Card card={c} fixed cls="mini" onClick={can ? () => play(c.id) : undefined} />
              </div>
            );
          })}
        </div>

        <details className="muted">
          <summary>Comment est décidée une manche ?</summary>
          <p>Puissance = moyenne des 4 stats (déjà augmentées par le niveau) + bonus de rareté, multipliée par l'avantage de famille et par un peu de hasard. Les cartes [Déchet] ont 8 % de chances de faire un coup énorme.</p>
          {fam.length > 0 && <p>Avantages de famille (+12 %) : {fam.map((f) => `${f.attacker} > ${f.defender}`).join(' · ')}</p>}
        </details>
      </div>
    );
  }

  /* ---------- Liste des combats ---------- */
  const incoming = list.filter((x) => x.incoming);
  const others = list.filter((x) => !x.incoming);
  return (
    <div>
      <h2>Combats</h2>
      {!deckOk && <p className="error">Compose d'abord ton deck de 5 cartes dans l'onglet Deck.</p>}
      {err && <p className="error">{err}</p>}

      <div className="glcbox start">
        <Glc mood="smug" />
        <div>
          <h3>Entraînement contre GLC</h3>
          <p className="muted">Son deck change chaque jour. 10 combats récompensés par jour, tu peux le provoquer pendant le match.</p>
          <button disabled={!deckOk || busy} onClick={vsAi}>Affronter GLC</button>
        </div>
      </div>

      {incoming.length > 0 && (
        <>
          <h3>Défis reçus</h3>
          {incoming.map((x) => (
            <div key={x.id} className="row2">
              <span><strong>{x.opp_name}</strong> te défie !</span>
              <button disabled={!deckOk || busy} onClick={() => answer(x.id, true)}>Accepter</button>
              <button className="ghost" disabled={busy} onClick={() => answer(x.id, false)}>Refuser</button>
            </div>
          ))}
        </>
      )}

      <h3>Défier un pote</h3>
      {players.length === 0 && <p className="muted">Personne d'autre n'est encore inscrit.</p>}
      <div className="players">
        {players.map((p) => (
          <div key={p.id} className="row2">
            <span><strong>{p.username || 'Joueur'}</strong> <span className="muted">niv {p.level}</span></span>
            <button className="ghost" disabled={!deckOk || busy} onClick={() => defy(p.id)}>Défier</button>
          </div>
        ))}
      </div>

      <h3>Mes combats</h3>
      {others.length === 0 && <p className="muted">Aucun combat pour le moment.</p>}
      {others.map((x) => (
        <div key={x.id} className="row2">
          <span>
            vs <strong>{x.opp_name}</strong> · {x.s_me}–{x.s_opp} ·{' '}
            {x.status === 'finished' ? (x.won ? 'Victoire' : 'Défaite') : x.status === 'pending' ? 'En attente d\'acceptation' : 'En cours'}
          </span>
          <button className="ghost" onClick={() => { lastStatus.current = x.status; setB(null); setBid(x.id); }}>Ouvrir</button>
        </div>
      ))}
    </div>
  );
}
