import React from "react";
import { useParams, useNavigate } from "react-router";
import svgPaths from "../../imports/svg-ybuhc3tpx0";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { counselors, typeColors } from "./data";

function StarIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 14 14" fill="none" className="shrink-0">
      <path d={svgPaths.p3572fc00} fill="#FFB800" transform="translate(1.7, 1.7)" />
    </svg>
  );
}

export default function DetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const counselor = counselors.find((c) => c.id === Number(id));

  if (!counselor) {
    return (
      <div className="max-w-[393px] mx-auto bg-white min-h-screen flex flex-col items-center justify-center gap-4" style={{ fontFamily: "'Noto Sans KR', sans-serif" }}>
        <p className="text-[16px] text-[#777]">상담사를 찾을 수 없습니다</p>
        <button onClick={() => navigate("/")} className="bg-[#8259f5] text-white px-6 py-2.5 rounded-full text-[14px]">
          홈으로 돌아가기
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-[393px] mx-auto bg-white min-h-screen relative" style={{ fontFamily: "'Noto Sans KR', 'Inter', sans-serif" }}>
      {/* Header */}
      <div className="sticky top-0 z-50 bg-white flex items-center h-[55px] px-4 border-b border-[#f3f3f3]">
        <button onClick={() => navigate(-1)} className="p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d="M15 18L9 12L15 6" stroke="black" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-[16px] flex-1 text-center" style={{ fontWeight: 600 }}>상담사 프로필</span>
        <button className="p-1">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path d={svgPaths.p24b67a00} fill="black" transform="translate(4, 2)" />
          </svg>
        </button>
      </div>

      {/* Profile */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex gap-4">
          <ImageWithFallback
            src={counselor.image}
            alt={counselor.name}
            className="w-[120px] h-[120px] rounded-[15px] object-cover shrink-0"
          />
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="text-[18px] text-black" style={{ fontWeight: 700 }}>{counselor.name}</span>
              <span className="text-[14px] text-[#dfae21]">{counselor.code}</span>
            </div>
            <p className="text-[13px] text-[#555] mt-1">{counselor.subtitle}</p>
            <div className="flex items-center gap-2 mt-2">
              <span
                className="text-[12px] text-white px-2.5 py-1 rounded-sm"
                style={{ backgroundColor: typeColors[counselor.type], fontWeight: 500 }}
              >
                {counselor.type}
              </span>
              <span className="text-[12px] text-[#777]">경력 {counselor.experience}</span>
            </div>
            <div className="flex items-center gap-3 mt-2">
              <div className="flex items-center gap-1">
                <StarIcon />
                <span className="text-[13px] text-black" style={{ fontWeight: 600 }}>{counselor.rating}</span>
              </div>
              <span className="text-[12px] text-[#777]">후기 {counselor.reviews}건</span>
            </div>
          </div>
        </div>
      </div>

      {/* Price */}
      <div className="mx-5 bg-[#f3efff] rounded-[15px] px-4 py-3.5 flex items-center justify-between">
        <span className="text-[13px] text-[#555]">상담 요금</span>
        <span className="text-[15px] text-[#8259f5]" style={{ fontWeight: 700 }}>
          30초당 {counselor.price}원
        </span>
      </div>

      {/* Description */}
      <div className="mx-5 mt-5">
        <p className="text-[14px] text-[#8259f5] mb-3" style={{ fontWeight: 600 }}>{counselor.description}</p>
        <p className="text-[13px] text-[#555] leading-[1.8]">{counselor.bio}</p>
      </div>

      {/* Specialties */}
      <div className="mx-5 mt-5">
        <p className="text-[14px] text-black mb-2" style={{ fontWeight: 600 }}>전문 분야</p>
        <div className="flex gap-2 flex-wrap">
          {counselor.specialties.map((s) => (
            <span key={s} className="bg-[#f8f8f8] text-[13px] text-[#555] px-3.5 py-1.5 rounded-full border border-[#eee]">
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Reviews preview */}
      <div className="mx-5 mt-6 mb-6">
        <p className="text-[14px] text-black mb-3" style={{ fontWeight: 600 }}>최근 후기</p>
        {[
          { user: "김**", text: "정말 잘 맞아요! 다음에도 꼭 상담받고 싶습니다.", date: "2026.04.10" },
          { user: "이**", text: "따뜻하게 상담해주셔서 마음이 편안해졌어요.", date: "2026.04.08" },
        ].map((review, i) => (
          <div key={i} className="bg-[#f8f8f8] rounded-[12px] px-4 py-3 mb-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[13px] text-black" style={{ fontWeight: 500 }}>{review.user}</span>
              <span className="text-[11px] text-[#aaa]">{review.date}</span>
            </div>
            <div className="flex gap-0.5 mb-1">
              {[1,2,3,4,5].map(n => <StarIcon key={n} />)}
            </div>
            <p className="text-[12px] text-[#555]">{review.text}</p>
          </div>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="sticky bottom-0 bg-white px-5 py-3 border-t border-[#f3f3f3] flex gap-2.5">
        {counselor.hasChat && (
          <button
            className="bg-[#7867a8] text-white text-[14px] py-3 rounded-[10px] flex-1 active:bg-[#6a5a96] transition-colors"
            style={{ fontWeight: 600 }}
            onClick={() => alert("채팅 연결 중...")}
          >
            채팅연결
          </button>
        )}
        <button
          className="bg-[#8259f5] text-white text-[14px] py-3 rounded-[10px] flex-1 active:bg-[#7048e0] transition-colors"
          style={{ fontWeight: 600 }}
          onClick={() => alert("전화 연결 중...")}
        >
          전화연결
        </button>
      </div>
    </div>
  );
}
