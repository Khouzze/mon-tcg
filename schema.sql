-- ============ TABLES ============
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  username text,
  avatar_url text,
  last_booster timestamptz
);

create table rarities (
  name text primary key,
  weight numeric not null,   -- chance de drop en % (somme = 100)
  sort int not null
);

create table cards (
  id serial primary key,
  name text not null,
  rarity text not null references rarities(name),
  emoji text not null default '🃏',
  atk int not null, def int not null, hp int not null,
  ability text not null default ''
);

create table user_cards (
  user_id uuid references profiles(id) on delete cascade,
  card_id int references cards(id) on delete cascade,
  quantity int not null default 1,
  primary key (user_id, card_id)
);

-- ============ SECURITE (RLS) ============
-- Personne ne peut modifier ses cartes depuis le navigateur : tout passe par open_booster().
alter table profiles enable row level security;
alter table rarities enable row level security;
alter table cards enable row level security;
alter table user_cards enable row level security;

create policy "profils visibles par les joueurs connectés" on profiles for select to authenticated using (true);
create policy "raretés visibles" on rarities for select to authenticated using (true);
create policy "cartes visibles" on cards for select to authenticated using (true);
create policy "chacun voit ses cartes" on user_cards for select to authenticated using (user_id = auth.uid());

-- ============ PROFIL AUTO A L'INSCRIPTION ============
create function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, username, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

-- ============ OUVERTURE DE BOOSTER (côté serveur) ============
create function open_booster() returns json
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
  p profiles;
  ids int[] := '{}';
  total numeric; roll numeric; chosen text; cid int;
  cooldown interval := interval '4 hours';  -- change ici le délai entre deux boosters
begin
  if uid is null then raise exception 'Non connecté'; end if;
  select * into p from profiles where id = uid for update;

  if p.last_booster is not null and p.last_booster > now() - cooldown then
    raise exception 'Prochain booster dans % min',
      ceil(extract(epoch from (p.last_booster + cooldown - now())) / 60);
  end if;

  for i in 1..5 loop
    select coalesce(sum(weight), 0) into total from rarities r
      where exists (select 1 from cards c where c.rarity = r.name);
    roll := random() * total;
    select name into chosen from (
      select r.name, sum(r.weight) over (order by r.sort) as cum from rarities r
      where exists (select 1 from cards c where c.rarity = r.name)
    ) t where cum >= roll order by cum limit 1;

    select id into cid from cards where rarity = chosen order by random() limit 1;
    ids := ids || cid;
    insert into user_cards (user_id, card_id) values (uid, cid)
      on conflict (user_id, card_id) do update set quantity = user_cards.quantity + 1;
  end loop;

  update profiles set last_booster = now() where id = uid;

  return (select json_agg(row_to_json(c) order by u.ord)
          from unnest(ids) with ordinality as u(id, ord) join cards c on c.id = u.id);
end $$;

revoke all on function open_booster() from public, anon;
grant execute on function open_booster() to authenticated;

-- ============ TAUX DE DROP ============
insert into rarities (name, weight, sort) values
  ('ULTIME', 0.5, 1), ('GOAT', 3, 2), ('HIGH+', 7, 3), ('HIGH', 12, 4), ('MID+', 17, 5),
  ('MID', 22.5, 6), ('LOW', 20, 7), ('LOW-', 11, 8), ('WORST', 7, 9);

