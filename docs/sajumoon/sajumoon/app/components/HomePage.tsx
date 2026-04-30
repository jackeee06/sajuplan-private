import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router";
import svgPaths from "../../imports/svg-ybuhc3tpx0";
import imgLogo22 from "figma:asset/logo.png";
import imgCircleMoon from "figma:asset/circle_moon.png";
import imgCrescentMoon from "figma:asset/crescent_moon.png";
import imgMenuHomeLogo from "figma:asset/menuhome_logo.png";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { counselors as initialCounselors, bannerImages, typeColors, type Counselor } from "./data";

const categories = ["전체", "타로", "사주", "신점"] as const;
const sortOptions = ["추천순", "최신순", "후기많은순", "가격높은순", "가격낮은순"] as const;

// ─── Icons ───
function StarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path d={svgPaths.p3572fc00} fill="#FFB800" transform="translate(1.7, 1.7)" />
    </svg>
  );
}

function ChatBubbleIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 8.33333 9.16667" fill="none" className="shrink-0">
      <path d={svgPaths.p2cfa2500} fill="#9C9C9C" />
    </svg>
  );
}

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg width="17" height="16" viewBox="0 0 14.1667 12.9979" fill="none" className="shrink-0">
      <path d={svgPaths.p2c368300} fill={filled ? "#8259F5" : "#D9D9D9"} />
    </svg>
  );
}

// ─── Ellipse icon for 총 사주 대화 ───
function EllipseIcon() {
  return <img src={imgCircleMoon} alt="총 사주 대화" className="w-[24px] h-[24px] object-contain" />;
}

// ─── Nightlight icon for 진행중 대화 ───
function NightlightIcon() {
  return <img src={imgCrescentMoon} alt="진행중 대화" className="w-[24px] h-[24px] object-contain" />;
}

// ─── Header ────
function Header() {
  return (
    <div className="sticky top-0 z-50 bg-white flex items-center justify-center h-[55px] border-b border-[#f3f3f3]">
      <img src={imgLogo22} alt="Logo" className="h-[42px] object-contain" />
      <button className="absolute right-4 p-1">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d={svgPaths.p24b67a00} fill="black" transform="translate(4, 2)" />
        </svg>
      </button>
    </div>
  );
}

