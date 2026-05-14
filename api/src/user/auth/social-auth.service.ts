import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export type SocialProvider = 'kakao' | 'naver' | 'apple';

export interface SocialProfile {
  uid: string; // 소셜 측 사용자 식별자 (필수)
  email: string | null; // 이메일(있을 때)
  name: string | null; // 실명(있을 때)
  nickname: string | null;
  phone: string | null;
}

interface SocialSettings {
  use: boolean;
  service_list: string[];
  kakao_rest_key: string;
  kakao_client_secret: string;
  naver_client_id: string;
  naver_secret: string;
  apple_service_id: string;   // Services ID (예: com.sajumoon.applogin) — 웹 OAuth용
  apple_bundle_id: string;    // 앱 Bundle ID (com.dmonster.sajumoon) — iOS 네이티브용
  apple_team_id: string;      // Apple Developer Team ID
  apple_key_id: string;       // .p8 Key ID (예: 8FLSV5786T)
  apple_private_key: string;  // .p8 파일 내용 (PEM)
}

interface SocialMemberRow {
  id: number;
}

interface AppleJwks {
  keys: Array<{ kid: string; [k: string]: unknown }>;
}

@Injectable()
export class SocialAuthService {
  constructor(@Inject(SQL) private readonly sql: Sql) {}