-- ============ CARTES DE TEST ============
insert into cards (name, rarity, emoji, atk, def, hp, ability) values
  ('Donald Trump', 'ULTIME', '🇺🇸', 98, 85, 190, 'Fake news : annule la première attaque reçue.'),
  ('Conor McGregor', 'ULTIME', '🥊', 100, 70, 170, 'Un seul coup : 20 % de chance de KO instantané.'),
  ('Undertaker', 'ULTIME', '⚰️', 95, 95, 200, 'Revient à 1 PV une fois par combat.'),
  ('Vladimir Poutine', 'ULTIME', '🐻', 92, 90, 195, 'Judoka : renvoie 30 % des dégâts.'),
  ('John Cena', 'GOAT', '🙌', 85, 85, 140, 'Tu ne peux pas me voir : esquive la 1re attaque.'),
  ('Walter White', 'GOAT', '🧪', 90, 70, 125, 'Say my name : +20 ATK à chaque tour.'),
  ('Ilia Topuria', 'GOAT', '🇪🇸', 92, 78, 135, 'Main droite : dégâts doublés au tour 1.'),
  ('Iron Man', 'GOAT', '🤖', 88, 82, 140, 'Armure : ignore 15 de dégâts par coup.'),
  ('Dana White', 'GOAT', '🎤', 80, 75, 150, 'Promoteur : pioche une carte de plus.'),
  ('Triple H', 'GOAT', '🔨', 87, 80, 145, 'Pedigree : étourdit l''adversaire.'),
  ('50 Cent', 'GOAT', '💿', 84, 72, 130, 'Pluie de balles : 3 petites attaques.'),
  ('Jon Jones', 'GOAT', '🦴', 89, 85, 130, 'Allonge : attaque toujours en premier.'),
  ('Kanye West', 'GOAT', '🎹', 82, 60, 125, 'Imprévisible : stats aléatoires chaque tour.'),
  ('Stephen Curry', 'HIGH+', '🏀', 78, 55, 105, 'Trois points : 25 % de coup critique.'),
  ('LeBron James', 'HIGH+', '👑', 80, 78, 115, 'The King : +10 à tous les alliés.'),
  ('Ousmane Dembélé', 'HIGH+', '⚽', 76, 45, 100, 'Deux pieds : attaque deux fois.'),
  ('Lewis Hamilton', 'HIGH+', '🏎️', 77, 60, 105, 'Pole position : joue en premier.'),
  ('Max Verstappen', 'HIGH+', '🏁', 79, 62, 105, 'Pied au plancher : +15 de vitesse.'),
  ('Emmanuel Macron', 'HIGH+', '🥖', 70, 80, 110, 'Dissolution : annule une carte adverse.'),
  ('Kylian Mbappé', 'HIGH+', '⚡', 82, 55, 100, 'Sprint : ignore la défense.'),
  ('Faker', 'HIGH+', '🖱️', 80, 65, 100, 'Unkillable Demon King : survit une fois.'),
  ('Elon Musk', 'HIGH+', '🚀', 75, 60, 115, 'Tweet : change une stat adverse.'),
  ('Khabib Nurmagomedov', 'HIGH+', '🐺', 81, 82, 118, 'Clé de soumission : immobilise.'),
  ('Tryndamere', 'HIGH+', '🪓', 80, 50, 105, 'Rage éternelle : ne peut pas mourir un tour.'),
  ('Tahm Kench', 'HIGH', '🐸', 66, 72, 100, 'Avale un allié pour le protéger.'),
  ('Kameto', 'HIGH', '🎙️', 62, 60, 95, 'Hype : +10 ATK au tour suivant.'),
  ('Tun Tun Tun Sahur', 'MID+', '🥁', 58, 50, 85, 'Réveille l''adversaire : annule son sommeil.'),
  ('Oncle Hank', 'MID+', '🍺', 55, 55, 90, 'Bière fraîche : soigne 10 PV.'),
  ('Kev Adams', 'LOW-', '😂', 22, 20, 55, 'Blague : 50 % de rater son attaque.'),
  ('Mitroglou', 'LOW-', '🥅', 25, 22, 58, 'Rate un but tout fait.'),
  ('Pote n°1 (à renommer)', 'MID', '🧑', 48, 45, 80, 'À toi de me donner un pouvoir.'),
  ('Pote n°2 (à renommer)', 'MID', '🧑', 46, 48, 78, 'À toi de me donner un pouvoir.'),
  ('Un random', 'LOW', '🎲', 35, 32, 65, 'Apparaît sans prévenir.'),
  ('Un transpalette', 'WORST', '🛒', 8, 15, 40, 'Se déplace lentement.'),
  ('Une télé', 'WORST', '📺', 5, 10, 35, 'Diffuse du vide.'),
  ('Un volatile', 'WORST', '🐦', 12, 5, 30, 'Pioupiou : ne fait rien.'),
  ('Un chien galeux', 'WORST', '🐕', 10, 12, 38, 'Gratte-gratte : se blesse tout seul.');
