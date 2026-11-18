import { useState } from 'react';
import {
  cardAt,
  spreadCount,
  SPREADS,
  SPREAD_BY_KEY,
  THREE_CARD_SETS,
  type TarotEvent,
  type TarotState,
} from '@tarot/engine';
import Card3D from './Card3D';
import CardGrid from './CardGrid';
import SpreadView from './SpreadView';
import SpreadMini from './SpreadMini';
import StatusBanner from './StatusBanner';
import PickFlash from './PickFlash';

export type BoardRole = 'solo' | 'counselor' | 'member';

export interface TarotBoardProps {
  state: TarotState;
  send: (ev: TarotEvent) => void;
  role?: BoardRole;
  revealOnPick?: boolean; // 솔로: 뽑는 즉시 뒤집힘
}

function makeSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

// 상담사 전용 — 공개된 카드의 상세 의미 패널(전화 풀이 보조)
function CounselorMeaningPanel({ state, spread, threeLabels }: {
  state: TarotState;
  spread: import('@tarot/engine').Spread;
  threeLabels?: [string, string, string];
}) {
  const revealed = state.picks.filter((p) => p.revealed);
  if (!revealed.length || !spread) return null;
  return (
    <div className="flex flex-col gap-3">
      {revealed.map((p) => {
        const { card, reversed } = cardAt(state.deckOrder, state.reversed, p.deckPos);
        if (!card) return null;
        const meaning = reversed ? card.reversed : card.upright;
        const posName = threeLabels?.[p.slot] ?? spread.positions[p.slot]?.nameKo ?? '';
        const hint = spread.positions[p.slot]?.hint ?? '';
        return (
          <div key={p.slot} className="rounded-2xl bg-white shadow-sm ring-1 ring-gray-100 overflow-hidden">
            {/* 카드 헤더 */}
            <div className="flex items-start gap-3 p-3.5">
              <div className="w-14 shrink-0">
                <Card3D card={card} reversed={reversed} revealed />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[12px] font-semibold text-accent-500 bg-accent-50 px-2 py-0.5 rounded-full">{posName}</span>
                  {reversed && <span className="text-[12px] font-semibold text-accent-400 bg-accent-50 px-2 py-0.5 rounded-full">역방향</span>}
                  {card.element && <span className="text-[12px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">{card.element}</span>}
                </div>
                <p className="mt-1 text-[19px] font-bold text-gray-900">{card.nameKo}</p>
                <p className="text-[12px] text-gray-400">{card.nameEn}</p>
                {hint && <p className="mt-1 text-[13px] text-blue-500 italic">📍 "{hint}"</p>}
              </div>
            </div>

            {/* 키워드 */}
            <div className="flex flex-wrap gap-1.5 px-3.5 pb-2.5">
              {meaning.keywords.map((k) => (
                <span key={k} className="rounded-full bg-accent-50 px-3 py-1 text-[14px] font-medium text-accent-600">{k}</span>
              ))}
            </div>

            {/* 상세 설명 — 상담사가 곁눈질로 편히 읽도록 크게 */}
            {meaning.detail && (
              <div className="mx-3.5 mb-2.5 rounded-xl bg-gray-50 px-3.5 py-3">
                <p className="text-[13px] font-semibold text-gray-500 mb-1">📖 카드 설명</p>
                <p className="text-[16px] leading-relaxed text-gray-800">{meaning.detail}</p>
              </div>
            )}

            {/* 분야별 의미 */}
            {meaning.domains && (
              <div className="mx-3.5 mb-2.5">
                <p className="text-[13px] font-semibold text-gray-500 mb-2">분야별 의미</p>
                <div className="grid grid-cols-2 gap-2">
                  {meaning.domains.love && (
                    <div className="rounded-xl bg-pink-50 p-2.5">
                      <p className="text-[12px] font-bold text-pink-500 mb-1">❤️ 연애·관계</p>
                      <p className="text-[14px] leading-snug text-gray-800">{meaning.domains.love}</p>
                    </div>
                  )}
                  {meaning.domains.work && (
                    <div className="rounded-xl bg-blue-50 p-2.5">
                      <p className="text-[12px] font-bold text-blue-500 mb-1">💼 직업·목표</p>
                      <p className="text-[14px] leading-snug text-gray-800">{meaning.domains.work}</p>
                    </div>
                  )}
                  {meaning.domains.money && (
                    <div className="rounded-xl bg-green-50 p-2.5">
                      <p className="text-[12px] font-bold text-green-600 mb-1">💰 금전·재정</p>
                      <p className="text-[14px] leading-snug text-gray-800">{meaning.domains.money}</p>
                    </div>
                  )}
                  {meaning.domains.health && (
                    <div className="rounded-xl bg-orange-50 p-2.5">
                      <p className="text-[12px] font-bold text-orange-500 mb-1">🏥 건강·에너지</p>
                      <p className="text-[14px] leading-snug text-gray-800">{meaning.domains.health}</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 상담 질문 — 상담사가 그대로 읽어주는 문장이라 크게 */}
            {meaning.questions && meaning.questions.length > 0 && (
              <div className="mx-3.5 mb-3.5 rounded-xl bg-amber-50 px-3.5 py-3">
                <p className="text-[13px] font-semibold text-amber-600 mb-2">💬 상담 질문 제안</p>
                {meaning.questions.map((q, i) => (
                  <p key={i} className="text-[16px] leading-relaxed text-gray-800 mb-1.5">
                    {i + 1}. "{q}"
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// 솔로(무료 마케팅) 전용 — 맛보기 결과만(카드명 + 정/역 + 한 줄). 상세 풀이는 일부러 안 줌(상담 유도).
function SoloResult({ state, spread, threeLabels }: {
  state: TarotState;
  spread: import('@tarot/engine').Spread;
  threeLabels?: [string, string, string];
}) {
  const revealed = state.picks.filter((p) => p.revealed);
  if (!revealed.length || !spread) return null;
  return (
    <div className="flex flex-col gap-2">
      {revealed.map((p) => {
        const { card, reversed } = cardAt(state.deckOrder, state.reversed, p.deckPos);
        if (!card) return null;
        const meaning = reversed ? card.reversed : card.upright;
        const posName = threeLabels?.[p.slot] ?? spread.positions[p.slot]?.nameKo ?? '';
        return (
          <div key={p.slot} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100">
            <div className="w-12 shrink-0"><Card3D card={card} reversed={reversed} revealed /></div>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-bold text-gray-900">
                <span className="text-accent-500">{posName}</span> · {card.nameKo}
                {reversed && <span className="ml-1 text-[12px] text-accent-400">(역)</span>}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-gray-600">{meaning.line}</p>
            </div>
          </div>
        );
      })}
      {/* 은은한 상담 유도 (노골적 X) */}
      <a
        href="https://sajuplan.com/counselors?category=타로"
        className="mt-1 block rounded-2xl bg-accent-50 px-4 py-3 text-center text-[13px] font-medium text-accent-600 ring-1 ring-accent-300"
      >
        🔮 더 깊은 풀이는 전화타로 상담사와 →
      </a>
    </div>
  );
}

// 상담사 전용 버튼 래퍼 — 고객에겐 같은 화면이지만 버튼이 잠김
function CounselorOnly({
  role,
  children,
}: {
  role: BoardRole;
  children: React.ReactNode;
}) {
  // 고객 화면에선 상담사 액션 버튼을 아예 숨긴다(흐린 가짜버튼 금지).
  // 지금 뭘 기다리는지는 상단 MemberStatusBanner 가 명확히 안내한다.
  if (role === 'member') return null;
  return <>{children}</>;
}

export default function TarotBoard({ state, send, role = 'solo', revealOnPick }: TarotBoardProps) {
  const spread = state.spreadKey ? SPREAD_BY_KEY[state.spreadKey] : undefined;
  const need = spreadCount(state);
  const isCounselor = role === 'counselor';
  const isMember = role === 'member';
  const isSolo = role === 'solo';
  // "다음 리딩"(리셋)은 현재 카드·풀이를 통째로 날리는 파괴적 동작 → 상담사는 확인 모달로 보호
  const [confirmReset, setConfirmReset] = useState(false);
  const threeLabels =
    state.spreadKey === 'three'
      ? THREE_CARD_SETS.find((s) => s.key === state.threeSet)?.labels
      : undefined;

  // ── 로비: 배열 선택 ─────────────────────────────
  // 상담사·고객 모두 같은 화면, 버튼만 고객에게 잠김
  if (state.phase === 'lobby') {
    return (
      <div className="flex flex-col gap-5">
        {isCounselor
          ? <StatusBanner tone="do" icon="✨" head="배열을 선택하고 카드를 섞어 주세요" sub="선택한 배열이 고객 화면에도 똑같이 표시됩니다" />
          : isMember
            ? null /* 고객 안내는 상단 상태배너가 담당 */
            : <StatusBanner tone="do" icon="🔮" head="배열을 골라 보세요" sub="마음속 질문을 떠올리며 선택하세요" />
        }

        {/* 고객: 배열 타일은 '미리보기'(상담사가 고를 것) — 행동 대상 아님을 캡션으로 명시 */}
        {isMember && (
          <p className="text-center text-[12px] text-gray-400">상담사가 고를 배열 미리보기</p>
        )}

        <div className="grid grid-cols-2 gap-2.5">
          {SPREADS.map((s) => {
            const active = state.spreadKey === s.key;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => !isMember && send({ t: 'spread.set', key: s.key })}
                disabled={isMember}
                className={`flex flex-col gap-2 rounded-2xl bg-white p-3 text-left shadow-sm transition ${
                  active
                    ? 'ring-2 ring-accent-400'
                    : isMember
                      ? 'opacity-40 ring-1 ring-gray-100' /* 고객: 미선택은 흐리게 = 미리보기(상담사가 고른 것만 또렷) */
                      : 'ring-1 ring-gray-100 hover:bg-gray-50'
                } ${isMember ? 'cursor-default' : ''}`}
              >
                <SpreadMini spread={s} active={active} />
                <div>
                  <div className="flex items-center justify-between">
                    <span className={`text-[15px] font-bold ${active ? 'text-accent-500' : 'text-gray-900'}`}>
                      {s.nameKo}
                    </span>
                    <span className="text-[11px] font-medium text-accent-500">{s.count}장</span>
                  </div>
                  <p className="mt-1 text-[11px] leading-snug text-gray-500">{s.desc}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* 포지션·역방향은 상담사 전용 설정 — 고객 화면에선 숨겨 혼란 제거 */}
        {!isMember && state.spreadKey === 'three' && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[12px] text-gray-500">포지션</span>
            {THREE_CARD_SETS.map((set) => (
              <button
                key={set.key}
                type="button"
                onClick={() => send({ t: 'three.set', set: set.key })}
                className={`rounded-full px-2.5 py-1 text-[11px] ${
                  state.threeSet === set.key ? 'bg-[#ec4899] text-white' : 'bg-gray-100 text-gray-500'
                }`}
              >
                {set.nameKo}
              </button>
            ))}
          </div>
        )}

        {!isMember && (
          <label className="flex items-center justify-center gap-2 text-[13px] text-gray-600">
            <input
              type="checkbox"
              checked={state.useReversed}
              onChange={(e) => send({ t: 'reversed.toggle', on: e.target.checked })}
              className="h-4 w-4 accent-[#f472b6]"
            />
            역방향 카드 사용 (정통)
          </label>
        )}

        <CounselorOnly role={role}>
          <button
            type="button"
            disabled={!state.spreadKey}
            onClick={() => send({ t: 'shuffle', seed: makeSeed() })}
            className="flex h-[52px] w-full items-center justify-center rounded-full bg-accent-500 text-[16px] font-semibold text-white shadow-sm transition hover:bg-accent-600 disabled:bg-gray-200 disabled:text-gray-400 disabled:shadow-none"
          >
            🔮 카드 섞기
          </button>
        </CounselorOnly>
      </div>
    );
  }

  // ── 셔플 ─────────────────────────────────────────
  // 양쪽 같은 화면. 멈추기는 상담사만
  if (state.phase === 'shuffle') {
    return (
      <div className="flex flex-col items-center gap-6 py-6">
        {isCounselor
          ? <StatusBanner tone="do" icon="🎙️" head="고객에게 안내해 주세요" sub={'"카드에 집중하며 질문을 떠올려 보세요. 준비되면 말씀해 주세요"'} />
          : isMember
            ? null /* 고객 안내는 상단 상태배너가 담당 */
            : <StatusBanner tone="wait" icon="🔮" head="질문에 집중하세요" sub="카드를 바라보며 준비되면 멈추세요" />
        }
        <div className="relative h-[400px] w-[266px] max-w-[80vw]">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="card-back shuffle-wobble absolute inset-0 rounded-2xl"
              style={{ animationDelay: `${i * 0.08}s`, transform: `rotate(${(i - 2) * 4}deg)` }}
            />
          ))}
        </div>
        {isMember ? null : (
          <>
            <button
              type="button"
              onClick={() => send({ t: 'spread.lay' })}
              className="inline-flex h-[52px] items-center justify-center rounded-full bg-accent-500 px-9 text-[16px] font-bold text-white shadow-sm transition hover:bg-accent-600"
            >
              ✋ 고객 준비 완료 — 멈추기
            </button>
            <p className="text-center text-[12px] text-gray-400">누르면 고객 화면에 카드 78장이 펼쳐집니다</p>
          </>
        )}
      </div>
    );
  }

  // ── 픽 ─────────────────────────────────────────
  // 양쪽 같은 화면. 카드 뽑기는 고객·솔로만
  if ((state.phase === 'spread' || state.phase === 'picking') && spread) {
    const picked = new Set(state.picks.map((p) => p.deckPos));
    return (
      <div className="flex flex-col gap-4">
        {isCounselor
          ? <StatusBanner tone="wait" icon="👀" head={`고객이 카드를 고르고 있어요 (${state.picks.length}/${need})`} sub={`${need}장 다 고르면 자동으로 다음 단계로 넘어갑니다`} />
          : isMember
            ? null /* 고객 안내는 상단 상태배너(핑크 = 지금 내 차례)가 담당 */
            : <StatusBanner tone="do" icon="👆" head={`카드를 ${need}장 골라 주세요`} sub={`${state.picks.length}/${need} 선택`} />
        }
        <SpreadView
          spread={spread}
          labels={threeLabels}
          picks={state.picks}
          deckOrder={state.deckOrder}
          reversed={state.reversed}
          revealing={false}
          onReveal={() => {}}
        />
        {/* 숫자 플래시 — 카드 뽑을 때마다 팡! */}
        {!isCounselor && <PickFlash count={state.picks.length} total={need} />}

        {/* 상담사는 고객이 고르는 걸 지켜봄(뷰어), 고객·솔로는 직접 픽 */}
        {!isCounselor ? (
          <CardGrid
            pickedPositions={picked}
            onPick={(deckPos) => {
              const slot = state.picks.length;
              send({ t: 'card.pick', deckPos });
              if (revealOnPick) window.setTimeout(() => send({ t: 'card.reveal', slot }), 220);
            }}
          />
        ) : null}
      </div>
    );
  }

  // ── 공개·완료 ────────────────────────────────────
  // 양쪽 같은 화면. 뒤집기는 상담사·솔로만
  if ((state.phase === 'revealing' || state.phase === 'done') && spread) {
    const done = state.phase === 'done';
    return (
      <div className="flex flex-col gap-4">
        {isMember
          ? null /* 고객 안내는 상단 상태배너가 담당 */
          : isCounselor
            ? (!done
                ? <StatusBanner tone="do" icon="👆" head="카드를 탭해서 한 장씩 공개하세요" sub="터치하면 고객 화면에도 똑같이 공개됩니다" />
                : <StatusBanner tone="do" icon="🎴" head="전화로 해설해 주세요" sub="아래 카드 정보를 보며 설명하세요" />)
            : /* 솔로(무료) — 상담사·전화 문구 없음. 완료 단계는 배너 없이 간략 결과만 */
              (!done
                ? <StatusBanner tone="do" icon="👆" head="카드를 탭해 펼쳐 보세요" />
                : null)
        }

        <SpreadView
          spread={spread}
          labels={threeLabels}
          picks={state.picks}
          deckOrder={state.deckOrder}
          reversed={state.reversed}
          revealing={!done && !isMember}
          onReveal={(slot) => send({ t: 'card.reveal', slot })}
        />

        {/* 전부 펼치기 — 상담사·솔로만 */}
        {!done && !isMember && (
          <button
            type="button"
            onClick={() => send({ t: 'card.revealAll' })}
            className="mx-auto rounded-full bg-white px-4 py-1.5 text-[12px] text-gray-500 shadow-sm ring-1 ring-gray-200 transition hover:bg-gray-50"
          >
            전부 펼치기
          </button>
        )}

        {/* 의미 패널: 상담사 = 상세(전화 풀이 보조), 솔로 = 맛보기(카드명+한 줄), 고객 = 간결 */}
        {isCounselor && done && (
          <p className="text-center text-[12px] text-gray-400">🔒 아래 정보는 상담사 화면에만 표시됩니다</p>
        )}
        {isCounselor
          ? <CounselorMeaningPanel state={state} spread={spread} threeLabels={threeLabels} />
          : isSolo
            ? <SoloResult state={state} spread={spread} threeLabels={threeLabels} />
            : (
              <div className="flex flex-col gap-2">
                {state.picks.filter((p) => p.revealed).map((p) => {
                  const { card, reversed } = cardAt(state.deckOrder, state.reversed, p.deckPos);
                  if (!card) return null;
                  const posName = threeLabels?.[p.slot] ?? spread.positions[p.slot]?.nameKo ?? '';
                  return (
                    <div key={p.slot} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-sm ring-1 ring-gray-100">
                      <div className="w-10 shrink-0"><Card3D card={card} reversed={reversed} revealed /></div>
                      <div>
                        <p className="text-[13px] font-bold text-gray-900">
                          <span className="text-accent-500">{posName}</span> · {card.nameKo}
                          {reversed && <span className="ml-1 text-[12px] text-accent-400">(역)</span>}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

        {/* 다음 리딩 — 상담사·솔로만. 상담사는 실수 방지 확인 모달 경유(현재 리딩 통째 삭제) */}
        {done && !isMember && (
          <div className="mt-2">
            <button
              type="button"
              onClick={() => (isCounselor ? setConfirmReset(true) : send({ t: 'reset' }))}
              className="flex h-[52px] w-full items-center justify-center rounded-full bg-accent-500 text-[16px] font-semibold text-white shadow-sm transition hover:bg-accent-600"
            >
              {isCounselor ? '🔄 다음 리딩' : '다시 뽑기'}
            </button>
          </div>
        )}

        {/* 새로 뽑기 확인 — 화면 중앙 큰 모달(실수 탭 방지) */}
        {confirmReset && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 px-6"
            onClick={() => setConfirmReset(false)}
          >
            <div
              className="w-full max-w-[340px] rounded-3xl bg-white p-6 text-center shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-accent-50 text-[34px]">
                🔄
              </div>
              <p className="text-[21px] font-extrabold leading-tight text-gray-900">정말 새로 뽑을까요?</p>
              <p className="mt-2.5 text-[15px] leading-relaxed text-gray-600">
                지금 펼친 카드와 풀이가 <b className="text-accent-600">모두 사라지고</b>
                <br />
                처음(배열 선택) 화면으로 돌아갑니다.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="h-[52px] flex-1 rounded-full bg-gray-100 text-[16px] font-bold text-gray-600 transition hover:bg-gray-200"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setConfirmReset(false);
                    send({ t: 'reset' });
                  }}
                  className="h-[52px] flex-1 rounded-full bg-accent-500 text-[16px] font-bold text-white shadow-sm transition hover:bg-accent-600"
                >
                  네, 새로 뽑기
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  return null;
}