  /** setting 테이블에서 social namespace 값을 일괄 조회. */
  async getSettings(): Promise<SocialSettings> {
    const rows = await this.sql<{ key: string; value: string | null }[]>`
      SELECT key, value FROM setting WHERE namespace = 'social'
    `;
    const map: Record<string, string> = {};
    for (const r of rows) map[r.key] = r.value ?? '';
    return {
      use: map['use'] === '1' || map['use']?.toLowerCase() === 'true',
      service_list: (map['service_list'] || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      kakao_rest_key: map['kakao_rest_key'] || '',
      kakao_client_secret: map['kakao_client_secret'] || '',
      naver_client_id: map['naver_client_id'] || '',
      naver_secret: map['naver_secret'] || '',
      apple_service_id: map['apple_service_id'] || '',
      apple_bundle_id: map['apple_bundle_id'] || '',
      apple_team_id: map['apple_team_id'] || '',
      apple_key_id: map['apple_key_id'] || '',
      apple_private_key: map['apple_private_key'] || '',
    };
  }

  /**
   * 인가 URL 생성. setting의 키가 비어 있으면 503.
   */
  buildAuthorizeUrl(
    provider: SocialProvider,
    settings: SocialSettings,
    redirectUri: string,
    state: string,
  ): string {
    if (!settings.use) {
      throw new ForbiddenException('소셜 로그인이 비활성화되어 있습니다.');
    }
    if (!settings.service_list.includes(provider)) {
      throw new ForbiddenException(
        `${provider} 로그인이 활성화되어 있지 않습니다.`,
      );
    }

    if (provider === 'kakao') {
      if (!settings.kakao_rest_key) {
        throw new ServiceUnavailableException(
          'Kakao REST API Key 가 등록되어 있지 않습니다. (관리자 → 시스템 설정 → 소셜)',
        );
      }
      const u = new URL('https://kauth.kakao.com/oauth/authorize');
      u.searchParams.set('client_id', settings.kakao_rest_key);
      u.searchParams.set('redirect_uri', redirectUri);
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('state', state);
      // scope 는 의도적으로 명시하지 않는다.
      // — 콘솔 "동의항목" 에 OFF 인 항목을 명시 요청하면 invalid_scope 로 거부됨.
      // — 미지정 시 콘솔 동의항목 설정 (필수/선택) 에 따라 자동으로 동의창이 구성된다.
      // — 따라서 닉네임·이메일 수집 여부는 카카오 콘솔에서 켜고 끄면 됨 (코드 변경 불필요).
      return u.toString();
    }

    if (provider === 'apple') {
      // Apple Sign in with Apple — 웹용 OAuth (Services ID)
      // 응답은 form_post(POST) 로 직접 redirect_uri 에 옴.
      // scope=name email 요청 시 첫 동의에서만 받을 수 있고, 이후 로그인부터는 sub(uid)만 옴.
      if (!settings.apple_service_id) {
        throw new ServiceUnavailableException(
          'Apple Services ID 가 등록되어 있지 않습니다. (관리자 → 시스템 설정 → 소셜 → apple_service_id)',
        );
      }
      const u = new URL('https://appleid.apple.com/auth/authorize');
      u.searchParams.set('client_id', settings.apple_service_id);
      u.searchParams.set('redirect_uri', redirectUri);
      u.searchParams.set('response_type', 'code id_token');
      u.searchParams.set('response_mode', 'form_post');
      u.searchParams.set('scope', 'name email');
      u.searchParams.set('state', state);
      return u.toString();
    }

    // naver
    if (!settings.naver_client_id) {
      throw new ServiceUnavailableException(
        'Naver Client ID 가 등록되어 있지 않습니다. (관리자 → 시스템 설정 → 소셜)',
      );
    }
    const u = new URL('https://nid.naver.com/oauth2.0/authorize');
    u.searchParams.set('response_type', 'code');
    u.searchParams.set('client_id', settings.naver_client_id);
    u.searchParams.set('redirect_uri', redirectUri);
    u.searchParams.set('state', state);
    return u.toString();
  }

  /**
   * 인가 코드 → access_token → 사용자 프로필.
   */
  async fetchProfile(
    provider: SocialProvider,
    settings: SocialSettings,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<SocialProfile> {
    if (provider === 'kakao')
      return this.fetchKakaoProfile(settings, code, redirectUri);
    return this.fetchNaverProfile(settings, code, state, redirectUri);
  }

  private async fetchKakaoProfile(
    s: SocialSettings,
    code: string,
    redirectUri: string,
  ): Promise<SocialProfile> {
    if (!s.kakao_rest_key) {
      throw new ServiceUnavailableException(
        'Kakao REST API Key 가 등록되어 있지 않습니다. (관리자 → 시스템 설정 → 소셜 → kakao_rest_key)',
      );
    }
    const tokenForm = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: s.kakao_rest_key,
      redirect_uri: redirectUri,
      code,
    });
    if (s.kakao_client_secret) {
      tokenForm.set('client_secret', s.kakao_client_secret);
    }
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: tokenForm.toString(),
    });
    const tokenJson = (await tokenRes.json().catch(() => null)) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    } | null;
    if (!tokenJson?.access_token) {
      const detail =
        tokenJson?.error_description ||
        tokenJson?.error ||
        `HTTP ${tokenRes.status}`;
      throw new BadRequestException(
        `Kakao 토큰 교환 실패: ${detail}. 카카오 콘솔의 Redirect URI 와 client_secret(설정 시) 이 일치하는지 확인해주세요.`,
      );
    }

    return this.fetchKakaoProfileFromAccessToken(tokenJson.access_token);
  }

  /**
   * RN 네이티브 SDK 가 발급한 access_token 으로 프로필 조회.
   * 모바일 앱(webview + 네이티브 카카오 SDK) 경로에서 사용.
   * — 인가코드→토큰 교환 단계가 SDK 안에서 끝나므로 /me 만 호출.
   * — 토큰의 유효성/앱 일치는 /me 200 응답 자체로 확인됨 (잘못된 토큰이면 401).
   */
  async fetchKakaoProfileFromAccessToken(
    accessToken: string,
  ): Promise<SocialProfile> {
    if (!accessToken) {
      throw new BadRequestException('access_token 누락');
    }
    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      throw new BadRequestException(`Kakao 프로필 조회 실패 (${meRes.status})`);
    }
    const me = (await meRes.json()) as {
      id: number | string;
      properties?: { nickname?: string };
      kakao_account?: {
        email?: string;
        email_needs_agreement?: boolean;
        profile?: { nickname?: string };
        profile_nickname_needs_agreement?: boolean;
        name?: string;
        phone_number?: string;
      };
    };
    if (!me.id) {
      throw new BadRequestException('Kakao 응답에 id 없음');
    }
    // 카카오 v2 API 반환 정책:
    //  - profile.nickname / email — 사용자 동의(콘솔 동의항목 활성화 + 사용자 동의창에서 체크) 필요
    //  - name / phone_number — 사업자 검증을 통과한 앱만 받을 수 있음 (일반 앱은 거의 null)
    return {
      uid: String(me.id),
      email: me.kakao_account?.email ?? null,
      name: me.kakao_account?.name ?? null,
      nickname:
        me.kakao_account?.profile?.nickname ?? me.properties?.nickname ?? null,
      phone: me.kakao_account?.phone_number ?? null,
    };
  }

  private async fetchNaverProfile(
    s: SocialSettings,
    code: string,
    state: string,
    redirectUri: string,
  ): Promise<SocialProfile> {
    if (!s.naver_client_id || !s.naver_secret) {
      throw new ServiceUnavailableException(
        'Naver Client ID/Secret 이 등록되어 있지 않습니다. (관리자 → 시스템 설정 → 소셜 → naver_secret)',
      );
    }
    const tokenUrl = new URL('https://nid.naver.com/oauth2.0/token');
    tokenUrl.searchParams.set('grant_type', 'authorization_code');
    tokenUrl.searchParams.set('client_id', s.naver_client_id);
    tokenUrl.searchParams.set('client_secret', s.naver_secret);
    tokenUrl.searchParams.set('redirect_uri', redirectUri);
    tokenUrl.searchParams.set('code', code);
    tokenUrl.searchParams.set('state', state);
    const tokenRes = await fetch(tokenUrl.toString());
    const tokenJson = (await tokenRes.json().catch(() => null)) as {
      access_token?: string;
      error?: string;
      error_description?: string;
    } | null;
    if (!tokenJson?.access_token) {
      const detail =
        tokenJson?.error_description ||
        tokenJson?.error ||
        `HTTP ${tokenRes.status}`;
      throw new BadRequestException(
        `Naver 토큰 교환 실패: ${detail}. 관리자 시스템 설정의 naver_client_id/secret 과 네이버 콘솔의 Callback URL 이 일치하는지 확인해주세요.`,
      );
    }

    return this.fetchNaverProfileFromAccessToken(tokenJson.access_token);
  }

  /**
   * RN 네이티브 SDK 가 발급한 access_token 으로 네이버 프로필 조회.
   * 모바일 앱(@react-native-seoul/naver-login) 경로에서 사용.
   */
  async fetchNaverProfileFromAccessToken(
    accessToken: string,
  ): Promise<SocialProfile> {
    if (!accessToken) {
      throw new BadRequestException('access_token 누락');
    }
    const meRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!meRes.ok) {
      throw new BadRequestException(`Naver 프로필 조회 실패 (${meRes.status})`);
    }
    const wrap = (await meRes.json()) as {
      resultcode?: string;
      response?: {
        id?: string;
        email?: string;
        name?: string;
        nickname?: string;
        mobile?: string;
      };
    };
    const me = wrap.response;
    if (!me?.id) {
      throw new BadRequestException('Naver 응답에 id 없음');
    }
    return {
      uid: me.id,
      email: me.email ?? null,
      name: me.name ?? null,
      nickname: me.nickname ?? null,
      phone: me.mobile ?? null,
    };
  }

  /**
   * Apple identityToken(JWT) 검증.
   * — Apple JWKS(https://appleid.apple.com/auth/keys) 으로 RS256 서명 검증
   * — iss = https://appleid.apple.com
   * — aud = 네이티브: 앱 Bundle ID / 웹: Services ID
   * — exp / iat 시간 검증
   * 반환: SocialProfile (uid=sub, email)
   *
   * audType:
   *   - 'native' → settings.apple_bundle_id 매칭 (RN AppleAuthentication)
   *   - 'web'    → settings.apple_service_id 매칭 (Services ID, OAuth form_post)
   */
  async verifyAppleIdentityToken(
    settings: SocialSettings,
    identityToken: string,
    audType: 'native' | 'web',
    extra?: { name?: string | null; email?: string | null },
  ): Promise<SocialProfile> {
    if (!identityToken) {
      throw new BadRequestException('identityToken 누락');
    }
    const expectedAud =
      audType === 'web' ? settings.apple_service_id : settings.apple_bundle_id;
    if (!expectedAud) {
      throw new ServiceUnavailableException(
        `Apple ${audType === 'web' ? 'Services ID' : 'Bundle ID'} 가 등록되어 있지 않습니다. (관리자 → 시스템 설정 → 소셜 → apple_${audType === 'web' ? 'service_id' : 'bundle_id'})`,
      );
    }

    // JWT 헤더 파싱 (kid 추출)
    const parts = identityToken.split('.');
    if (parts.length !== 3) {
      throw new BadRequestException('Apple identityToken 형식 오류');
    }
    let header: { kid?: string; alg?: string };
    let payload: {
      iss?: string;
      aud?: string;
      sub?: string;
      email?: string;
      email_verified?: boolean | string;
      exp?: number;
      iat?: number;
      nonce?: string;
    };
    try {
      header = JSON.parse(
        Buffer.from(parts[0], 'base64url').toString('utf8'),
      ) as typeof header;
      payload = JSON.parse(
        Buffer.from(parts[1], 'base64url').toString('utf8'),
      ) as typeof payload;
    } catch {
      throw new BadRequestException('Apple identityToken 파싱 실패');
    }
    if (!header.kid || header.alg !== 'RS256') {
      throw new BadRequestException('Apple identityToken 헤더가 올바르지 않습니다.');
    }

    // JWKS 조회 + 캐시
    const jwk = await this.getApplePublicKey(header.kid);
    // node:crypto 로 PEM 변환 후 검증
    const { createPublicKey, createVerify } = await import('node:crypto');
    const pubKey = createPublicKey({ key: jwk, format: 'jwk' });
    const verify = createVerify('RSA-SHA256');
    verify.update(`${parts[0]}.${parts[1]}`);
    verify.end();
    const sigBuf = Buffer.from(parts[2], 'base64url');
    if (!verify.verify(pubKey, sigBuf)) {
      throw new BadRequestException('Apple identityToken 서명 검증 실패');
    }

    // 클레임 검증
    const now = Math.floor(Date.now() / 1000);
    if (payload.iss !== 'https://appleid.apple.com') {
      throw new BadRequestException('Apple identityToken iss 불일치');
    }
    if (payload.aud !== expectedAud) {
      throw new BadRequestException(
        `Apple identityToken aud 불일치 (expected=${expectedAud}, got=${payload.aud})`,
      );
    }
    if (!payload.exp || payload.exp < now - 60) {
      throw new BadRequestException('Apple identityToken 만료됨');
    }
    if (!payload.sub) {
      throw new BadRequestException('Apple identityToken sub 누락');
    }

    return {
      uid: payload.sub,
      email: extra?.email ?? payload.email ?? null,
      name: extra?.name ?? null, // Apple은 첫 동의 이후 name을 보내지 않음 — 클라가 전달
      nickname: extra?.name ?? null,
      phone: null,
    };
  }

  // Apple JWKS 캐시 (10분)
  private appleJwks: AppleJwks | null = null;
  private appleJwksAt = 0;
  private async getApplePublicKey(kid: string): Promise<Record<string, unknown>> {
    const TTL_MS = 10 * 60 * 1000;
    const now = Date.now();
    if (!this.appleJwks || now - this.appleJwksAt > TTL_MS) {
      const res = await fetch('https://appleid.apple.com/auth/keys');
      if (!res.ok) {
        throw new ServiceUnavailableException('Apple JWKS 조회 실패');
      }
      this.appleJwks = (await res.json()) as AppleJwks;
      this.appleJwksAt = now;
    }
    const k = this.appleJwks?.keys.find((x) => x.kid === kid);
    if (!k) {
      // 캐시 무효화하고 1회 재시도
      this.appleJwks = null;
      const res = await fetch('https://appleid.apple.com/auth/keys');
      this.appleJwks = (await res.json()) as AppleJwks;
      this.appleJwksAt = Date.now();
      const k2 = this.appleJwks?.keys.find((x) => x.kid === kid);
      if (!k2) {
        throw new BadRequestException(`Apple JWKS 에 kid=${kid} 없음`);
      }
      return k2;
    }
    return k;
  }

  /**
   * 소셜 가입자 조회. mb_id 단일 식별 정책에 따라 mb_id = '<uid>_K|N|A' 우선 매칭.
   * 백필 안 된 옛 row 호환을 위해 (provider, social_uid) 도 fallback 매칭.
   */
  async findMember(
    provider: SocialProvider,
    uid: string,
  ): Promise<{ id: number } | null> {
    const suffix =
      provider === 'kakao' ? '_K' :
      provider === 'naver' ? '_N' :
      provider === 'apple' ? '_A' : '_S';
    const mbId = `${uid}${suffix}`;

    // (1) 신규 식별: mb_id
    const byMbId = await this.sql<SocialMemberRow[]>`
      SELECT id FROM member WHERE mb_id = ${mbId} LIMIT 1
    `;
    if (byMbId[0]) {
      await this.sql`UPDATE member SET last_login_at = now() WHERE id = ${byMbId[0].id}`;
      return { id: byMbId[0].id };
    }

    // (2) 폴백: (provider, social_uid) — 옛 데이터 호환
    const found = await this.sql<SocialMemberRow[]>`
      SELECT id FROM member
       WHERE social_provider = ${provider}
         AND social_uid = ${uid}
       LIMIT 1
    `;
    if (!found[0]) return null;
    // 호환 조회된 회원에게 mb_id 백필
    await this.sql`
      UPDATE member SET mb_id = ${mbId}, last_login_at = now()
       WHERE id = ${found[0].id} AND mb_id IS NULL
    `;
    return { id: found[0].id };
  }

  /**
   * 소셜 가입으로 신규 member row 생성.
   * — sample/register_member_update.php 의 신규 회원 INSERT 부분에 해당
   * — mb_id/password 는 NULL (소셜 전용 계정, 로컬 로그인 불가)
   * — name/nickname NOT NULL → 폼 값 우선, 없으면 프로필 fallback
   * — phone 중복은 application 로직 — 호출자가 사전 검사
   */
  async createSocialMember(
    provider: SocialProvider,
    uid: string,
    socialEmail: string | null,
    form: {
      name: string;
      nickname: string;
      email: string | null;
      phone: string | null;
      birth_date: string | null; // 'YYYY-MM-DD' or null
      birth_time: string | null;
      gender: 'M' | 'F' | null;
      calendar_type: 'SOLAR' | 'LUNAR' | null;
      zip: string | null;
      addr1: string | null;
      addr2: string | null;
      acquisition_source: string | null;
    },
  ): Promise<{ id: number }> {
    const nickname = await this.uniqueNickname(form.nickname);
    const name = form.name.slice(0, 50);

    // mb_id 단일 컬럼 식별 정책: 소셜 가입자도 mb_id 자동 부여
    //   카카오: <uid>_K / 네이버: <uid>_N / 애플: <uid>_A
    const suffix =
      provider === 'kakao' ? '_K' :
      provider === 'naver' ? '_N' :
      provider === 'apple' ? '_A' : '_S';
    const mbId = `${uid}${suffix}`;

    const inserted = await this.sql<SocialMemberRow[]>`
      INSERT INTO member (
        mb_id,
        name, nickname, email, phone,
        birth_date, birth_time, gender, calendar_type,
        zip, addr1, addr2,
        acquisition_source,
        social_provider, social_uid, social_email, social_linked_at,
        signup_source, last_login_at
      ) VALUES (
        ${mbId},
        ${name}, ${nickname}, ${form.email}, ${form.phone},
        ${form.birth_date}, ${form.birth_time}, ${form.gender}, ${form.calendar_type},
        ${form.zip}, ${form.addr1}, ${form.addr2},
        ${form.acquisition_source},
        ${provider}, ${uid}, ${socialEmail}, now(),
        ${`social:${provider}`}, now()
      )
      RETURNING id
    `;
    return { id: inserted[0].id };
  }

  /** nickname UNIQUE 컨스트레인트는 없지만 사용자 식별을 위해 충돌 회피. */
  private async uniqueNickname(base: string): Promise<string> {
    const trimmed = base.replace(/\s+/g, '').slice(0, 30) || '회원';
    for (let i = 0; i < 10; i++) {
      const candidate = i === 0 ? trimmed : `${trimmed}${i}`;
      const exists = await this.sql<{ exists: boolean }[]>`
        SELECT EXISTS(
          SELECT 1 FROM member WHERE nickname = ${candidate}
        ) AS exists
      `;
      if (!exists[0].exists) return candidate;
    }
    // 마지막 fallback: 충돌 가능성 거의 없는 랜덤 suffix
    return `${trimmed}_${Math.random().toString(36).slice(2, 8)}`;
  }
}
