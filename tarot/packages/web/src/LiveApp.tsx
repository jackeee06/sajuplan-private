import { useEffect, useMemo, useState } from 'react';
import { createLiveTransport } from './transport-live';
import { wsUrlFor, httpBase } from './config';
import { useTarot } from './useTarot';
import TarotBoard from './board/TarotBoard';
import MemberStatusBanner from './board/MemberStatusBanner';

type Role = 'counselor' | 'member';

// URL 파라미터 파싱 — 앱이 열 때 붙여주는 상담 컨텍스트
function getParams() {
  const p = new URLSearchParams(window.location.search);
  return {
    role: (p.get('role') === 'counselor' ? 'counselor' : 'member') as Role,
    session: p.get('session') || '',
    counselorName: p.get('cName') || '',   // 상담사 이름 (회원 화면에 표시)
    counselorPhoto: p.get('cPhoto') || '',
    memberName: p.get('mName') || '',      // 고객 이름 (상담사 화면에 표시)
    code: p.get('code') || '',
  };
}

// 세션 ID → 방코드 자동 변환(서버가 같은 세션이면 같은 방)
async function getOrCreateRoom(session: string): Promise<string> {
  if (session) {
    // 세션 기반 자동 페어링: POST로 세션ID 전달 → 같은 세션이면 같은 방코드 반환
    const res = await fetch(`${httpBase()}/api/tarot/rooms`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ session }),
    });
    if (!res.ok) throw new Error('방 연결 실패');
    const json = (await res.json()) as { code: string };
    return json.code;
  }
  // 기존 랜덤 방코드 방식
  const res = await fetch(`${httpBase()}/api/tarot/rooms`, { method: 'POST' });
  if (!res.ok) throw new Error('방 생성 실패');
  return ((await res.json()) as { code: string }).code;
}

// 상담사 정보 표시 (URL 파라미터로 전달받음)
function CounselorBadge({ name, photo }: { name: string; photo: string }) {
  if (!name) return null;
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm ring-1 ring-gray-100">
      {photo ? (
        <img src={photo} alt={name} className="h-8 w-8 rounded-full object-cover" />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-100 text-[14px]">🧑‍🏫</div>
      )}
      <span className="text-[13px] font-semibold text-gray-800">{name} 상담사</span>
    </div>
  );
}

function LiveBoard({ code, role, counselorName, counselorPhoto, memberName }: {
  code: string; role: Role; counselorName: string; counselorPhoto: string; memberName: string;
}) {
  const transport = useMemo(() => createLiveTransport(wsUrlFor(code, role)), [code, role]);
  useEffect(() => () => transport.close(), [transport]);
  const { state, send } = useTarot(transport);

  return (
    <div className="flex flex-col gap-4">
      {/* 상태 바 */}
      <div className={`flex items-center justify-between rounded-2xl px-4 py-2.5 shadow-sm ring-1 ${
        role === 'counselor' ? 'bg-accent-50 ring-accent-100' : 'bg-white ring-gray-100'
      }`}>
        <div className="flex items-center gap-1.5 min-w-0">
          {/* 회원 화면: 상담사 이름 표시 */}
          {role === 'member' && (
            <>
              {counselorPhoto
                ? <img src={counselorPhoto} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
                : <span className="text-[12px]">🧑‍🏫</span>
              }
              <span className="truncate text-[12px] font-medium text-gray-700">
                {counselorName ? `${counselorName} 상담사` : '상담사'} · 연결됨
              </span>
            </>
          )}
          {/* 상담사 화면: 고객 이름 표시 */}
          {role === 'counselor' && (
            <>
              <span className="text-[12px]">🙋</span>
              <span className="truncate text-[12px] font-medium text-gray-700">
                {memberName ? `${memberName} 고객님` : '고객님'} · 라이브 상담 중
              </span>
            </>
          )}
        </div>
        <span className="ml-2 shrink-0 text-[13px] font-bold tracking-widest text-accent-600">
          {code}
        </span>
      </div>

      {/* 고객 전용 상단 상태배너 — 단계마다 "기다리세요/지금 골라주세요" 명확히 */}
      {role === 'member' && <MemberStatusBanner state={state} />}

      <TarotBoard state={state} send={send} role={role} />
    </div>
  );
}

