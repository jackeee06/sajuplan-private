import { useState } from "react";
import { useNavigate } from "react-router";
import svgPaths from "../../imports/svg-5ogxff7p9i";
import imgLogo21 from "figma:asset/logo.png";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [keepLogin, setKeepLogin] = useState(true);
  const navigate = useNavigate();

  return (
    <div className="bg-[#f8f8f8] min-h-screen w-full max-w-[430px] mx-auto relative flex flex-col">
      {/* Header */}
      <div className="bg-white h-[55px] flex items-center justify-between px-4 shrink-0">
        <button className="w-[24px] h-[24px] flex items-center justify-center">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d={svgPaths.pd1b3d80} fill="black" />
          </svg>
        </button>
        <span className="text-[14px] text-black">로그인</span>
        <button className="w-[24px] h-[24px] flex items-center justify-center">
          <svg width="16" height="19.5" viewBox="0 0 16 19.5" fill="none">
            <path d={svgPaths.p24b67a00} fill="black" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 px-[12px] pt-[14px]">
        <div className="bg-white rounded-[20px] px-[24px] pt-[34px] pb-[40px] flex flex-col items-center">
          {/* Logo */}
          <div className="w-[136px] h-[50px] mb-[30px]">
            <img src={imgLogo21} alt="사주플랜" className="w-full h-full object-cover" />
          </div>

          {/* Inputs */}
          <input
            type="text"
            placeholder="아이디 입력"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full h-[42px] bg-[#f8f8f8] rounded-[10px] px-[15px] text-[14px] text-black placeholder-[#969696] outline-none mb-[10px]"
          />
          <input
            type="password"
            placeholder="비밀번호 입력"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full h-[42px] bg-[#f8f8f8] rounded-[10px] px-[15px] text-[14px] text-black placeholder-[#969696] outline-none mb-[12px]"
          />

          {/* Keep login & find */}
          <div className="w-full flex items-center justify-between mb-[16px]">
            <button className="flex items-center gap-[6px]" onClick={() => setKeepLogin(!keepLogin)}>
              <div className={`w-[20px] h-[20px] rounded-[5px] flex items-center justify-center ${keepLogin ? "bg-black" : "bg-white border border-[#ccc]"}`}>
                {keepLogin && (
                  <svg width="11" height="8" viewBox="0 0 11.2404 8.17535" fill="none">
                    <path d={svgPaths.p37774d00} fill="white" />
                  </svg>
                )}
              </div>
              <span className="text-[14px] text-black">로그인유지</span>
            </button>
            <a href="https://sajumoon.co.kr/bbs/password_lost.php" target="_blank" rel="noreferrer" className="text-[14px] text-[#868686] underline">
              아이디/비밀번호 찾기
            </a>
          </div>

          {/* Login button */}
          <button
            className="w-full h-[44px] bg-[#8259f5] rounded-[5px] text-white text-[14px] mb-[10px]"
            onClick={() => navigate("/")}
          >
            로그인
          </button>

          {/* Sign up button */}
          <button className="w-full h-[44px] bg-white border border-[#8259f5] rounded-[5px] text-[#8259f5] text-[14px] mb-[24px]">
            회원가입
          </button>

          {/* SNS login */}
          <p className="text-[14px] text-[#969696] mb-[16px]">SNS 간편로그인</p>
          <div className="flex items-center gap-[12px]">
            {/* Naver */}
            <button className="w-[40px] h-[40px] bg-white rounded-full flex items-center justify-center border border-[rgba(0,0,0,0.15)]">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d={svgPaths.p31c1a6c0} fill="#03A94D" fillRule="evenodd" clipRule="evenodd" />
              </svg>
            </button>
            {/* Kakao */}
            <button className="w-[40px] h-[40px] bg-[#FEE500] rounded-full flex items-center justify-center relative">
              <svg width="23" height="21" viewBox="0 0 22.4971 20.7948" fill="none">
                <path d={svgPaths.p1fb403e0} fill="#392020" />
                <path d={svgPaths.p35aae00} fill="#FEE500" />
                <path d={svgPaths.p2077e970} fill="#FEE500" />
                <path d={svgPaths.p11085b00} fill="#FEE500" />
                <path d={svgPaths.p241a9770} fill="#FEE500" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
