import { useEffect, useState, lazy, Suspense } from "react";
import Header from "./components/Header.js";
import ErrorBoundary from "./components/ErrorBoundary.js";
import ShareModal from "./components/ShareModal.js";
import PortalHome from "./components/PortalHome.js";
import EmbedView from "./components/EmbedView.js";
import type { FortuneMode } from "./components/fortune/FortuneView.js";
import { TOPICS, type Topic } from "./data/topics.js";
import { navigate } from "./lib/nav.js";

// 코드분할 — 첫 화면(홈)만 즉시 로드, 각 운세 뷰는 진입 시 lazy 로드(첫 로딩 경량화).
const LottoView = lazy(() => import("./components/lotto/LottoView.js"));
const FortuneView = lazy(() => import("./components/fortune/FortuneView.js"));
const DreamView = lazy(() => import("./components/dream/DreamView.js"));
const CoupleView = lazy(() => import("./components/couple/CoupleView.js"));
const WealthView = lazy(() => import("./components/extra/WealthView.js"));
const LifeView = lazy(() => import("./components/extra/LifeView.js"));
const TaegilView = lazy(() => import("./components/extra/TaegilView.js"));
const TojeongView = lazy(() => import("./components/fun/TojeongView.js"));
const CelebCoupleView = lazy(() => import("./components/fun/CelebCoupleView.js"));
const BloodCompatView = lazy(() => import("./components/fun/BloodCompatView.js"));
const PetalView = lazy(() => import("./components/fun/PetalView.js"));
const FortuneCookieView = lazy(() => import("./components/fun/FortuneCookieView.js"));
const MbtiView = lazy(() => import("./components/fun/MbtiView.js"));
const NameCompatView = lazy(() => import("./components/fun/NameCompatView.js"));
const PastLifeView = lazy(() => import("./components/fun/PastLifeView.js"));

// 가벼운 해시 라우터. 새 콘텐츠 타일이 늘면 여기에 route 추가.
type Route =
  | "home" | "lotto" | "today" | "zodiac" | "star" | "dream" | "couple"
  | "manse" | "tarot" | "newyear" | "monthly" | "wealth" | "life" | "taegil"
  | "tojeong" | "celeb" | "blood" | "petal" | "cookie"
  | "mbti" | "namecompat" | "pastlife";

const ROUTES: Route[] = [
  "home", "lotto", "today", "zodiac", "star", "dream", "couple",
  "manse", "tarot", "newyear", "monthly", "wealth", "life", "taegil",
  "tojeong", "celeb", "blood", "petal", "cookie",
  "mbti", "namecompat", "pastlife",
];

const TITLES: Record<Route, string> = {
  home: "오늘의 운세",
  lotto: "오늘의 행운번호",
  today: "오늘의 운세",
  zodiac: "띠별 운세",
  star: "별자리 운세",
  dream: "꿈해몽",
  couple: "궁합",
  manse: "만세력",
  tarot: "타로",
  newyear: "신년운세",
  monthly: "월간 운세",
  wealth: "재물운",
  life: "평생운세",
  taegil: "택일",
  tojeong: "토정비결",
  celeb: "연예인 궁합",
  blood: "혈액형 궁합",
  petal: "꽃잎점",
  cookie: "포춘쿠키",
  mbti: "MBTI 운세",
  namecompat: "이름 궁합",
  pastlife: "전생 이야기",
};

const EMBED_ROUTES: Route[] = ["manse", "tarot"];

function currentRoute(): Route {
  // path 우선(/tojeong). 앞뒤 슬래시 제거 — nginx가 /dream→/dream/ 301 리다이렉트해도 매칭되게.
  const path = window.location.pathname.replace(/^\/+|\/+$/g, "").split("?")[0] as Route;
  if (ROUTES.includes(path)) return path;
  const h = window.location.hash.replace(/^#\/?/, "").split("?")[0] as Route;
  return ROUTES.includes(h) ? h : "home";
}

const Loading = () => <div className="flex justify-center py-24"><span className="text-[13px] text-ink/58">불러오는 중…</span></div>;

export default function App() {
  const [route, setRoute] = useState<Route>(currentRoute);

  useEffect(() => {
    const onNav = () => {
      setRoute(currentRoute());
      window.scrollTo(0, 0);
    };
    window.addEventListener("popstate", onNav); // pushState 내비 + 뒤로가기
    window.addEventListener("hashchange", onNav); // 옛 해시 링크 하위호환
    return () => {
      window.removeEventListener("popstate", onNav);
      window.removeEventListener("hashchange", onNav);
    };
  }, []);

  // 페이지별 문서 제목(탭·북마크·공유) — route 따라 갱신
  useEffect(() => {
    document.title = route === "home" ? "오늘의 운세 — 사주플랜" : `${TITLES[route]} — 사주플랜`;
  }, [route]);

  function openTopic(topic: Topic) {
    if ((topic.kind === "lotto" || topic.kind === "fortune" || topic.kind === "embed") && topic.route) {
      navigate(`/${topic.route}`);
    }
    // soon: 비활성(타일에서 disabled)
  }

  function goHome() {
    navigate("/");
  }

  // 임베드(만세·타로) — 포털 헤더 없이 EmbedView가 자체 뒤로가기 바를 가짐
  if (EMBED_ROUTES.includes(route)) {
    const topic = TOPICS.find((t) => t.route === route);
    return (
      <div className="app-shell">
        <EmbedView title={TITLES[route]} src={topic?.href ?? "https://sajuplan.com"} onBack={goHome} />
      </div>
    );
  }

  return (
    <div className="app-shell">
      <Header title={TITLES[route]} home={route === "home"} onBack={route === "home" ? undefined : goHome} />
      <ErrorBoundary key={route}>
        <Suspense fallback={<Loading />}>
          {route === "home" && <PortalHome onOpen={openTopic} />}
          {route === "lotto" && <LottoView />}
          {route === "dream" && <DreamView />}
          {route === "couple" && <CoupleView />}
          {route === "wealth" && <WealthView />}
          {route === "life" && <LifeView />}
          {route === "taegil" && <TaegilView />}
          {route === "tojeong" && <TojeongView />}
          {route === "celeb" && <CelebCoupleView />}
          {route === "blood" && <BloodCompatView />}
          {route === "petal" && <PetalView />}
          {route === "cookie" && <FortuneCookieView />}
          {route === "mbti" && <MbtiView />}
          {route === "namecompat" && <NameCompatView />}
          {route === "pastlife" && <PastLifeView />}
          {(route === "today" ||
            route === "zodiac" ||
            route === "star" ||
            route === "newyear" ||
            route === "monthly") && <FortuneView mode={route as FortuneMode} />}
        </Suspense>
      </ErrorBoundary>
      <ShareModal />
    </div>
  );
}