export default function LiveApp() {
  const { role, session, counselorName, counselorPhoto, memberName, code: urlCode } = getParams();

  const [code, setCode] = useState(urlCode);
  const [joined, setJoined] = useState(!!urlCode);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [copied, setCopied] = useState(false);

  // 세션 ID가 있으면 자동 연결(고객 측에서도 코드 입력 불필요)
  useEffect(() => {
    if (session && !code) {
      setBusy(true);
      getOrCreateRoom(session)
        .then((c) => { setCode(c); setJoined(true); })
        .catch(() => setErr('자동 연결에 실패했어요. 잠시 후 다시 시도해주세요.'))
        .finally(() => setBusy(false));
    }
  }, [session, code]);

  if (joined && code) {
    return (
      <LiveBoard
        code={code}
        role={role}
        counselorName={counselorName}
        counselorPhoto={counselorPhoto}
        memberName={memberName}
      />
    );
  }

  // 로딩 중(세션 자동 연결)
  if (busy) {
    return (
      <div className="flex flex-col items-center gap-4 py-12 text-center">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-accent-200 border-t-accent-500" />
        <p className="text-[14px] text-gray-500">연결 중...</p>
      </div>
    );
  }

  // 상담사 로비 ─────────────────────────────────
  if (role === 'counselor') {
    if (code) {
      // 방코드 표시
      return (
        <div className="flex flex-col items-center gap-5 py-6 text-center">
          {/* 카드 이미지 */}
          <img
            src="/tarot/back.webp"
            alt="타로 카드"
            className="h-[180px] w-[120px] rounded-2xl object-cover shadow-lg"
          />
          <div className="text-[13px] text-gray-500">
            고객에게 이 번호를 <b className="text-gray-900">전화로</b> 불러주세요
          </div>
          <div className="rounded-3xl bg-white px-10 py-5 shadow-md ring-2 ring-accent-200">
            <p className="text-[11px] font-semibold tracking-wider text-accent-400 mb-1">방코드</p>
            <p className="text-[52px] font-extrabold tracking-[0.3em] text-gray-900 leading-none">{code}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(code).catch(() => {});
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
            className="inline-flex h-[34px] items-center gap-1.5 rounded-full bg-gray-100 px-4 text-[12px] text-gray-600 hover:bg-gray-200 transition"
          >
            {copied ? '✓ 복사됨' : '📋 번호 복사'}
          </button>
          <button
            type="button"
            onClick={() => setJoined(true)}
            className="flex h-[52px] w-full max-w-xs items-center justify-center rounded-full bg-accent-500 text-[16px] font-semibold text-white shadow-sm transition hover:bg-accent-600"
          >
            보드 입장하기
          </button>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center gap-5 py-6 text-center">
        <img src="/tarot/back.webp" alt="타로 카드"
          className="h-[180px] w-[120px] rounded-2xl object-cover shadow-lg" />
        <p className="text-sm text-gray-500">
          방을 만들고, <b className="text-gray-900">방코드를 전화로 불러주세요</b>
        </p>
        <button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true); setErr('');
            try { const c = await getOrCreateRoom(''); setCode(c); }
            catch { setErr('방 생성에 실패했어요.'); }
            finally { setBusy(false); }
          }}
          className="flex h-[52px] w-full max-w-xs items-center justify-center rounded-full bg-accent-500 text-[16px] font-semibold text-white shadow-sm transition hover:bg-accent-600 disabled:opacity-50"
        >
          🔮 타로 방 만들기
        </button>
        {err && <p className="text-[12px] text-red-500">{err}</p>}
      </div>
    );
  }

  // 고객 로비 — 세션 없이 직접 접속한 경우 안내만 표시
  // (앱이 ?session=통화ID 를 붙여주면 위에서 이미 자동 연결됨 → 여기 안 옴)
  return (
    <div className="flex flex-col items-center gap-6 py-8 text-center">
      <img src="/tarot/back.webp" alt="타로 카드"
        className="h-[180px] w-[120px] rounded-2xl object-cover shadow-lg" />
      {counselorName && <CounselorBadge name={counselorName} photo={counselorPhoto} />}
      <div>
        <p className="text-[16px] font-semibold text-gray-800">앱에서 타로방을 열어주세요</p>
        <p className="mt-2 text-[13px] leading-relaxed text-gray-400">
          전화 상담 중 앱의<br />
          <b className="text-gray-600">"타로 보기"</b> 버튼을 눌러 입장하세요
        </p>
      </div>
      {err && <p className="text-[12px] text-red-500">{err}</p>}
    </div>
  );
}
