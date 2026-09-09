-- =========================================================
-- CARDBOL ONLINE - CORREÇÃO DE SINCRONIZAÇÃO
-- Cartas / movimento / reinício de gol / intervalo 2º tempo
-- Execute TODO este arquivo UMA VEZ no SQL Editor do Supabase.
-- =========================================================

-- ---------------------------------------------------------
-- 1. CAMPOS EXCLUSIVOS DA FORMAÇÃO DO INTERVALO
-- ---------------------------------------------------------
alter table public.online_rooms
    add column if not exists halftime_started_at timestamptz,
    add column if not exists halftime_host_formation jsonb,
    add column if not exists halftime_guest_formation jsonb,
    add column if not exists halftime_host_confirmed boolean not null default false,
    add column if not exists halftime_guest_confirmed boolean not null default false;


-- ---------------------------------------------------------
-- 2. INICIAR INTERVALO ONLINE
-- Idempotente: os dois navegadores podem chamar sem resetar
-- a formação já enviada pelo outro jogador.
-- ---------------------------------------------------------
create or replace function public.cardbol_online_begin_halftime(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text,
    halftime_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
begin
    v_code := upper(trim(p_room_code));

    select * into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query select false, 'INVALID_SESSION'::text, null::timestamptz;
        return;
    end if;

    select * into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status = 'playing'
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
    for update;

    if not found then
        return query select false, 'ROOM_NOT_PLAYING'::text, null::timestamptz;
        return;
    end if;

    -- Só a primeira chamada abre/zera o intervalo.
    if v_room.halftime_started_at is null then
        update public.online_rooms r
        set halftime_started_at = now(),
            halftime_host_formation = null,
            halftime_guest_formation = null,
            halftime_host_confirmed = false,
            halftime_guest_confirmed = false,
            updated_at = now()
        where r.id = v_room.id;
    end if;

    return query
    select true,
           'HALFTIME_STARTED'::text,
           r.halftime_started_at
    from public.online_rooms r
    where r.id = v_room.id;
end;
$$;


-- ---------------------------------------------------------
-- 3. CONSULTAR FORMAÇÕES DO INTERVALO
-- ---------------------------------------------------------
create or replace function public.cardbol_online_get_halftime(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text,
    caller_side text,
    host_formation jsonb,
    guest_formation jsonb,
    host_confirmed boolean,
    guest_confirmed boolean,
    halftime_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_code text;
begin
    v_code := upper(trim(p_room_code));

    select * into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text, null::text,
               null::jsonb, null::jsonb, false, false, null::timestamptz;
        return;
    end if;

    return query
    select true,
           'OK'::text,
           case
               when r.host_player_id = p_player_id then 'host'
               when r.guest_player_id = p_player_id then 'guest'
               else null
           end::text,
           r.halftime_host_formation,
           r.halftime_guest_formation,
           r.halftime_host_confirmed,
           r.halftime_guest_confirmed,
           r.halftime_started_at
    from public.online_rooms r
    where r.room_code = v_code
      and r.status = 'playing'
      and r.halftime_started_at is not null
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id);

    if not found then
        return query
        select false, 'HALFTIME_NOT_STARTED'::text, null::text,
               null::jsonb, null::jsonb, false, false, null::timestamptz;
    end if;
end;
$$;


-- ---------------------------------------------------------
-- 4. CONFIRMAR A FORMAÇÃO DO 2º TEMPO
-- Aceita titulares + reservas que já estejam em campo.
-- ---------------------------------------------------------
create or replace function public.cardbol_online_confirm_halftime(
    p_player_id uuid,
    p_session_token text,
    p_room_code text,
    p_formation jsonb
)
returns table (
    success boolean,
    status text,
    caller_side text,
    host_formation jsonb,
    guest_formation jsonb,
    host_confirmed boolean,
    guest_confirmed boolean,
    halftime_started_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
    v_side text;
    v_item jsonb;
    v_role text;
    v_row integer;
    v_col integer;
    v_allowed_rows integer[];
    v_seen_cells text[] := array[]::text[];
    v_cell text;
begin
    v_code := upper(trim(p_room_code));

    select * into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text, null::text,
               null::jsonb, null::jsonb, false, false, null::timestamptz;
        return;
    end if;

    select * into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status = 'playing'
      and r.halftime_started_at is not null
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
    for update;

    if not found then
        return query
        select false, 'HALFTIME_NOT_AVAILABLE'::text, null::text,
               null::jsonb, null::jsonb, false, false, null::timestamptz;
        return;
    end if;

    if p_formation is null
       or jsonb_typeof(p_formation) <> 'array'
       or jsonb_array_length(p_formation) < 1
       or jsonb_array_length(p_formation) > 10 then
        raise exception 'Formação do intervalo inválida';
    end if;

    v_side := case when v_room.host_player_id = p_player_id then 'host' else 'guest' end;

    for v_item in select * from jsonb_array_elements(p_formation)
    loop
        v_role := upper(coalesce(v_item->>'role',''));
        v_row := (v_item->>'row')::integer;
        v_col := (v_item->>'col')::integer;

        if v_role not in ('GO','ZG','LE','LD','ME','MD','ATK') then
            raise exception 'Posição inválida na formação do intervalo';
        end if;

        if v_row < 0 or v_row > 17 or v_col < 0 or v_col > 10 then
            raise exception 'Casa inválida na formação do intervalo';
        end if;

        v_cell := v_row::text || ':' || v_col::text;
        if array_position(v_seen_cells, v_cell) is not null then
            raise exception 'Duas peças não podem ocupar a mesma casa';
        end if;
        v_seen_cells := array_append(v_seen_cells, v_cell);

        if v_side = 'host' then
            v_allowed_rows := case
                when v_role = 'GO' then array[0,1,2]
                when v_role in ('ZG','LE','LD') then array[3,4]
                when v_role in ('ME','MD') then array[5,6]
                else array[7,8]
            end;
        else
            v_allowed_rows := case
                when v_role = 'GO' then array[17,16,15]
                when v_role in ('ZG','LE','LD') then array[14,13]
                when v_role in ('ME','MD') then array[12,11]
                else array[10,9]
            end;
        end if;

        if not (v_row = any(v_allowed_rows)) then
            raise exception 'Peça % fora da faixa permitida no intervalo', v_role;
        end if;
    end loop;

    if v_side = 'host' then
        update public.online_rooms r
        set halftime_host_formation = p_formation,
            halftime_host_confirmed = true,
            updated_at = now()
        where r.id = v_room.id;
    else
        update public.online_rooms r
        set halftime_guest_formation = p_formation,
            halftime_guest_confirmed = true,
            updated_at = now()
        where r.id = v_room.id;
    end if;

    return query
    select true,
           'HALFTIME_CONFIRMED'::text,
           v_side,
           r.halftime_host_formation,
           r.halftime_guest_formation,
           r.halftime_host_confirmed,
           r.halftime_guest_confirmed,
           r.halftime_started_at
    from public.online_rooms r
    where r.id = v_room.id;
end;
$$;


-- ---------------------------------------------------------
-- 5. FINALIZAR INTERVALO E LIBERAR O 2º TEMPO
-- Só o host consolida as duas formações em um snapshot único.
-- ---------------------------------------------------------
create or replace function public.cardbol_online_finish_halftime(
    p_player_id uuid,
    p_session_token text,
    p_room_code text,
    p_state jsonb
)
returns table (
    success boolean,
    status text,
    game_revision bigint,
    active_player smallint
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
    v_next_player smallint;
    v_revision bigint;
    v_active smallint;
begin
    v_code := upper(trim(p_room_code));

    select * into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query select false, 'INVALID_SESSION'::text, 0::bigint, null::smallint;
        return;
    end if;

    select * into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status = 'playing'
      and r.host_player_id = p_player_id
      and r.halftime_host_confirmed = true
      and r.halftime_guest_confirmed = true
    for update;

    if not found then
        return query select false, 'HALFTIME_NOT_READY'::text, 0::bigint, null::smallint;
        return;
    end if;

    if p_state is null or jsonb_typeof(p_state) <> 'object' then
        raise exception 'Estado do 2º tempo inválido';
    end if;

    v_next_player := (p_state->>'currentPlayer')::smallint;
    if v_next_player not in (0,1) then
        raise exception 'Jogador da saída do 2º tempo inválido';
    end if;

    update public.online_rooms r
    set game_state = p_state,
        game_revision = r.game_revision + 1,
        active_player = v_next_player,
        halftime_started_at = null,
        updated_at = now(),
        host_last_seen = now()
    where r.id = v_room.id
    returning r.game_revision, r.active_player
    into v_revision, v_active;

    return query select true, 'SECOND_HALF_STARTED'::text, v_revision, v_active;
end;
$$;


-- ---------------------------------------------------------
-- 6. REINICIAR IMEDIATAMENTE APÓS UM GOL
-- Qualquer um dos dois participantes pode apertar CONTINUAR.
-- A operação é idempotente.
-- ---------------------------------------------------------
create or replace function public.cardbol_online_resume_after_goal(
    p_player_id uuid,
    p_session_token text,
    p_room_code text
)
returns table (
    success boolean,
    status text,
    game_revision bigint,
    active_player smallint
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_code text;
    v_revision bigint;
    v_active smallint;
begin
    v_code := upper(trim(p_room_code));

    select * into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query select false, 'INVALID_SESSION'::text, 0::bigint, null::smallint;
        return;
    end if;

    select * into v_room
    from public.online_rooms r
    where r.room_code = v_code
      and r.status = 'playing'
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id)
    for update;

    if not found then
        return query select false, 'ROOM_NOT_PLAYING'::text, 0::bigint, null::smallint;
        return;
    end if;

    if v_room.game_state is null then
        return query select false, 'NO_GAME_STATE'::text, v_room.game_revision, v_room.active_player;
        return;
    end if;

    -- Se já foi retomado por outro dispositivo, apenas confirma o estado atual.
    if coalesce((v_room.game_state->>'goalPause')::boolean, false) = false then
        return query select true, 'ALREADY_RESUMED'::text, v_room.game_revision, v_room.active_player;
        return;
    end if;

    update public.online_rooms r
    set game_state = r.game_state || jsonb_build_object(
            'goalPause', false,
            'goalResumeAt', null,
            'diceValue', null,
            'diceRolled', false,
            'selectedPieceRef', null,
            'turnTimeRemainingMs', 45000,
            'matchClockRunning', true
        ),
        game_revision = r.game_revision + 1,
        updated_at = now()
    where r.id = v_room.id
    returning r.game_revision, r.active_player
    into v_revision, v_active;

    return query select true, 'RESUMED'::text, v_revision, v_active;
end;
$$;


-- ---------------------------------------------------------
-- 7. PERMISSÕES
-- ---------------------------------------------------------
grant execute
on function public.cardbol_online_begin_halftime(uuid, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_get_halftime(uuid, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_confirm_halftime(uuid, text, text, jsonb)
to anon, authenticated;

grant execute
on function public.cardbol_online_finish_halftime(uuid, text, text, jsonb)
to anon, authenticated;

grant execute
on function public.cardbol_online_resume_after_goal(uuid, text, text)
to anon, authenticated;
