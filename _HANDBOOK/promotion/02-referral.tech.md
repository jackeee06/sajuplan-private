# [AI 전용] 추천인 시스템 — 기술 상세

## DB

```
member
- referrer_id INT FK → member(id)  -- 자기를 추천한 사람
- referral_code VARCHAR  -- 본인 추천인 코드 (UNIQUE)

referral_log (보상 이력)
- id, referrer_id, referee_id (신규), reward_amount, created_at
```

## 가입 시 처리

```typescript
// api/src/user/auth/auth.service.ts
async signup(dto) {
  // 1. member INSERT
  if (dto.referrerCode) {
    const referrer = await this.sql`SELECT id FROM member WHERE referral_code=${dto.referrerCode}`
    if (referrer) {
      // 2. referrer_id 매칭
      await this.sql`UPDATE member SET referrer_id=${referrer.id} WHERE id=${newMemberId}`
      // 3. 양쪽 보상 적립 (free_balance)
      const reward = await this.getReferralReward()
      await this.creditFreePoints(referrer.id, reward.referrer_amount, 'referral')
      await this.creditFreePoints(newMemberId, reward.referee_amount, 'referral')
      await this.sql`INSERT INTO referral_log (referrer_id, referee_id, reward_amount) VALUES (...)`
    }
  }
}
```

## 핵심 코드 위치

- 가입 매칭: `api/src/user/auth/auth.service.ts`
- 운영자: `api/src/admin/referrals/referrals.service.ts`
- 정책 설정: `api/src/admin/referrals/referrals.service.ts:getReward()`

## 어뷰징 검사

- 같은 IP 다수 가입 시 의심
- 같은 phone 형식 (앞 6자리 동일 등)
- 추천 보상 받자마자 탈퇴

## 운영 SQL

```sql
-- 추천 보상 누적 (상위 추천자)
SELECT referrer_id, COUNT(*) AS referrals, SUM(reward_amount) AS total_reward
FROM referral_log
GROUP BY referrer_id
ORDER BY referrals DESC LIMIT 20;

-- 의심 어뷰징 (같은 phone 패턴)
SELECT SUBSTRING(phone, 1, 7) AS prefix, COUNT(*)
FROM member
WHERE referrer_id IS NOT NULL
GROUP BY prefix
HAVING COUNT(*) > 5;
```

## 관련 메모리

- 추천인 보상 정책 재검토 백로그 (운영 시작 후)
