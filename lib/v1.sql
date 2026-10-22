-- ===== VERSION 1.0 : à coller en entier dans Supabase > SQL Editor > Run =====
-- (efface les anciennes cartes de test, les comptes sont conservés)
drop function if exists open_booster();
drop table if exists user_cards, user_packs, pack_rates, cards, rarities cascade;
alter table profiles drop column if exists last_booster;
alter table profiles
  add column if not exists coins int not null default 500,
  add column if not exists xp int not null default 0,
  add column if not exists level int not null default 1,
  add column if not exists packs_opened int not null default 0,
  add column if not exists t_bronze timestamptz not null default now(),
  add column if not exists t_silver timestamptz not null default now(),
  add column if not exists t_gold timestamptz not null default now(),
  add column if not exists t_elite timestamptz not null default now();

create table rarities (name text primary key, sort int not null);
insert into rarities values ('LEGENDAIRE',1),('ULTIME',2),('MYTHIQUE',3),('DIAMANT',4),('EMERAUDE',5),
  ('PLATINE',6),('GOLD',7),('SILVER',8),('BRONZE',9),('IRON',10);

create table pack_rates (rarity text primary key references rarities, bronze numeric, silver numeric, gold numeric, elite numeric);
insert into pack_rates values
 ('LEGENDAIRE',0.014,0.03,0.06,0.15),('ULTIME',0.14,0.3,0.5,1),('MYTHIQUE',0.28,0.6,1,2),
 ('DIAMANT',1.40,2.5,4,8),('EMERAUDE',2.80,5,7,14),('PLATINE',4.21,8,12,22),('GOLD',7.01,14,25,30),
 ('SILVER',14.02,24,30,22.85),('BRONZE',28.05,25.57,15.44,0),('IRON',42.07,20,5,0);

create table cards (
  id serial primary key, name text not null, rarity text not null references rarities,
  family text not null default 'UNK', atk int, def int, hp int, aura int, image_url text);
create table user_cards (
  user_id uuid references profiles on delete cascade, card_id int references cards on delete cascade,
  stock int not null default 1, level int not null default 1, primary key (user_id, card_id));
create table user_packs (
  id bigserial primary key, user_id uuid references profiles on delete cascade,
  pack text not null, created_at timestamptz not null default now());

alter table rarities enable row level security; alter table pack_rates enable row level security;
alter table cards enable row level security; alter table user_cards enable row level security;
alter table user_packs enable row level security;
create policy "r" on rarities for select to authenticated using (true);
create policy "pr" on pack_rates for select to authenticated using (true);
create policy "c" on cards for select to authenticated using (true);
create policy "uc" on user_cards for select to authenticated using (user_id = auth.uid());
create policy "up" on user_packs for select to authenticated using (user_id = auth.uid());

-- XP + niveaux (interne) : un niveau gagné = un pack offert
create function add_xp(uid uuid, amt int) returns text[]
language plpgsql security definer set search_path = public as $$
declare p profiles; got text[] := '{}'; pk text;
begin
  select * into p from profiles where id = uid for update;
  p.xp := p.xp + amt;
  while p.xp >= 100 + 50 * (p.level - 1) loop
    p.xp := p.xp - (100 + 50 * (p.level - 1));
    p.level := p.level + 1;
    pk := case when p.level % 25 = 0 then 'elite' when p.level % 10 = 0 then 'gold'
               when p.level % 5 = 0 then 'silver' else 'bronze' end;
    insert into user_packs (user_id, pack) values (uid, pk);
    got := got || pk;
  end loop;
  update profiles set xp = p.xp, level = p.level where id = uid;
  return got;
end $$;
revoke all on function add_xp(uuid, int) from public, anon, authenticated;

-- Packs gratuits : bronze 1h, silver 2h, gold 3h, elite 6h (max 4 packs stockés)
create function sync_packs() returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p profiles; kinds text[] := array['bronze','silver','gold','elite'];
  hrs int[] := array[1,2,3,6]; k text; iv interval; last timestamptz; n int; free int; give int;
begin
  if uid is null then return; end if;
  select * into p from profiles where id = uid for update;
  for i in 1..4 loop
    k := kinds[i]; iv := make_interval(hours => hrs[i]);
    last := case k when 'bronze' then p.t_bronze when 'silver' then p.t_silver when 'gold' then p.t_gold else p.t_elite end;
    n := floor(extract(epoch from (now() - last)) / extract(epoch from iv));
    if n > 0 then
      select greatest(0, 4 - count(*)) into free from user_packs where user_id = uid;
      give := least(n, free);
      insert into user_packs (user_id, pack) select uid, k from generate_series(1, give);
      last := case when give < n then now() else last + n * iv end;
      execute format('update profiles set t_%s = $1 where id = $2', k) using last, uid;
    end if;
  end loop;
end $$;

create function open_pack(pid bigint) returns json
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); pk text; ids int[] := '{}'; nw boolean[] := '{}'; total numeric; roll numeric;
  r text; cid int; ex boolean; bonus text; rew text[]; xpg int; cg int;
