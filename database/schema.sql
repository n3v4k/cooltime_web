-- 쿨타임 (CoolTime) Supabase 스키마
-- Supabase 대시보드 > SQL Editor 에서 실행하세요.
-- 이 파일은 신규 설치와 기존 DB 재실행 모두에 안전하도록 작성되어 있습니다.

create extension if not exists "pgcrypto";

-- 현장 (관리자가 생성, 4자리 코드로 작업자 참여)
create table if not exists sites (
  id uuid primary key default gen_random_uuid(),
  join_code text unique not null,
  name text,
  temp numeric,                              -- 기온(℃): 자동(OpenWeatherMap) 또는 관리자 수동 입력
  humidity numeric,                          -- 상대습도(%): 자동 또는 관리자 수동 입력
  feels_like_temp numeric,                   -- temp·humidity로 계산한 체감온도 (getSummerWindChill)
  tier text,                                 -- 정상|주의|경고|위험|매우위험
  temp_source text not null default 'auto',  -- 'auto' | 'manual'
  rest_policy text not null default '2h20m', -- 관리자가 선택하는 휴식 주기: '2h20m' | '1h15m'
  created_at timestamptz default now()
);

-- 작업자 (개인 모드에서 코드 입력 시 자동 생성/연결)
create table if not exists workers (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  name text not null,
  is_outdoor boolean default true,
  tier_entered_at timestamptz,
  rest_status text default 'working', -- 'working' | 'resting' | 'overdue' | 'off'
  rest_started_at timestamptz,
  updated_at timestamptz default now()
);

-- 이벤트 로그 (기록·CSV 추출용)
create table if not exists logs (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references sites(id) on delete cascade,
  worker_name text,
  timestamp timestamptz default now(),
  site_temp numeric,
  tier text,
  event_type text, -- 'WORK_START'|'WORK_END'|'REST_START'|'REST_END'|'OVERDUE'|'TIER_UP'|'ILLNESS_REPORTED'
  note text
);

-- ---------------------------------------------------------------------------
-- 기존 DB 마이그레이션: create table if not exists는 이미 있는 테이블에
-- 컬럼을 추가해주지 않으므로, 이 파일을 재실행해도 안전하게 반영되도록 둔다.
-- ---------------------------------------------------------------------------
alter table sites add column if not exists temp numeric;
alter table sites add column if not exists humidity numeric;
alter table sites add column if not exists temp_source text not null default 'auto';
alter table sites add column if not exists rest_policy text not null default '2h20m';

create index if not exists idx_workers_site_id on workers(site_id);
create index if not exists idx_logs_site_id_timestamp on logs(site_id, timestamp desc);

-- updated_at 자동 갱신
create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_workers_updated_at on workers;
create trigger trg_workers_updated_at
  before update on workers
  for each row execute function set_updated_at();

-- RLS: 계정 시스템이 없는 MVP이므로, 현장 코드를 아는 사람은
-- 클라이언트(anon key)로 자유롭게 읽고 쓸 수 있도록 최소한의 정책만 둔다.
alter table sites enable row level security;
alter table workers enable row level security;
alter table logs enable row level security;

drop policy if exists "sites_public_all" on sites;
create policy "sites_public_all" on sites for all
  using (true) with check (true);

drop policy if exists "workers_public_all" on workers;
create policy "workers_public_all" on workers for all
  using (true) with check (true);

drop policy if exists "logs_public_all" on logs;
create policy "logs_public_all" on logs for all
  using (true) with check (true);
