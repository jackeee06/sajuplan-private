// 분야별 풀이 (직업·연애·재물·건강) — 사주 데이터에서 결정적으로 도출하는 장문 해석 콘텐츠.
// 마케팅 핵심: 일반인이 가장 보고 싶어하는 부분. 여러 신호(십성그룹·격국·신강약·용신·오행·신살·배우자궁)를 엮어 길게. (참고용 해석)
import type { ManseChart } from "@manse/engine";

type Group = "비겁" | "식상" | "재성" | "관성" | "인성";

function groupCounts(chart: ManseChart): Record<Group, number> {
  const g: Record<Group, number> = { 비겁: 0, 식상: 0, 재성: 0, 관성: 0, 인성: 0 };
  for (const t of chart.analysis.tenGods) {
    if (t.tenGod === "비견" || t.tenGod === "겁재") g.비겁 += t.count;
    else if (t.tenGod === "식신" || t.tenGod === "상관") g.식상 += t.count;
    else if (t.tenGod === "편재" || t.tenGod === "정재") g.재성 += t.count;
    else if (t.tenGod === "편관" || t.tenGod === "정관") g.관성 += t.count;
    else if (t.tenGod === "편인" || t.tenGod === "정인") g.인성 += t.count;
  }
  return g;
}

function dominant(g: Record<Group, number>): Group {
  return (Object.keys(g) as Group[]).sort((a, b) => g[b] - g[a])[0]!;
}

const ORGAN: Record<string, string> = {
  목: "간·담·근육·눈", 화: "심장·소장·혈압", 토: "비위·소화기", 금: "폐·대장·기관지·피부", 수: "신장·방광·뼈·생식기",
};

// 직업 — 그룹별 장문
const JOB: Record<Group, string> = {
  관성: "조직·공직·관리직처럼 책임과 질서가 분명한 환경에서 인정받습니다. 법률·군경·행정·공기업·대기업 등 체계가 잡힌 곳에서 차근차근 위로 올라가는 힘이 있고, 맡은 자리를 끝까지 지키는 성실함이 결국 평판으로 돌아옵니다.",
  식상: "기획·표현·예술·교육·언론처럼 자기 생각을 밖으로 펼치는 일에서 빛납니다. 틀에 갇히기보다 자기 콘텐츠로 승부하는 창작·1인 사업·강연·방송이 잘 맞고, 없던 것을 새로 만들어내는 재능이 가장 큰 무기입니다.",
  재성: "사업·금융·유통·영업·무역처럼 실질적인 이익과 숫자를 다루는 현장에서 강합니다. 사람과 돈을 동시에 움직이는 감각이 좋아 영업·투자·자영업에서 성과를 내고, 현실 감각과 추진력이 돋보입니다.",
  인성: "학문·연구·교육·의료·상담·종교처럼 전문 지식과 자격을 기반으로 한 분야가 어울립니다. 배움을 깊이 쌓아 한 분야의 전문가가 되는 길이 유리하고, 자격증·학위·면허가 곧 경쟁력이 됩니다.",
  비겁: "독립·전문직·프리랜서·동업처럼 자기 주도로 일하는 구조에서 능력이 터집니다. 남 밑에서보다 내 이름을 걸고 하는 일에서 동기부여가 크고, 경쟁이 있는 환경일수록 오히려 더 분발하는 기질입니다.",
};

const YONGSIN_FIELD: Record<string, string> = {
  목: "교육·출판·목재·섬유·디자인·기획",
  화: "방송·예술·전기·전자·IT·요식",
  토: "부동산·건축·중개·농업·관리",
  금: "금융·기계·의료·법률·귀금속",
  수: "무역·유통·물류·수산·연구",
};

export interface DomainReading { key: string; icon: string; title: string; text: string; tip: string; }

