-- =========================================================
-- CARDBOL — RANKING AUTOMÁTICO PELO NÍVEL DO JOGADOR LOGADO
--
-- INICIANTE: 0–19 vitórias
-- NÍVEL 1:   20–49 vitórias
-- NÍVEL 2:   50–124 vitórias
-- NÍVEL 3:   125+ vitórias
--
-- Execute TODO este arquivo no SQL Editor do Supabase.
-- =========================================================

create or replace function public.cardbol_player_progress(
    p_player_id uuid,
    p_session_token text
)
returns table (
    success boolean,
    wins integer,
    level_key text,
    level_label text,
    next_level_wins integer
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
    v_player public.players%rowtype;
    v_level_key text;
    v_level_label text;
    v_next integer;
begin
    select *
      into v_player
      from public.players p
     where p.id = p_player_id
       and p.session_token_hash =
           encode(digest(p_session_token, 'sha256'), 'hex')
       and p.session_expires_at > now();

    if not found then
        return query
        select false, 0, 'rookie'::text, 'INICIANTE'::text, 20;
        return;
    end if;

    if v_player.wins >= 125 then
        v_level_key := 'level3';
        v_level_label := 'NÍVEL 3';
        v_next := null;
    elsif v_player.wins >= 50 then
        v_level_key := 'level2';
        v_level_label := 'NÍVEL 2';
        v_next := 125;
    elsif v_player.wins >= 20 then
        v_level_key := 'level1';
        v_level_label := 'NÍVEL 1';
        v_next := 50;
    else
        v_level_key := 'rookie';
        v_level_label := 'INICIANTE';
        v_next := 20;
    end if;

    return query
    select
        true,
        v_player.wins,
        v_level_key,
        v_level_label,
        v_next;
end;
$$;

grant execute
on function public.cardbol_player_progress(uuid, text)
to anon, authenticated;


create or replace function public.cardbol_my_level_ranking(
    p_player_id uuid,
    p_session_token text,
    p_limit integer default 100
)
returns table (
    ranking_position bigint,
    player_name text,
    ranking_points integer,
    ranking_wins integer,
    goals_scored integer
)
language sql
security definer
set search_path = public, extensions
as $$
    with me as (
        select
            p.id,
            p.wins
        from public.players p
        where p.id = p_player_id
          and p.session_token_hash =
              encode(digest(p_session_token, 'sha256'), 'hex')
          and p.session_expires_at > now()
        limit 1
    ),
    my_level as (
        select
            case
                when m.wins >= 125 then 125
                when m.wins >= 50 then 50
                when m.wins >= 20 then 20
                else 0
            end as min_wins,
            case
                when m.wins >= 125 then null::integer
                when m.wins >= 50 then 124
                when m.wins >= 20 then 49
                else 19
            end as max_wins
        from me m
    ),
    filtered as (
        select
            p.username,
            p.points,
            p.wins,
            p.goals_for,
            p.goal_difference
        from public.players p
        cross join my_level l
        where p.matches > 0
          and p.wins >= l.min_wins
          and (l.max_wins is null or p.wins <= l.max_wins)
    )
    select
        row_number() over (
            order by
                f.points desc,
                f.wins desc,
                f.goals_for desc,
                f.goal_difference desc,
                f.username asc
        ) as ranking_position,
        f.username as player_name,
        f.points as ranking_points,
        f.wins as ranking_wins,
        f.goals_for as goals_scored
    from filtered f
    order by
        f.points desc,
        f.wins desc,
        f.goals_for desc,
        f.goal_difference desc,
        f.username asc
    limit greatest(
        1,
        least(coalesce(p_limit, 100), 500)
    );
$$;

grant execute
on function public.cardbol_my_level_ranking(uuid, text, integer)
to anon, authenticated;

-- Força o PostgREST a atualizar o cache de funções.
notify pgrst, 'reload schema';
