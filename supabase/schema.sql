-- 쌤몰래 Supabase 스키마 전체 (새 프로젝트에 이 파일 하나만 실행하면 똑같이 만들어짐)
-- 실행 위치: Supabase 대시보드 → SQL Editor → 붙여넣고 Run
-- 그다음 seed_layouts.sql 실행 (서킷 배치 데이터)
create extension if not exists pgcrypto with schema extensions;

-- ===== 표 =====
-- 계정: 아무도 직접 읽거나 쓸 수 없음(정책 없음). 아래 sm_* 함수로만 다룸
create table public.accounts(
  key text primary key,            -- 'n_' + 소문자 닉네임 UTF-8 hex
  nick text not null,
  pw text not null,                -- bcrypt
  email text,                      -- bcrypt(소문자 이메일)
  email_mask text,                 -- 화면 표시용 (예: st***@gmail.com)
  rec text,                        -- bcrypt(복구 코드)
  created timestamptz not null default now(),
  fails int not null default 0,
  locked_until timestamptz
);
create table public.sessions(
  token_hash text primary key,     -- sha256(토큰). 토큰 원문은 브라우저 localStorage에만
  key text not null references public.accounts(key) on update cascade on delete cascade,
  created timestamptz not null default now()
);
create index on public.sessions(key);
-- 공개 기록 (누구나 읽기, 쓰기는 함수로만)
create table public.laps(            -- 시간 기록: 서킷 5개 + 'react'(반응속도 ms)
  tid text not null,
  key text not null references public.accounts(key) on update cascade on delete cascade,
  nick text not null, ms int not null, data jsonb not null default '{}', at timestamptz not null default now(),
  primary key(tid,key)
);
create index on public.laps(tid,ms);
create table public.scores(          -- 점수 기록: 'blocks', 'g2048'
  gid text not null,
  key text not null references public.accounts(key) on update cascade on delete cascade,
  nick text not null, score int not null, data jsonb not null default '{}', at timestamptz not null default now(),
  primary key(gid,key)
);
create index on public.scores(gid,score desc);
create table public.profiles(        -- 프로필 사진 (JPEG data URL, 최대 200KB)
  key text primary key references public.accounts(key) on update cascade on delete cascade,
  nick text not null, img text, ratio text, at timestamptz not null default now()
);
create table public.plays(gid text primary key, n bigint not null default 0);   -- 홈 인기순 정렬용
create table public.layouts(tid text primary key, data jsonb not null, at timestamptz not null default now()); -- 서킷 배치

alter table public.accounts enable row level security;
alter table public.sessions enable row level security;
alter table public.laps enable row level security;
alter table public.scores enable row level security;
alter table public.profiles enable row level security;
alter table public.plays enable row level security;
alter table public.layouts enable row level security;
create policy "laps read" on public.laps for select to anon, authenticated using (true);
create policy "scores read" on public.scores for select to anon, authenticated using (true);
create policy "profiles read" on public.profiles for select to anon, authenticated using (true);
create policy "plays read" on public.plays for select to anon, authenticated using (true);
create policy "layouts read" on public.layouts for select to anon, authenticated using (true);

-- ===== 내부 도우미 (바깥에서 호출 불가) =====
create or replace function public._sm_key(p_nick text) returns text
language sql immutable set search_path = '' as $$
  select 'n_' || encode(convert_to(lower(normalize(p_nick, NFC)), 'UTF8'), 'hex')
$$;
create or replace function public._sm_valid_nick(p_nick text) returns boolean
language sql immutable set search_path = '' as $$
  select coalesce(p_nick, '') ~ '^[가-힣a-zA-Z0-9_]{2,12}$'
$$;
create or replace function public._sm_session(p_key text) returns text
language plpgsql security definer set search_path = '' as $$
declare t text;
begin
  t := encode(extensions.gen_random_bytes(24), 'hex');
  insert into public.sessions(token_hash, key) values (encode(extensions.digest(t, 'sha256'), 'hex'), p_key);
  return t;
end $$;
create or replace function public._sm_who(p_token text) returns text
language sql stable security definer set search_path = '' as $$
  select key from public.sessions where token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex')
