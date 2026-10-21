'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import Decor from './decor';

const DiscordIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
    <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
  </svg>
);

const GmailIcon = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#4285F4" d="M1.636 21.002h3.819V11.73L0 7.638v11.728c0 .904.732 1.636 1.636 1.636z" />
    <path fill="#34A853" d="M18.545 21.002h3.819A1.636 1.636 0 0 0 24 19.366V7.638l-5.455 4.092z" />
    <path fill="#FBBC04" d="M18.545 4.638v7.092L24 7.638V5.457c0-2.023-2.309-3.178-3.927-1.964z" />
    <path fill="#EA4335" d="M5.455 11.73V4.638L12 9.548l6.545-4.91v7.092L12 16.64z" />
    <path fill="#C5221F" d="M0 5.457v2.181l5.455 4.092V4.638L3.927 3.493C2.309 2.28 0 3.434 0 5.457z" />
  </svg>
);

const COOLDOWN_H = 4;
const ORDER = ['ULTIME', 'GOAT', 'HIGH+', 'HIGH', 'MID+', 'MID', 'LOW', 'LOW-', 'WORST'];

function fmt(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return `${h}h ${String(m).padStart(2, '0')}m ${String(r).padStart(2, '0')}s`;
}

function Card({ card, qty, locked, index }) {
  if (locked) {
    return (
      <div className="card locked" data-r={card.rarity}>
        <div className="emoji">?</div>
        <div className="name">???</div>
        <div className="tag">{card.rarity}</div>
      </div>
    );
  }
  return (
    <div className="card" data-r={card.rarity} style={{ '--i': index || 0 }}>
      {qty > 1 && <span className="qty">x{qty}</span>}
      <div className="emoji">{card.emoji}</div>
      <div className="name">{card.name}</div>
      <div className="tag">{card.rarity}</div>
      <div className="stats">
        <span>ATK {card.atk}</span><span>DEF {card.def}</span><span>PV {card.hp}</span>
      </div>
      <p className="ability">{card.ability}</p>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState('');

  const discord = () =>
    supabase.auth.signInWithOAuth({ provider: 'discord', options: { redirectTo: window.location.origin } });

  const submit = async (mode) => {
    setMsg('');
    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });
    if (error) setMsg(error.message);
  };

  return (
    <main className="login">
      <Decor />
      <h1>TCG ESPORT ÎLE</h1>
      <p>Version 1.0 - Collectionne les plus grands tarés d'esport île</p>
      <span className="stamp">connectez-vous avec Discord 0 arnaque :)</span>
      <button className="discord ico" onClick={discord}><DiscordIcon />Se connecter avec Discord</button>
      <div className="sep">ou avec un email</div>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Mot de passe (6 caractères min.)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="row">
        <button className="ico" onClick={() => submit('login')}><GmailIcon />Se connecter</button>
        <button className="ghost ico" onClick={() => submit('signup')}><GmailIcon />Créer un compte</button>
      </div>
      {msg && <p className="error">{msg}</p>}
    </main>
  );
}

export default function Home() {
  const [session, setSession] = useState(undefined);
  const [profile, setProfile] = useState(null);
  const [cards, setCards] = useState([]);
  const [owned, setOwned] = useState({});
  const [pulled, setPulled] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    const [c, u, p] = await Promise.all([
      supabase.from('cards').select('*'),
      supabase.from('user_cards').select('card_id, quantity'),
      supabase.from('profiles').select('*').eq('id', uid).single(),
    ]);
    const sorted = (c.data || []).sort(
      (a, b) => ORDER.indexOf(a.rarity) - ORDER.indexOf(b.rarity) || a.id - b.id
    );
    setCards(sorted);
    setOwned(Object.fromEntries((u.data || []).map((r) => [r.card_id, r.quantity])));
    setProfile(p.data);
  }, [session]);

  useEffect(() => { load(); }, [load]);

  const openBooster = async () => {
    setBusy(true); setError(''); setPulled(null);
    const { data, error } = await supabase.rpc('open_booster');
    if (error) setError(error.message);
    else setPulled(data);
    await load();
    setBusy(false);
  };

  if (session === undefined) return <main className="login"><p>Chargement…</p></main>;
  if (!session) return <Login />;

  const next = profile?.last_booster ? new Date(profile.last_booster).getTime() + COOLDOWN_H * 3600e3 : 0;
  const left = next - now;
  const ready = left <= 0;
  const have = Object.keys(owned).length;

  return (
    <main>
      <Decor />
      <header>
        <div className="who">
          {profile?.avatar_url && <img src={profile.avatar_url} alt="" />}
          <strong>{profile?.username || 'Joueur'}</strong>
        </div>
        <button className="ghost" onClick={() => supabase.auth.signOut()}>Se déconnecter</button>
      </header>

      <section className="booster">
        <button disabled={!ready || busy} onClick={openBooster}>
          {busy ? 'Ouverture…' : ready ? 'Ouvrir un booster' : `Prochain booster dans ${fmt(left)}`}
        </button>
        {error && <p className="error">{error}</p>}
      </section>

      {pulled && (
        <section className="reveal">
          <h2>Tu as tiré</h2>
          <div className="grid">
            {pulled.map((c, i) => <Card key={i} card={c} index={i} />)}
          </div>
        </section>
      )}

      <section>
        <h2>Ma collection <small>{have} / {cards.length}</small></h2>
        <div className="grid">
          {cards.map((c) => (
            <Card key={c.id} card={c} qty={owned[c.id]} locked={!owned[c.id]} />
          ))}
        </div>
      </section>
    </main>
  );
}
