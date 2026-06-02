# [AI 전용] 쿠폰 시스템 — 기술 상세

## DB

```
coupon_zones (그룹)
- id, name, description, valid_from, valid_until, max_uses

coupons (개별 쿠폰)
- id, zone_id INT FK
- discount_type — 'percent' / 'amount'
- discount_value INT
- valid_until TIMESTAMPTZ
- used_at TIMESTAMPTZ
- member_id INT FK (사용한 회원)

member_coupons (회원 보유)
- member_id, coupon_id, granted_at, used_at
```

## 발급

```typescript
// api/src/admin/coupon-zones/coupon-zones.service.ts
async grantCoupon(zoneId, memberIds) {
  for (const memberId of memberIds) {
    await this.sql`INSERT INTO member_coupons (member_id, coupon_id, granted_at) VALUES (...)`
    // 알림톡 coupon_req_v2 (현재 사용 안 함, 사장님 결정)
  }
}
```

## 사용 (충전 시)

```typescript
async applyCouponToCharge(memberId, couponId, chargeAmount) {
  // 1. 쿠폰 유효성 검증 (유효기간, used_at, member 매칭)
  // 2. discount 계산
  // 3. 결제 금액에서 할인 적용
  // 4. member_coupons.used_at 마킹
}
```

## 핵심 코드 위치

- 운영자: `api/src/admin/coupon-zones/coupon-zones.service.ts`, `coupons.service.ts`
- 회원 사용: `api/src/user/charge/charge.service.ts`

## 메모리 박제

`[[dont-mention-coupon-req-v2]]`: 사장님이 "잊자" 결정. coupon_req_v2 알림톡 능동 언급 X.

## 운영 SQL

```sql
-- 쿠폰존별 발급/사용 통계
SELECT cz.name,
       COUNT(mc.id) AS granted,
       COUNT(mc.used_at) AS used
FROM coupon_zones cz
LEFT JOIN coupons c ON c.zone_id = cz.id
LEFT JOIN member_coupons mc ON mc.coupon_id = c.id
GROUP BY cz.id, cz.name;
```

## 관련 메모리

- `[[dont-mention-coupon-req-v2]]`
