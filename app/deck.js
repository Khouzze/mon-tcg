'use client';
import { useEffect, useState } from 'react';
import { Card } from './ui';

export default function Deck({ cards, own, deckIds, call, busy }) {
  const [sel, setSel] = useState(deckIds);
  const [saved, setSaved] = useState(false);
  useEffect(() => { setSel(deckIds); }, [deckIds.join(',')]);

  const ownedCards = cards.filter((c) => own[c.id]);
  const toggle = (id) => {
    setSaved(false);
    setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 5 ? [...s, id] : s));
  };
  const save = async () => {
    const ok = await call('save_deck', { ids: sel });
    if (ok !== null) setSaved(true);
  };

  return (
    <div>
      <h2>Mon deck <small>{sel.length} / 5</small></h2>
      <p className="muted">5 cartes pour les combats (BO5 : le premier à gagner 3 manches l'emporte). Chaque carte ne peut être jouée qu'une fois par combat, et tu ne perds jamais tes cartes.</p>
      <div className="deckrow">
        {[0, 1, 2, 3, 4].map((i) => {
          const c = cards.find((x) => x.id === sel[i]);
          return c ? <Card key={i} card={c} uc={own[c.id]} cls="mini" onClick={() => toggle(c.id)} /> : <div key={i} className="deckslot">{i + 1}</div>;
        })}
      </div>
      <button disabled={busy || sel.length !== 5} onClick={save}>Enregistrer le deck</button>
      {saved && <span className="ok"> Deck enregistré !</span>}
      <h3>Tes cartes</h3>
      <div className="cards">
        {ownedCards.map((c) => (
          <div key={c.id} className={sel.includes(c.id) ? 'picked' : ''}>
            <Card card={c} uc={own[c.id]} onClick={() => toggle(c.id)} />
          </div>
        ))}
      </div>
    </div>
  );
}