// ─── Auto-sliding Banner ───
function BannerSlider() {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent((prev) => (prev + 1) % bannerImages.length);
    }, 3500);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="relative rounded-[10px] overflow-hidden h-full">
      <div
        className="flex h-full transition-transform duration-500 ease-in-out"
        style={{ transform: `translateX(-${current * 100}%)` }}
      >
        {bannerImages.map((img, i) => (
          <div key={i} className="min-w-full h-full relative shrink-0">
            <ImageWithFallback src={img} alt={`배너 ${i + 1}`} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
            <div className="absolute bottom-4 left-4 text-white">
              <p className="text-[16px]" style={{ fontWeight: 700 }}>오늘의 운세를 확인하세요</p>
              <p className="text-[12px] opacity-80 mt-0.5">지금 바로 상담 시작하기</p>
            </div>
          </div>
        ))}
      </div>
      {/* Dots */}
      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
        {bannerImages.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            className={`rounded-full transition-all h-2 ${
              i === current ? "w-5 bg-white" : "w-2 bg-white/50"
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Stats & Banner Section ───
function BannerSection() {
  return (
    <div className="px-5 pt-3 flex gap-3 h-[250px]">
      <div className="flex-[2] h-full">
        <BannerSlider />
      </div>
      <div className="flex flex-col gap-2 w-[110px] shrink-0 h-full">
        {/* 총 사주 대화 */}
        <div className="bg-white border-[1.5px] border-[#8259f5] rounded-[15px] px-3 py-2 flex flex-col items-center justify-center flex-1">
          <EllipseIcon />
          <p className="text-[14px] text-black mt-1" style={{ fontWeight: 800 }}>257,851</p>
          <p className="text-[#868686] text-[10px]">총 사주 대화</p>
        </div>
        {/* 진행중 대화 */}
        <div className="bg-[#f3efff] border-[1.5px] border-[#8259f5] rounded-[15px] px-3 py-2 flex flex-col items-center justify-center flex-1">
          <NightlightIcon />
          <p className="text-[14px] text-black mt-1" style={{ fontWeight: 800 }}>11</p>
          <p className="text-[#868686] text-[10px]">진행중 대화</p>
        </div>
        {/* 추천 보기 버튼 */}
        <button className="bg-[#4a445b] text-white text-[12px] px-4 py-2.5 rounded-[15px] whitespace-nowrap" style={{ fontWeight: 900, textShadow: "0px 0px 4px rgba(0,0,0,0.25)" }}>
          추천 보기
        </button>
      </div>
    </div>
  );
}

// ─── Category Tabs ───
function CategoryTabs({ selected, onSelect }: { selected: string; onSelect: (v: string) => void }) {
  return (
    <div className="flex px-5 gap-3.5 pt-5">
      {categories.map((cat) => (
        <button
          key={cat}
          onClick={() => onSelect(cat)}
          className={`flex-1 py-2.5 rounded-full text-[14px] text-center transition-all ${
            selected === cat
              ? "bg-[#8259f5] text-white shadow-md"
              : "bg-white text-[#868686] border border-[#eee]"
          }`}
          style={{ fontWeight: selected === cat ? 700 : 400 }}
        >
          {cat}
        </button>
      ))}
    </div>
  );
}

// ─── Filter Bar ───
function FilterBar({
  onlyAvailable,
  setOnlyAvailable,
  sortBy,
  setSortBy,
}: {
  onlyAvailable: boolean;
  setOnlyAvailable: (v: boolean) => void;
  sortBy: string;
  setSortBy: (v: string) => void;
}) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="flex items-center justify-between px-5 pt-3 pb-2">
      <button
        className="flex items-center gap-1.5 text-[14px] text-black"
        onClick={() => setOnlyAvailable(!onlyAvailable)}
      >
        <div className={`w-5 h-5 rounded-[5px] flex items-center justify-center transition-colors ${onlyAvailable ? "bg-black" : "bg-[#d9d9d9]"}`}>
          {onlyAvailable && (
            <svg width="11" height="8" viewBox="0 0 11.2404 8.17535" fill="none">
              <path d={svgPaths.p37774d00} fill="white" />
            </svg>
          )}
        </div>
        <span>바로 연결 가능</span>
      </button>

      <div className="relative" ref={dropdownRef}>
        <button
          className="flex items-center gap-0.5 text-[14px] text-black"
          onClick={() => setShowDropdown(!showDropdown)}
        >
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d={svgPaths.p2cb87d00} fill="#838383" transform="translate(2.5, 5)" />
          </svg>
          <span>{sortBy}</span>
        </button>
        {showDropdown && (
          <div className="absolute right-0 top-8 bg-white rounded-xl shadow-[0px_4px_20px_rgba(0,0,0,0.15)] py-2 z-50 min-w-[140px] overflow-hidden">
            {sortOptions.map((opt) => (
              <button
                key={opt}
                onClick={() => { setSortBy(opt); setShowDropdown(false); }}
                className={`w-full text-left px-4 py-2.5 text-[13px] transition-colors ${
                  sortBy === opt ? "bg-[#f3efff] text-[#8259f5]" : "text-black hover:bg-[#f8f8f8]"
                }`}
                style={{ fontWeight: sortBy === opt ? 600 : 400 }}
              >
                {opt}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Counselor Card ───
function CounselorCard({
  counselor,
  onToggleFav,
}: {
  counselor: Counselor;
  onToggleFav: (id: number) => void;
}) {
  const navigate = useNavigate();

  return (
    <div
      className="bg-white rounded-[20px] shadow-[0px_0px_8px_0px_rgba(0,0,0,0.1)] px-4 pt-4 pb-3 mx-5 mb-3 cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => navigate(`/counselor/${counselor.id}`)}
    >
      <div className="flex gap-3">
        <ImageWithFallback
          src={counselor.image}
          alt={counselor.name}
          className="w-[98px] h-[101px] rounded-[10px] object-cover shrink-0"
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] text-black" style={{ fontWeight: 600 }}>{counselor.name}</span>
              <span className="text-[14px] text-[#dfae21]">{counselor.code}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); onToggleFav(counselor.id); }}
              className="p-1"
            >
              <HeartIcon filled={counselor.favorited} />
            </button>
          </div>
          <p className="text-[12px] text-black mt-0.5">{counselor.subtitle}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <span
              className="text-[12px] text-white px-2 py-0.5"
              style={{ backgroundColor: typeColors[counselor.type], fontWeight: 500 }}
            >
              {counselor.type}
            </span>
            <span className="text-[11px] text-[#777]">
              30초당{" "}
              <span style={{ fontWeight: 600 }} className="text-[12px]">{counselor.price}</span>
              <span className="text-[12px]">원</span>
            </span>
          </div>
          <p className="text-[11px] text-[#8259f5] mt-1.5">{counselor.description}</p>
          <div className="flex items-center gap-2.5 mt-1.5">
            <div className="flex items-center gap-0.5">
              <StarIcon />
              <span className="text-[10px] text-[#777]">{counselor.rating}</span>
            </div>
            <div className="flex items-center gap-0.5">
              <ChatBubbleIcon />
              <span className="text-[10px] text-[#777]">{counselor.reviews}</span>
            </div>
          </div>
        </div>
      </div>
      {/* Action Buttons */}
      <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
        {counselor.hasChat && (
          <button
            className="bg-[#7867a8] text-white text-[13px] py-2 rounded-[5px] flex-1 active:bg-[#6a5a96] transition-colors"
            style={{ fontWeight: 500 }}
            onClick={() => alert("채팅 연결 중...")}
          >
            채팅연결
          </button>
        )}
        <button
          className="bg-[#8259f5] text-white text-[13px] py-2 rounded-[5px] flex-1 active:bg-[#7048e0] transition-colors"
          style={{ fontWeight: 500 }}
          onClick={() => alert("전화 연결 중...")}
        >
          전화연결
        </button>
      </div>
    </div>
  );
}

// ─── Bottom Nav ───
function BottomNav() {
  const [active, setActive] = useState("홈");
  const navigate = useNavigate();

  const navItems = [
    {
      label: "검색",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d={svgPaths.p39222e80} fill="currentColor" transform="translate(2.5, 2.5)" />
        </svg>
      ),
    },
    {
      label: "저장함",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d={svgPaths.p3565fd80} fill="currentColor" transform="translate(2, 3)" />
        </svg>
      ),
    },
    {
      label: "홈",
      isHome: true,
      icon: (
        <div className="w-[45px] h-[45px] rounded-full bg-white flex items-center justify-center overflow-hidden shadow-lg -mt-5">
          <img src={imgMenuHomeLogo} alt="홈" className="w-[38px] h-[38px] object-contain" />
        </div>
      ),
    },
    {
      label: "포인트",
      icon: (
        <div className="w-[22px] h-[22px] relative flex items-center justify-center">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <circle cx="11" cy="11" r="10" stroke="currentColor" strokeWidth="2" />
          </svg>
          <span className="absolute text-[14px]" style={{ fontFamily: "'Jersey 25', sans-serif" }}>P</span>
        </div>
      ),
    },
    {
      label: "마이페이지",
      icon: (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
          <path d={svgPaths.p224d4200} fill="currentColor" transform="translate(2, 2)" />
          <path d={svgPaths.p21504a00} fill="currentColor" transform="translate(2, 2)" />
        </svg>
      ),
    },
  ];

  return (
    <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[393px] z-50 px-4 pb-2">
      <div className="bg-white border border-[#f3f3f3] rounded-[20px] shadow-[0px_-2px_12px_rgba(0,0,0,0.1)]">
        <div className="flex items-end justify-around px-2 pt-2.5 pb-3">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                setActive(item.label);
                if (item.label === "홈") navigate("/");
              }}
              className={`flex flex-col items-center gap-0.5 min-w-[48px] transition-colors ${
                active === item.label ? "text-[#8259f5]" : "text-[#555]"
              }`}
            >
              <div className="h-[26px] flex items-center justify-center">{item.icon}</div>
              <span className={`text-[10px] ${(item as any).isHome ? "mt-1" : ""}`}>{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Home Page ───
export default function HomePage() {
  const [selectedCategory, setSelectedCategory] = useState("전체");
  const [sortBy, setSortBy] = useState("추천순");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [counselorList, setCounselorList] = useState(initialCounselors);

  const filtered =
    selectedCategory === "전체"
      ? counselorList
      : counselorList.filter((c) => c.type === selectedCategory);

  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case "최신순": return b.id - a.id;
      case "후기많은순": return b.reviews - a.reviews;
      case "가격높은순": return parseInt(b.price.replace(",", "")) - parseInt(a.price.replace(",", ""));
      case "가격낮은순": return parseInt(a.price.replace(",", "")) - parseInt(b.price.replace(",", ""));
      default: return b.rating - a.rating;
    }
  });

  const toggleFav = (id: number) => {
    setCounselorList((prev) =>
      prev.map((c) => (c.id === id ? { ...c, favorited: !c.favorited } : c))
    );
  };

  return (
    <div className="max-w-[393px] mx-auto bg-white min-h-screen relative" style={{ fontFamily: "'Noto Sans KR', 'Inter', sans-serif" }}>
      <Header />
      <BannerSection />
      <div className="bg-[#f8f8f8] min-h-screen pb-28 mt-4">
        <CategoryTabs selected={selectedCategory} onSelect={setSelectedCategory} />
        <FilterBar
          onlyAvailable={onlyAvailable}
          setOnlyAvailable={setOnlyAvailable}
          sortBy={sortBy}
          setSortBy={setSortBy}
        />
        <div className="pt-1">
          {sorted.map((c) => (
            <CounselorCard key={c.id} counselor={c} onToggleFav={toggleFav} />
          ))}
        </div>
      </div>
      <BottomNav />
    </div>
  );
}