export function domainReadings(chart: ManseChart): DomainReading[] {
  const g = groupCounts(chart);
  const dom = dominant(g);
  const male = chart.input.gender === "M";
  const sinsal = chart.analysis.sinsal.map((s) => s.name);
  const has = (n: string) => sinsal.includes(n);
  const els = chart.analysis.elements;
  const lack = els.filter((e) => e.level === "부족").map((e) => e.element);
  const over = els.filter((e) => e.level === "과다").map((e) => e.element);
  const st = chart.analysis.strength;
  const strong = st.ratio >= 0.5;
  const spouseStar: Group = male ? "재성" : "관성";
  const spouseCnt = g[spouseStar];
  const palaceTG = chart.pillars.day.branchTenGod; // 일지(배우자궁) 십성
  const dayChung = chart.analysis.hapchung.some((r) => r.type === "충" && r.row === "branch" && r.pillars.includes("day"));
  const dayHap = chart.analysis.hapchung.some((r) => (r.type === "육합" || r.type === "삼합") && r.pillars.includes("day"));

  // ── 직업운 ──
  const jobParts: string[] = [
    `십성으로 보면 **${dom}**의 기운이 가장 두드러집니다. ${JOB[dom]}`,
    `격국은 **${chart.analysis.gyeokguk}**으로 그 색채가 더해지고, ${strong
      ? "일간이 힘이 있어 본인이 직접 일을 끌고 가는 주도적인 자리에서 만족도가 높습니다."
      : "일간이 다소 약한 편이라 좋은 동료·조직·스승의 도움을 받을 때 훨씬 멀리 갑니다."}`,
    `기운의 균형을 돕는 용신이 **${st.yongsin}**이라, ${YONGSIN_FIELD[st.yongsin] ?? "본인 기운을 보완하는"} 계열과 인연을 더하면 일의 흐름이 한결 매끄러워집니다.`,
  ];
  let jobSin = "";
  if (has("역마살")) jobSin += "역마가 있어 이동·출장·해외·영업·운수와 인연이 깊고 한곳에 묶이지 않는 일이 잘 맞습니다. ";
  if (has("문창귀인") || has("학당귀인") || has("문곡귀인")) jobSin += "문창·학당의 학문성이 있어 시험·자격·연구·교육 분야에서 유리합니다. ";
  if (has("화개살")) jobSin += "화개가 있어 예술·종교·학술처럼 깊이 파고드는 전문 분야에 재능이 있습니다. ";
  if (has("괴강살") || has("양인살") || has("백호살")) jobSin += "괴강·양인의 강한 기세로 전문 기술·의료·군경·결단이 필요한 일에서 두각을 드러냅니다. ";
  if (has("천을귀인")) jobSin += "천을귀인이 있어 결정적인 순간 윗사람·귀인의 도움을 받습니다. ";
  if (jobSin) jobParts.push(jobSin.trim());

  // ── 애정운 ──
  const loveParts: string[] = [];
  if (spouseCnt >= 2) loveParts.push(`배우자성(${spouseStar})이 뚜렷해 인연의 기회가 많고 애정 표현도 적극적인 편입니다. 다만 마음이 여러 곳으로 향하기 쉬워, 한 사람에게 집중하는 진중함이 오래가는 인연을 만듭니다.`);
  else if (spouseCnt === 1) loveParts.push(`배우자성(${spouseStar})이 적정해 한 사람과 안정적이고 깊은 인연을 만들어가는 사주입니다. 급하게 서두르기보다 신뢰를 쌓아갈 때 관계가 단단해집니다.`);
  else loveParts.push(`배우자성(${spouseStar})이 약한 편이라 인연이 다소 늦게 오거나, 본인이 먼저 마음을 표현하는 적극성이 큰 도움이 됩니다. 인연은 숫자가 아니라 깊이로 채워가는 유형입니다.`);
  loveParts.push(`배우자궁(일지)이 **${palaceTG}**의 성향이라, 그런 결을 지닌 상대와 특히 잘 맞고 끌립니다. ${strong
    ? "본인이 관계를 이끄는 편이니, 상대를 배려하는 여유를 더하면 좋습니다."
    : "상대를 받아주고 맞춰주는 편이니, 내 마음도 분명히 표현하는 연습이 관계를 건강하게 합니다."}`);
  let loveSin = "";
  if (has("도화살") || has("홍염살")) loveSin += "도화·홍염의 매력이 있어 이성에게 인기가 따르고 첫인상이 좋습니다. ";
  if (has("천을귀인")) loveSin += "귀인의 덕으로 어려울 때 도와주는 인연을 만납니다. ";
  if (dayChung) loveSin += "배우자궁에 충이 있어 관계에 변동·이별수가 닿을 수 있으니, 큰 결정은 충분히 대화한 뒤가 안전합니다. ";
  else if (dayHap) loveSin += "배우자궁에 합이 있어 정이 깊고 잘 맞는 인연을 만나기 쉽습니다. ";
  if (loveSin) loveParts.push(loveSin.trim());

  // ── 재물운 ──
  const jaeCnt = g.재성;
  const wealthParts: string[] = [];
  if (jaeCnt >= 2 && !strong) wealthParts.push("재성은 강한데 일간이 다소 약한 **재다신약(財多身弱)** 구조입니다. 돈을 벌고 싶은 욕심과 기회는 크지만, 내 그릇보다 큰 욕심·과로·보증은 오히려 화가 되기 쉽습니다. 무리한 확장보다 건강과 내실을 먼저 챙길 때 재물이 따릅니다.");
  else if (jaeCnt >= 2) wealthParts.push("재성이 강하고 일간도 든든히 받쳐주는 **재왕신왕** 구조에 가까워, 재물을 직접 키우고 굴리는 힘이 좋습니다. 사업·투자·자영업 등 본인이 판을 짜는 방식에서 큰 성과를 낼 수 있는 유형입니다.");
  else if (jaeCnt === 1) wealthParts.push("재성이 적정해 한 번에 크게 버는 형보다 꾸준한 수입과 안정적인 축적에 강합니다. 무리한 투기보다 성실한 본업·저축이 재산을 불리는 가장 빠른 길입니다.");
  else wealthParts.push("재성이 약한 편이라 큰 한방을 노리기보다 전문성·실력·신용으로 쌓아가는 안정형 재물운입니다. 내 분야의 권위를 높이면 돈은 그 뒤를 따라옵니다.");
  if (g.식상 >= 1 && jaeCnt >= 1) wealthParts.push("식상이 재성을 생하는 **식상생재(食傷生財)**의 흐름이 있어, 내 아이디어·재능·노력이 직접 돈으로 연결되는 힘이 좋습니다.");
  if (g.비겁 >= 3) wealthParts.push("다만 비겁이 많아 경쟁·동업·지출로 돈이 새기 쉬운 **군겁쟁재**의 기운이 있으니, 금전 거래와 보증은 특히 신중해야 합니다.");

  // ── 건강운 ──
  const healthParts: string[] = [];
  const cautions = [...new Set([...over, ...lack])].map((el) => `**${el}**(${ORGAN[el]})`);
  if (cautions.length > 0) healthParts.push(`오행 균형을 보면 ${cautions.join(", ")} 계통을 평소 꾸준히 살피는 것이 좋습니다. 과다한 기운은 항진을, 부족한 기운은 허약을 부르기 쉬우니 생활 습관으로 균형을 맞추면 큰 무리가 없습니다.`);
  else healthParts.push("오행이 비교적 고르게 분포해 특정 장부에 큰 치우침이 적은, 무난한 건강 바탕을 타고났습니다. 기본적인 규칙적 생활만 지켜도 건강을 잘 유지합니다.");
  if (chart.analysis.hapchung.some((r) => r.type === "충" || r.type === "형")) healthParts.push("지지에 충·형이 있어 사고·수술·급성 질환 등 갑작스러운 변화에 미리 대비하면 좋습니다.");
  if (has("백호살") || has("양인살") || has("현침살")) healthParts.push("백호·양인·현침의 강한 기운이 있어 칼·날카로운 도구·교통 등 외상에 한 번 더 주의하면 안심입니다.");
  if (!strong) healthParts.push("일간이 약한 편이라 무리한 과로보다 충분한 휴식과 체력 관리가 평생의 자산이 됩니다.");

  return [
    { key: "job", icon: "💼", title: "직업운", text: jobParts.join(" "), tip: `용신 ${st.yongsin} 기운의 분야·환경을 가까이하세요.` },
    { key: "love", icon: "💖", title: "애정운", text: loveParts.join(" "), tip: spouseCnt === 0 ? "먼저 다가가는 적극성이 인연을 앞당깁니다." : "진심을 표현하는 솔직함이 관계를 단단히 합니다." },
    { key: "wealth", icon: "💰", title: "재물운", text: wealthParts.join(" "), tip: jaeCnt >= 2 && !strong ? "욕심보다 내실·건강을 먼저 챙기세요." : "본업의 전문성을 높이면 돈이 따라옵니다." },
    { key: "health", icon: "🩺", title: "건강운", text: healthParts.join(" "), tip: "치우친 오행 계통을 생활 습관으로 보완하세요." },
  ];
}