$$;
-- 비밀번호 확인: 'ok' | 'bad' | 'locked' | 'none'. 10번 틀리면 1분 잠금. (오류를 던지지 않아야 실패 횟수가 저장됨)
create or replace function public._sm_check(p_key text, p_pw text) returns text
language plpgsql security definer set search_path = '' as $$
declare a public.accounts;
begin
  select * into a from public.accounts where key = p_key for update;
  if not found then return 'none'; end if;
  if a.locked_until is not null and a.locked_until > now() then return 'locked'; end if;
  if a.pw = extensions.crypt(coalesce(p_pw,''), a.pw) then
    update public.accounts set fails = 0, locked_until = null where key = p_key; return 'ok';
  end if;
  update public.accounts set
    fails = case when a.fails + 1 >= 10 then 0 else a.fails + 1 end,
    locked_until = case when a.fails + 1 >= 10 then now() + interval '1 minute' else null end
  where key = p_key;
  return 'bad';
end $$;

-- ===== 공개 함수 (브라우저가 /rest/v1/rpc/<이름> 으로 호출). 모두 {ok, err?, ...} JSON 반환 =====
create or replace function public.sm_signup(p_nick text, p_pw text) returns json
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  p_nick := btrim(p_nick);
  if not public._sm_valid_nick(p_nick) then return json_build_object('ok',false,'err','nick'); end if;
  if length(coalesce(p_pw,'')) < 4 or length(p_pw) > 64 then return json_build_object('ok',false,'err','pw'); end if;
  k := public._sm_key(p_nick);
  if exists(select 1 from public.accounts where key = k) then return json_build_object('ok',false,'err','taken'); end if;
  insert into public.accounts(key, nick, pw) values (k, p_nick, extensions.crypt(p_pw, extensions.gen_salt('bf', 8)));
  return json_build_object('ok',true,'key',k,'nick',p_nick,'token',public._sm_session(k));
end $$;

create or replace function public.sm_login(p_nick text, p_pw text) returns json
language plpgsql security definer set search_path = '' as $$
declare k text; r text; n text;
begin
  k := public._sm_key(btrim(coalesce(p_nick,'')));
  r := public._sm_check(k, p_pw);
  if r <> 'ok' then return json_build_object('ok',false,'err',r); end if;
  select nick into n from public.accounts where key = k;
  return json_build_object('ok',true,'key',k,'nick',n,'token',public._sm_session(k));
end $$;

