'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { Card, RAR, left } from './ui';

export default function Market({ uid, cards, own, profile, call, busy }) {
  const [view, setView] = useState('buy');
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState('');
  const [rf, setRf] = useState('');
  const [sell, setSell] = useState(null);
  const [price, setPrice] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('market')
      .select('id, price, level, expires_at, seller, card_id, cards(*), profiles(username)')
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .order('id', { ascending: false });
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load, profile]);

  const mine = rows.filter((r) => r.seller === uid);
  const shown = rows.filter((r) => r.seller !== uid)
    .filter((r) => r.cards.name.toLowerCase().includes(q.toLowerCase()) && (!rf || r.cards.rarity === rf));
  const ownedCards = cards.filter((c) => own[c.id]);

  const submitSell = async () => {
    const amount = parseInt(price, 10);
    if (!amount || amount < 1) return;
    const ok = await call('list_card', { cid: sell.id, amount });
    if (ok !== null) { setSell(null); setPrice(''); setView('mine'); }
  };

  return (
    <div>
      <div className="subtabs">
        <button className={view === 'buy' ? 'on' : ''} onClick={() => setView('buy')}>Acheter ({rows.length - mine.length})</button>
        <button className={view === 'sell' ? 'on' : ''} onClick={() => setView('sell')}>Vendre</button>
        <button className={view === 'mine' ? 'on' : ''} onClick={() => setView('mine')}>Mes annonces ({mine.length}/10)</button>
      </div>
      <p className="muted">Les annonces durent 3 jours, puis la carte revient dans ta collection. Taxe de 5 % sur chaque vente.</p>

      {view === 'buy' && (
        <>
          <div className="filters">
            <input placeholder="Rechercher une carte" value={q} onChange={(e) => setQ(e.target.value)} />
            <select value={rf} onChange={(e) => setRf(e.target.value)}>
              <option value="">Toutes les raretés</option>
              {RAR.map((r) => <option key={r}>{r}</option>)}
            </select>
          </div>
          {shown.length === 0 && <p className="muted">Aucune annonce pour le moment.</p>}
          <div className="cards">
            {shown.map((r) => (
              <div key={r.id} className="listing">
                <Card card={r.cards} uc={{ level: r.level }} />
                <div className="lmeta">par {r.profiles?.username || '?'} · {left(r.expires_at)}</div>
                <button disabled={busy || profile.coins < r.price}
                  onClick={async () => { await call('buy_listing', { lid: r.id }); load(); }}>
                  Acheter 🪙 {r.price}
                </button>
              </div>
            ))}
          </div>
        </>
      )}

      {view === 'sell' && (
        <div className="cards">
          {ownedCards.map((c) => (
            <div key={c.id} className="listing">
              <Card card={c} uc={own[c.id]} onClick={() => setSell(c)} />
              <button className="ghost" onClick={() => setSell(c)}>Vendre</button>
            </div>
          ))}
        </div>
      )}

      {view === 'mine' && (
        <>
          {mine.length === 0 && <p className="muted">Tu n'as aucune annonce en cours.</p>}
          <div className="cards">
            {mine.map((r) => (
              <div key={r.id} className="listing">
                <Card card={r.cards} uc={{ level: r.level }} />
                <div className="lmeta">🪙 {r.price} · expire dans {left(r.expires_at)}</div>
                <button className="ghost" disabled={busy}
                  onClick={async () => { await call('cancel_listing', { lid: r.id }); load(); }}>Retirer</button>
              </div>
            ))}
          </div>
        </>
      )}

      {sell && (
        <div className="md" onClick={() => setSell(null)}>
          <div className="panel" onClick={(e) => e.stopPropagation()}>
            <Card card={sell} uc={own[sell.id]} cls="big" />
            <p className="muted">
              {own[sell.id].stock > 1 ? 'Tu vends un exemplaire en double (niveau 1).' : 'C\'est ton dernier exemplaire : il part avec son niveau.'}
            </p>
            <input type="number" min="1" placeholder="Prix en pièces" value={price} onChange={(e) => setPrice(e.target.value)} />
            {price > 0 && <p className="muted">Tu recevras {Math.floor(price * 0.95)} 🪙 après taxe.</p>}
            <button disabled={busy || !(price > 0)} onClick={submitSell}>Mettre en vente</button>
            <button className="ghost" onClick={() => setSell(null)}>Annuler</button>
          </div>
        </div>
      )}
    </div>
  );
}
