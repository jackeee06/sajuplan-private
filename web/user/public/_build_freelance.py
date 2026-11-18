# -*- coding: utf-8 -*-
"""소프트웨어 개발 프리랜서(도급) 용역계약서 docx 생성."""
import docx
from docx.shared import Pt, RGBColor, Cm
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT

DST = '프리랜서계약서_레슨북.docx'
d = docx.Document()

# 기본 글꼴
st = d.styles['Normal']
st.font.name = 'Malgun Gothic'
st.font.size = Pt(10.5)
st._element.rPr.rFonts.set(docx.oxml.ns.qn('w:eastAsia'), 'Malgun Gothic')

def para(text='', size=10.5, bold=False, align=None, space_before=0, space_after=4, color=None):
    p = d.add_paragraph()
    if align: p.alignment = align
    pf = p.paragraph_format
    pf.space_before = Pt(space_before); pf.space_after = Pt(space_after)
    pf.line_spacing = 1.5
    r = p.add_run(text)
    r.font.size = Pt(size); r.bold = bold
    r.font.name = 'Malgun Gothic'
    r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:eastAsia'), 'Malgun Gothic')
    if color: r.font.color.rgb = RGBColor(*color)
    return p

def article(no, title, lines):
    para(f'제 {no} 조 [{title}]', size=11, bold=True, space_before=8, space_after=2)
    for ln in lines:
        para(ln, space_after=2)

# ---- 제목 ----
para('소프트웨어 개발 프리랜서 용역계약서', size=18, bold=True,
     align=WD_ALIGN_PARAGRAPH.CENTER, space_after=14)

# ---- 전문 ----
para('레슨북(이하 “갑”이라 한다)과 아래 용역수행자(이하 “을”이라 한다)는 '
     '“갑”이 의뢰하는 소프트웨어 개발·운영 용역의 수행에 관하여 다음과 같이 계약을 체결하고, '
     '이를 증명하기 위하여 계약서 2부를 작성하여 각각 1부씩 보관한다.', space_after=10)

# ---- 본문 조항 ----
article(1, '목적', [
 '본 계약은 “갑”이 의뢰하는 소프트웨어 개발 용역(이하 “본 용역”)을 “을”이 독립한 사업자의 지위에서 '
 '수행함에 있어 필요한 제반 사항과 당사자 간의 권리·의무를 정함을 목적으로 한다.',
])

article(2, '용역의 내용 및 범위', [
 '(1) “을”이 수행할 본 용역의 구체적 내용·산출물·범위는 별첨 「업무명세서」에 따른다.',
 '(2) “을”은 “갑”이 운영하는 레슨북 서비스(골프레슨 예약·매칭, 매장 키오스크 및 매장관리 시스템)에 투입되어 합의된 개발·운영 업무를 수행한다.',
 '(3) 별첨에 명시되지 아니한 경미한 추가 업무는 상호 협의하여 정한다.',
])

article(3, '계약기간', [
 '(1) 본 계약의 기간은 20  년    월    일부터 20  년    월    일까지로 한다.',
 '(2) 기간 만료 7일 전까지 일방의 서면 통지가 없으면 동일 조건으로 갱신된 것으로 본다.',
])

article(4, '용역대금 및 지급', [
 '(1) 본 용역의 대금은 금              원(부가가치세 별도, 또는 월              원)으로 한다.',
 '(2) “갑”은 「소득세법」에 따른 사업소득에 대하여 원천징수세(소득세 3% 및 지방소득세 0.3%, 합계 3.3%)를 '
 '공제한 후 “을”이 지정한 계좌로 지급한다.',
 '(3) 지급 시기·방법 등 세부 사항은 별첨 또는 상호 협의에 따른다.',
])

article(5, '계약의 성격 (근로관계의 부존재)', [
 '(1) 본 계약은 독립한 사업자 간의 도급(위임) 계약으로서, “을”은 “갑”의 지휘·감독을 받는 근로자가 아니다.',
 '(2) 본 계약은 「근로기준법」상 근로계약이 아니므로, “을”에 대하여는 4대 사회보험(국민연금·건강보험·고용보험·산재보험)의 '
 '사업장 가입, 퇴직금, 연차유급휴가, 주휴수당 등 근로관계에 따른 규정이 적용되지 아니한다.',
 '(3) “을”은 본 용역 대가에 대한 종합소득세 신고 등 자신의 납세의무를 스스로 이행한다.',
])

