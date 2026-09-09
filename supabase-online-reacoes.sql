-- =========================================================
-- CARDBOL ONLINE — REAÇÕES/EMOJIS DOS JOGADORES
-- Execute SOMENTE este arquivo novo no SQL Editor do Supabase.
-- =========================================================

create table if not exists public.online_reactions (
    id bigserial primary key,
    room_id uuid not null
        references public.online_rooms(id)
        on delete cascade,
    player_id uuid not null
        references public.players(id)
        on delete cascade,
    player_side smallint not null
        check (player_side in (0,1)),
    emoji text not null
        check (emoji in ('😂','🤣','😜','😡','🤬','😤')),
    created_at timestamptz not null default now()
);

alter table public.online_reactions enable row level security;

revoke all on table public.online_reactions
from anon, authenticated;

create index if not exists online_reactions_room_id_id_idx
on public.online_reactions(room_id, id desc);


-- =========================================================
-- ENVIAR REAÇÃO
-- Qualquer um dos dois participantes pode reagir, mesmo fora da vez.
-- =========================================================

create or replace function public.cardbol_online_send_reaction(
    p_player_id uuid,
    p_session_token text,
    p_room_code text,
    p_emoji text
)
returns table (
    success boolean,
    status text,
    reaction_id bigint,
    player_side integer,
    emoji text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
    v_side integer;
    v_reaction public.online_reactions%rowtype;
begin
    if p_emoji not in ('😂','🤣','😜','😡','🤬','😤') then
        return query
        select false, 'INVALID_EMOJI'::text, null::bigint, null::integer, null::text, null::timestamptz;
        return;
    end if;

    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return query
        select false, 'INVALID_SESSION'::text, null::bigint, null::integer, null::text, null::timestamptz;
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = upper(trim(p_room_code))
      and r.status = 'playing'
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id);

    if not found then
        return query
        select false, 'ROOM_NOT_PLAYING'::text, null::bigint, null::integer, null::text, null::timestamptz;
        return;
    end if;

    v_side := case when v_room.host_player_id = p_player_id then 1 else 0 end;

    insert into public.online_reactions (
        room_id,
        player_id,
        player_side,
        emoji
    )
    values (
        v_room.id,
        p_player_id,
        v_side,
        p_emoji
    )
    returning * into v_reaction;

    return query
    select
        true,
        'SENT'::text,
        v_reaction.id,
        v_reaction.player_side::integer,
        v_reaction.emoji,
        v_reaction.created_at;
end;
$$;


-- =========================================================
-- BUSCAR REAÇÕES NOVAS DA SALA
-- Retorna só eventos recentes e posteriores ao último ID visto.
-- =========================================================

create or replace function public.cardbol_online_get_reactions(
    p_player_id uuid,
    p_session_token text,
    p_room_code text,
    p_after_id bigint default 0
)
returns table (
    reaction_id bigint,
    player_id uuid,
    player_side integer,
    emoji text,
    created_at timestamptz
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_room public.online_rooms%rowtype;
begin
    select *
    into v_player
    from public.players p
    where p.id = p_player_id
      and p.session_token_hash = encode(digest(p_session_token, 'sha256'), 'hex')
      and p.session_expires_at > now();

    if not found then
        return;
    end if;

    select *
    into v_room
    from public.online_rooms r
    where r.room_code = upper(trim(p_room_code))
      and r.status in ('playing','finished')
      and (r.host_player_id = p_player_id or r.guest_player_id = p_player_id);

    if not found then
        return;
    end if;

    return query
    select
        e.id,
        e.player_id,
        e.player_side::integer,
        e.emoji,
        e.created_at
    from public.online_reactions e
    where e.room_id = v_room.id
      and e.id > greatest(coalesce(p_after_id, 0), 0)
      and e.created_at > now() - interval '12 seconds'
    order by e.id asc
    limit 20;
end;
$$;


grant execute
on function public.cardbol_online_send_reaction(uuid, text, text, text)
to anon, authenticated;

grant execute
on function public.cardbol_online_get_reactions(uuid, text, text, bigint)
to anon, authenticated;
