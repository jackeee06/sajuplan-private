import { useParams } from 'react-router-dom'
import CounselorMyProductDetailLayout from '../components/CounselorMyProductDetailLayout'
import { MOCK_SERVICE_PRODUCTS } from '../data/counselorMyPage'

/**
 * 08마이페이지_상담사_서비스 상품_상세_정보
 * Figma node-id: 169:13252
 */
export default function CounselorMyProductInfo() {
  const { id = '2' } = useParams<{ id: string }>()
  const product = MOCK_SERVICE_PRODUCTS.find((p) => p.id === Number(id)) ?? MOCK_SERVICE_PRODUCTS[0]

  return (
    <CounselorMyProductDetailLayout product={product} activeTab="info">
      <p className="text-[14px] leading-[160%] text-[#4A5565] whitespace-pre-line">
        {product.introText}
      </p>
      {product.introImg && (
        <div className="mt-5 w-full rounded-[16px] overflow-hidden bg-[#F3F4F6]">
          <img src={product.introImg} alt="" className="w-full h-auto object-cover" />
        </div>
      )}
    </CounselorMyProductDetailLayout>
  )
}