begin
  select pack into pk from user_packs where id = pid and user_id = uid for update;
  if pk is null then raise exception 'Pack introuvable'; end if;
  delete from user_packs where id = pid;
  create temp table w on commit drop as
    select pr.rarity, ra.sort, case pk when 'bronze' then pr.bronze when 'silver' then pr.silver
      when 'gold' then pr.gold else pr.elite end as w
    from pack_rates pr join rarities ra on ra.name = pr.rarity
    where exists (select 1 from cards c where c.rarity = pr.rarity);
  select coalesce(sum(w), 0) into total from w;
  for i in 1..8 loop
    roll := random() * total;
    select rarity into r from (select rarity, sum(w) over (order by sort) as cum from w where w > 0) t
      where cum >= roll order by cum limit 1;
    select id into cid from cards where rarity = r order by random() limit 1;
    select exists (select 1 from user_cards where user_id = uid and card_id = cid) into ex;
    insert into user_cards (user_id, card_id) values (uid, cid)
      on conflict (user_id, card_id) do update set stock = user_cards.stock + 1;
    ids := ids || cid; nw := nw || (not ex);
  end loop;
  drop table w;
  xpg := case pk when 'bronze' then 10 when 'silver' then 25 when 'gold' then 60 else 150 end;
  cg := case pk when 'bronze' then 5 when 'silver' then 15 when 'gold' then 40 else 100 end;
  update profiles set packs_opened = packs_opened + 1, coins = coins + cg where id = uid;
  if random() < 0.1 then
    bonus := case pk when 'bronze' then 'silver' when 'silver' then 'gold' else 'elite' end;
    insert into user_packs (user_id, pack) values (uid, bonus);
  end if;
  rew := add_xp(uid, xpg);
  return json_build_object('pack', pk, 'bonus', bonus, 'rewards', rew, 'xp', xpg, 'coins', cg,
    'cards', (select json_agg(json_build_object('card', row_to_json(c), 'is_new', u.nw) order by u.ord)
              from unnest(ids, nw) with ordinality as u(id, nw, ord) join cards c on c.id = u.id));
end $$;

create function buy_pack(kind text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); price int; n int;
begin
  price := case kind when 'bronze' then 100 when 'silver' then 250 when 'gold' then 600 when 'elite' then 1500 end;
  if price is null then raise exception 'Pack inconnu'; end if;
  select count(*) into n from user_packs where user_id = uid;
  if n >= 4 then raise exception 'Tes 4 slots sont pleins'; end if;
  update profiles set coins = coins - price where id = uid and coins >= price;
  if not found then raise exception 'Pas assez de pièces'; end if;
  insert into user_packs (user_id, pack) values (uid, kind);
end $$;

create function upgrade_card(cid int) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); uc user_cards;
  need int[] := array[2,4,8,15,30,60,100,150,250];
  cost int[] := array[50,100,250,500,1000,2500,5000,10000,20000];
begin
  select * into uc from user_cards where user_id = uid and card_id = cid for update;
  if not found then raise exception 'Carte non possédée'; end if;
  if uc.level >= 10 then raise exception 'Niveau max atteint'; end if;
  if uc.stock < need[uc.level] then raise exception 'Pas assez d''exemplaires'; end if;
  update profiles set coins = coins - cost[uc.level] where id = uid and coins >= cost[uc.level];
  if not found then raise exception 'Pas assez de pièces'; end if;
  update user_cards set stock = stock - need[uc.level] + 1, level = level + 1 where user_id = uid and card_id = cid;
  perform add_xp(uid, 10 * (uc.level + 1));
end $$;

revoke all on function sync_packs(), open_pack(bigint), buy_pack(text), upgrade_card(int) from public, anon;
grant execute on function sync_packs(), open_pack(bigint), buy_pack(text), upgrade_card(int) to authenticated;

-- ===== CARTES (famille UNK = à définir, raretés provisoires) =====
insert into cards (name, rarity, family) values
 ('Undertaker','LEGENDAIRE','UNK'),
 ('Donald Trump','ULTIME','Politique'),('Vladimir Poutine','ULTIME','Politique'),('Conor McGregor','ULTIME','UFC'),
 ('John Cena','MYTHIQUE','UNK'),('Walter White','MYTHIQUE','UNK'),('Ilia Topuria','MYTHIQUE','UFC'),
 ('Iron Man','DIAMANT','UNK'),('Dana White','DIAMANT','UFC'),('Triple H','DIAMANT','UNK'),('Jon Jones','DIAMANT','UFC'),
 ('50 Cent','EMERAUDE','Rap'),('Kanye West','EMERAUDE','Rap'),('Stephen Curry','EMERAUDE','Sportif'),('LeBron James','EMERAUDE','Sportif'),
 ('Ousmane Dembélé','PLATINE','Sportif'),('Lewis Hamilton','PLATINE','Sportif'),('Max Verstappen','PLATINE','Sportif'),
 ('Emmanuel Macron','PLATINE','Politique'),('Kylian Mbappé','PLATINE','Sportif'),('Faker','PLATINE','UNK'),
 ('Elon Musk','GOLD','UNK'),('Khabib Nurmagomedov','GOLD','UFC'),('Tryndamere','GOLD','UNK'),('Tahm Kench','GOLD','UNK'),('Kameto','GOLD','UNK'),
 ('Tun Tun Tun Sahur','SILVER','Taré'),('Oncle Hank','SILVER','Taré'),('Pote n°1','SILVER','Esport ile'),('Pote n°2','SILVER','Esport ile'),
 ('Un random','BRONZE','Déchet'),('Kev Adams','BRONZE','UNK'),('Mitroglou','BRONZE','Sportif'),
 ('Un transpalette','IRON','Déchet'),('Une télé','IRON','Déchet'),('Un volatile','IRON','Déchet'),('Un chien galeux','IRON','Déchet');

update cards c set
  atk = least(99, v.b + abs(hashtext(c.name || 'a')) % 10), def = least(99, v.b + abs(hashtext(c.name || 'd')) % 10),
  hp = least(99, v.b + abs(hashtext(c.name || 'h')) % 10), aura = least(99, v.b + abs(hashtext(c.name || 'u')) % 10)
from (values ('LEGENDAIRE',90),('ULTIME',86),('MYTHIQUE',80),('DIAMANT',74),('EMERAUDE',68),
  ('PLATINE',62),('GOLD',54),('SILVER',46),('BRONZE',36),('IRON',24)) as v(r, b) where c.rarity = v.r;
