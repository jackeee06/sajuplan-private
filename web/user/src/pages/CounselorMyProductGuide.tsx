import { useParams } from 'react-router-dom'
import CounselorMyProductDetailLayout from '../components/CounselorMyProductDetailLayout'
import {
  MOCK_SERVICE_PRODUCTS,
  PRODUCT_GUIDE_FOOTNOTE,
  PRODUCT_GUIDE_RETURN_NG,
  PRODUCT_GUIDE_RETURN_OK,
  PRODUCT_GUIDE_SHIPPING,
} from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_서비스 상품_상세_안내
 * Figma node-id: 172:12479
 *
 * 배송정보 / 교환·반품 정책 (가능 / 불가능 / 주의)
 */
export default function CounselorMyProductGuide() {
  const { id = '2' } = useParams<{ id: string }>()
  const product = MOCK_SERVICE_PRODUCTS.find((p) => p.id === Number(id)) ?? MOCK_SERVICE_PRODUCTS[0]

  return (
    <CounselorMyProductDetailLayout product={product} activeTab="guide">
      <Section title="배송정보">
        <BulletList items={PRODUCT_GUIDE_SHIPPING} />
      </Section>

      <Section title="교환/반품" className="mt-6">
        <SubTitle>교환 및 반품이 가능한 경우</SubTitle>
        <BulletList items={PRODUCT_GUIDE_RETURN_OK} />

        <SubTitle className="mt-4">교환 및 반품이 불가능한 경우</SubTitle>
        <BulletList items={PRODUCT_GUIDE_RETURN_NG} />

        <p className="mt-4 text-[13px] leading-[150%] text-[#4A5565] whitespace-pre-line">
          {PRODUCT_GUIDE_FOOTNOTE}
        </p>
      </Section>
    </CounselorMyProductDetailLayout>
  )
}

function Section({
  title,
  className,
  children,
}: {
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={className}>
      <h3 className="text-[16px] font-bold text-[#030712]">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  )
}

function SubTitle({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <p className={`text-[14px] font-semibold text-[#1E2939] ${className ?? ''}`}>{children}</p>
  )
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-1.5">
      {items.map((it) => (
        <li key={it} className="flex text-[13px] leading-[150%] text-[#4A5565]">
          <span className="mr-1 shrink-0">•</span>
          <span className="flex-1 break-keep">{it}</span>
        </li>
      ))}
    </ul>
  )
}