article(6, '업무수행 방식', [
 '(1) “을”은 본 용역을 자신의 전문적 재량과 책임 하에 독립적으로 수행하며, 근무 장소·시간에 구속되지 아니한다.',
 '(2) “을”은 본 용역의 비밀유지 및 품질에 지장을 주지 아니하는 범위에서 다른 업무(타 회사 재직·겸업·다른 용역)를 '
 '병행할 수 있다.',
 '(3) “갑”은 산출물의 진행 상황 및 결과에 관하여 “을”에게 협의·확인을 요청할 수 있다.',
])

article(7, '결과물의 귀속 및 저작권', [
 '(1) 본 용역의 수행 과정에서 발생한 모든 산출물(소스코드·문서·설계서 등)의 소유권 및 저작재산권은 '
 '용역대금 완납과 동시에 “갑”에게 귀속된다.',
 '(2) “을”은 “갑”에 대하여 저작인격권을 행사하지 아니한다.',
 '(3) “을”은 본 용역 완료 시 산출물 일체를 “갑”에게 인도한다.',
])

article(8, '비밀유지', [
 '(1) “을”은 본 용역과 관련하여 알게 된 “갑” 및 그 고객의 기술상·영업상 비밀을 “갑”의 사전 동의 없이 '
 '제3자에게 누설하거나 본 용역 외의 목적으로 사용하지 아니한다.',
 '(2) 본 조의 의무는 계약 종료 후에도 유효하다.',
])

article(9, '계약의 해지', [
 '(1) 일방이 본 계약상 의무를 위반하고 상대방의 시정 요구 후 7일 이내에 시정하지 아니한 경우, '
 '상대방은 계약을 해지할 수 있다.',
 '(2) 해지 시 “을”은 해지일까지 수행한 용역의 산출물을 “갑”에게 인도하고, “갑”은 그에 상응하는 대금을 지급한다.',
])

article(10, '손해배상', [
 '“갑”과 “을”은 본 계약상 의무를 위반하여 상대방에게 손해를 입힌 경우 그 손해를 배상한다.',
])

article(11, '권리·의무의 양도금지', [
 '“을”은 “갑”의 사전 서면 동의 없이 본 계약상의 권리·의무를 제3자에게 양도하거나 재위탁할 수 없다.',
])

article(12, '분쟁의 해결 및 관할', [
 '(1) 본 계약에 정하지 아니한 사항은 관계 법령 및 상관습에 따르며, 필요 시 상호 협의하여 정한다.',
 '(2) 본 계약에 관한 분쟁은 상호 협의로 해결하되, 협의가 이루어지지 아니할 경우 서울중앙지방법원을 '
 '관할 법원으로 한다.',
])

para('본 계약의 성립을 증명하기 위하여 “갑”과 “을”은 본 계약서에 서명 또는 기명날인한다.',
     space_before=10, space_after=2)
para('20      년        월        일', align=WD_ALIGN_PARAGRAPH.CENTER, space_after=10)

# ---- 당사자 표 ----
def party_table(title, rows):
    para(title, size=11, bold=True, space_before=6, space_after=2)
    t = d.add_table(rows=len(rows), cols=2)
    t.style = 'Table Grid'
    t.alignment = WD_TABLE_ALIGNMENT.LEFT
    for i, (k, v) in enumerate(rows):
        c0 = t.cell(i, 0); c1 = t.cell(i, 1)
        c0.width = Cm(4); c1.width = Cm(12)
        c0.paragraphs[0].add_run(k).bold = True
        c1.paragraphs[0].add_run(v)
        for c in (c0, c1):
            for p in c.paragraphs:
                for r in p.runs:
                    r.font.size = Pt(10); r.font.name = 'Malgun Gothic'
                    r._element.rPr.rFonts.set(docx.oxml.ns.qn('w:eastAsia'), 'Malgun Gothic')
    return t

party_table('“갑” (용역 의뢰자 / 레슨북)', [
 ('상호', '［레슨북 발주측 — 추후 기입］'),
 ('사업자등록번호', '［추후 기입］'),
 ('주소', '［추후 기입］'),
 ('대표자', '                                              (서명 또는 인)'),
 ('연락처', '［추후 기입］'),
])

party_table('“을” (용역 수행자 / 프리랜서)', [
 ('성명', '                                              (서명 또는 인)'),
 ('생년월일(주민등록번호)', ''),
 ('주소', ''),
 ('연락처', ''),
 ('입금계좌', ''),
])

# ---- 별첨 안내 ----
para('붙임. 업무명세서(투입 프로젝트·역할·산출물·기간) 1부.  끝.',
     size=10, space_before=10, color=(0x5b, 0x64, 0x72))

d.save(DST)
print('SAVED', DST)