create or replace function public.sm_logout(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.sessions where token_hash = encode(extensions.digest(coalesce(p_token,''), 'sha256'), 'hex')
$$;

create or replace function public.sm_me(p_token text) returns json
language plpgsql stable security definer set search_path = '' as $$
declare k text; a public.accounts;
begin
  k := public._sm_who(p_token);
  if k is null then return json_build_object('ok',false,'err','session'); end if;
  select * into a from public.accounts where key = k;
  return json_build_object('ok',true,'key',a.key,'nick',a.nick,'created',(extract(epoch from a.created)*1000)::bigint,
    'emailMask',a.email_mask,'hasEmail',a.email is not null);
end $$;

create or replace function public.sm_set_email(p_token text, p_email text, p_mask text, p_code text) returns json
language plpgsql security definer set search_path = '' as $$
declare k text;
begin
  k := public._sm_who(p_token);
  if k is null then return json_build_object('ok',false,'err','session'); end if;
  if coalesce(p_email,'') !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or length(coalesce(p_code,'')) < 6 then return json_build_object('ok',false,'err','input'); end if;
  update public.accounts set email = extensions.crypt(lower(btrim(p_email)), extensions.gen_salt('bf', 8)),
    email_mask = left(p_mask, 80), rec = extensions.crypt(upper(p_code), extensions.gen_salt('bf', 8)) where key = k;
  return json_build_object('ok',true);
end $$;

-- 로그인 상태에서 비밀번호 변경: 현재 비밀번호(p_old) 또는 인증한 이메일(p_email) 중 하나로 확인
create or replace function public.sm_change_pw(p_token text, p_old text, p_email text, p_new text) returns json
language plpgsql security definer set search_path = '' as $$
declare k text; a public.accounts; r text;
begin
  k := public._sm_who(p_token);
  if k is null then return json_build_object('ok',false,'err','session'); end if;
  if length(coalesce(p_new,'')) < 4 or length(p_new) > 64 then return json_build_object('ok',false,'err','pw'); end if;
  if p_email is not null then
    select * into a from public.accounts where key = k;
    if a.email is null then return json_build_object('ok',false,'err','noemail'); end if;
    if a.email <> extensions.crypt(lower(btrim(p_email)), a.email) then return json_build_object('ok',false,'err','email'); end if;
  else
    r := public._sm_check(k, p_old);
    if r <> 'ok' then return json_build_object('ok',false,'err',r); end if;
  end if;
  update public.accounts set pw = extensions.crypt(p_new, extensions.gen_salt('bf', 8)) where key = k;
  return json_build_object('ok',true);
end $$;

-- 비밀번호 찾기 (로그아웃 상태): 닉네임 + 이메일 + 복구 코드
create or replace function public.sm_recover(p_nick text, p_email text, p_code text, p_new text) returns json
language plpgsql security definer set search_path = '' as $$
declare k text; a public.accounts;
begin
  k := public._sm_key(btrim(coalesce(p_nick,'')));
  select * into a from public.accounts where key = k for update;
  if not found then return json_build_object('ok',false,'err','none'); end if;
  if a.email is null then return json_build_object('ok',false,'err','noemail'); end if;
  if a.locked_until is not null and a.locked_until > now() then return json_build_object('ok',false,'err','locked'); end if;
  if length(coalesce(p_new,'')) < 4 or length(p_new) > 64 then return json_build_object('ok',false,'err','pw'); end if;
  if a.email <> extensions.crypt(lower(btrim(coalesce(p_email,''))), a.email) or a.rec <> extensions.crypt(upper(coalesce(p_code,'')), a.rec) then
    update public.accounts set fails = case when a.fails + 1 >= 10 then 0 else a.fails + 1 end,
      locked_until = case when a.fails + 1 >= 10 then now() + interval '1 minute' else null end where key = k;
    return json_build_object('ok',false,'err','code');
  end if;
  update public.accounts set pw = extensions.crypt(p_new, extensions.gen_salt('bf', 8)), fails = 0, locked_until = null where key = k;
  delete from public.sessions where key = k;
  return json_build_object('ok',true,'key',k,'nick',a.nick,'token',public._sm_session(k));
end $$;

-- 닉네임 변경: 계정 키가 바뀌면 기록·사진·세션이 on update cascade로 함께 옮겨짐
create or replace function public.sm_rename(p_token text, p_pw text, p_nick text) returns json
language plpgsql security definer set search_path = '' as $$
declare k text; nk text; r text;
begin
  k := public._sm_who(p_token);
  if k is null then return json_build_object('ok',false,'err','session'); end if;
  p_nick := btrim(p_nick);
  if not public._sm_valid_nick(p_nick) then return json_build_object('ok',false,'err','nick'); end if;
  r := public._sm_check(k, p_pw);
  if r <> 'ok' then return json_build_object('ok',false,'err',r); end if;
  nk := public._sm_key(p_nick);
  if nk <> k and exists(select 1 from public.accounts where key = nk) then return json_build_object('ok',false,'err','taken'); end if;
  update public.accounts set key = nk, nick = p_nick where key = k;
  update public.laps set nick = p_nick where key = nk;
  update public.scores set nick = p_nick where key = nk;
  update public.profiles set nick = p_nick where key = nk;
  return json_build_object('ok',true,'key',nk,'nick',p_nick);
end $$;

-- 기록 저장 (더 좋은 기록만 남김). 새 서킷/게임을 추가하면 아래 목록에 id를 추가할 것
create or replace function public.sm_submit_lap(p_token text, p_tid text, p_ms int, p_data jsonb) returns json
language plpgsql security definer set search_path = '' as $$
declare k text; n text; cur int;
begin
  k := public._sm_who(p_token);
  if k is null then return json_build_object('ok',false,'err','session'); end if;
  if p_tid not in ('suzuka','yeongam','yas','spa','monaco','react') then return json_build_object('ok',false,'err','tid'); end if;
  if p_ms is null or p_ms < (case when p_tid='react' then 100 else 15000 end) or p_ms > 3600000 then return json_build_object('ok',false,'err','ms'); end if;
  if length(coalesce(p_data::text,'')) > 4000 then return json_build_object('ok',false,'err','data'); end if;
  select nick into n from public.accounts where key = k;
  select ms into cur from public.laps where tid = p_tid and key = k;
  if cur is not null and cur <= p_ms then return json_build_object('ok',true,'saved',false,'best',cur); end if;
  insert into public.laps(tid,key,nick,ms,data,at) values (p_tid,k,n,p_ms,coalesce(p_data,'{}'),now())
    on conflict (tid,key) do update set nick=excluded.nick, ms=excluded.ms, data=excluded.data, at=now();
  return json_build_object('ok',true,'saved',true,'best',p_ms);
end $$;

create or replace function public.sm_submit_score(p_token text, p_gid text, p_score int, p_data jsonb) returns json
language plpgsql security definer set search_path = '' as $$
declare k text; n text; cur int;
begin
  k := public._sm_who(p_token);
  if k is null then return json_build_object('ok',false,'err','session'); end if;
  if p_gid not in ('blocks','g2048') then return json_build_object('ok',false,'err','gid'); end if;
  if p_score is null or p_score <= 0 or p_score > 100000000 then return json_build_object('ok',false,'err','score'); end if;
  if length(coalesce(p_data::text,'')) > 4000 then return json_build_object('ok',false,'err','data'); end if;
  select nick into n from public.accounts where key = k;
  select score into cur from public.scores where gid = p_gid and key = k;
  if cur is not null and cur >= p_score then return json_build_object('ok',true,'saved',false,'best',cur); end if;
  insert into public.scores(gid,key,nick,score,data,at) values (p_gid,k,n,p_score,coalesce(p_data,'{}'),now())
    on conflict (gid,key) do update set nick=excluded.nick, score=excluded.score, data=excluded.data, at=now();
  return json_build_object('ok',true,'saved',true,'best',p_score);
end $$;

create or replace function public.sm_set_profile(p_token text, p_img text, p_ratio text) returns json
language plpgsql security definer set search_path = '' as $$
declare k text; n text;
begin
  k := public._sm_who(p_token);
  if k is null then return json_build_object('ok',false,'err','session'); end if;
  if p_img is null then delete from public.profiles where key = k; return json_build_object('ok',true); end if;
  if p_img !~ '^data:image/(jpeg|png|webp);base64,' or length(p_img) > 200000 then return json_build_object('ok',false,'err','img'); end if;
  if coalesce(p_ratio,'') !~ '^[0-9]{1,2}/[0-9]{1,2}$' then p_ratio := '1/1'; end if;
  select nick into n from public.accounts where key = k;
  insert into public.profiles(key,nick,img,ratio,at) values (k,n,p_img,p_ratio,now())
    on conflict (key) do update set nick=excluded.nick, img=excluded.img, ratio=excluded.ratio, at=now();
  return json_build_object('ok',true);
end $$;

create or replace function public.sm_add_play(p_gid text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_gid not in ('racer','blocks','g2048','react') then return; end if;
  insert into public.plays(gid,n) values (p_gid,1) on conflict (gid) do update set n = public.plays.n + 1;
end $$;

-- ===== 권한 =====
revoke execute on function public._sm_key(text), public._sm_session(text), public._sm_who(text), public._sm_check(text,text), public._sm_valid_nick(text) from public, anon, authenticated;
grant execute on function public.sm_signup(text,text), public.sm_login(text,text), public.sm_logout(text), public.sm_me(text),
  public.sm_set_email(text,text,text,text), public.sm_change_pw(text,text,text,text), public.sm_recover(text,text,text,text),
  public.sm_rename(text,text,text), public.sm_submit_lap(text,text,int,jsonb), public.sm_submit_score(text,text,int,jsonb),
  public.sm_set_profile(text,text,text), public.sm_add_play(text) to anon, authenticated;
