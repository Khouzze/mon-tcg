'use client';
import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { PACKS } from './ui';

export default function Achievements({ call, busy, onState }) {
  const [list, setList] = useState([]);
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    const { data } = await supabase.rpc('achievements_state');
    setList(data || []);
    onState?.((data || []).filter((a) => !a.claimed && a.value >= a.target).length);
  }, [onState]);
  useEffect(() => { load(); }, [load]);

  const claim = async (a) => {
    const r = await call('claim_achievement', { aid: a.id });
    if (r) {
      setMsg(`Succès « ${a.name} » récupéré : +${r.coins} 🪙, +${r.xp} XP${r.pack ? `, 1 pack ${PACKS[r.pack].n}` : ''}`);
      load();
    }
  };

  const done = list.filter((a) => a.claimed).length;
  const cats = [...new Set(list.map((a) => a.cat))];
  const pct = list.length ? Math.round((done / list.length) * 100) : 0;

  return (
    <div>
      <h2>Succès <small>{done} / {list.length} · {pct} %</small></h2>
      <div className="bar big"><i style={{ width: `${pct}%` }} /></div>
      {msg && <p className="ok">{msg}</p>}
      {cats.map((cat) => (
        <section key={cat} className="achcat">
          <h3>{cat}</h3>
          <div className="achgrid">
            {list.filter((a) => a.cat === cat).map((a) => {
              const ready = !a.claimed && a.value >= a.target;
              return (
                <div key={a.id} className={'ach' + (a.claimed ? ' done' : '') + (ready ? ' ready' : '')}>
                  <div className="achhead"><strong>{a.name}</strong>{a.claimed && <span>✔</span>}</div>
                  <div className="muted">{a.descr}</div>
                  <div className="bar"><i style={{ width: `${(a.value / a.target) * 100}%` }} /></div>
                  <div className="achfoot">
                    <span className="muted">{a.value.toLocaleString('fr-FR')} / {a.target.toLocaleString('fr-FR')}</span>
                    <span className="reward">🪙 {a.coins} · {a.xp} XP{a.pack ? ` · ${PACKS[a.pack].n}` : ''}</span>
                  </div>
                  {ready && <button disabled={busy} onClick={() => claim(a)}>Récupérer</button>}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
