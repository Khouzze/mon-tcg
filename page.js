'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

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
      <h1>Mon TCG</h1>
      <p>Ouvre des boosters, complète ta collection, écrase tes potes.</p>
      <button className="discord" onClick={discord}>Se connecter avec Discord</button>
      <div className="sep">ou avec un email</div>
      <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
      <input type="password" placeholder="Mot de passe (6 caractères min.)" value={password} onChange={(e) => setPassword(e.target.value)} />
      <div className="row">
        <button onClick={() => submit('login')}>Se connecter</button>
        <button className="ghost" onClick={() => submit('signup')}>Créer un compte</button>
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
