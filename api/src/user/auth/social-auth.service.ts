import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { SQL, type Sql } from '../../shared/db/db.module';

export type SocialProvider = 'kakao' | 'naver';

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
}

interface SocialMemberRow {
  id: number;
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

    const meRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      method: 'GET',
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
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

    const meRes = await fetch('https://openapi.naver.com/v1/nid/me', {
      headers: { Authorization: `Bearer ${tokenJson.access_token}` },
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
   * (provider, social_uid) 로 가입된 회원 조회. 없으면 null.
   * — sample/plugin/social의 social_get_data 와 동일 역할
   */
  async findMember(
    provider: SocialProvider,
    uid: string,
  ): Promise<{ id: number } | null> {
    const found = await this.sql<SocialMemberRow[]>`
      SELECT id FROM member
       WHERE social_provider = ${provider}
         AND social_uid = ${uid}
       LIMIT 1
    `;
    if (!found[0]) return null;
    // 마지막 로그인 갱신
    await this.sql`
      UPDATE member SET last_login_at = now() WHERE id = ${found[0].id}
    `;
    return { id: found[0].id };
  }

  /**
   * 소셜 가입으로 신규 member row 생성.
   * — sample/register_member_update.php 의 신규 회원 INSERT 부분에 해당
   * — login_id/password 는 NULL (소셜 전용 계정, 로컬 로그인 불가)
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

    const inserted = await this.sql<SocialMemberRow[]>`
      INSERT INTO member (
        name, nickname, email, phone,
        birth_date, birth_time, gender, calendar_type,
        zip, addr1, addr2,
        acquisition_source,
        social_provider, social_uid, social_email, social_linked_at,
        signup_source, last_login_at
      ) VALUES (
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
