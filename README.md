# @joasuite/shared-ui

JoaSuite 5개 앱(JoaBooks, JoaSOP, JoaOffice, JoaApproval, JoaCRM)이 공유하는 UI, 서버 함수, i18n을 단일 패키지로 묶어 **한 번 publish → `bun update` 한 줄로 모든 앱에 동기화**되도록 만드는 패키지입니다.

> **상태: Bootstrap (v0.1.0-pre.1)**
> 이 폴더는 사용자가 새 GitHub repo (`joasuite-shared`)를 만들고 그대로 push할 수 있는 초기 스켈레톤입니다. 컴포넌트는 원본 JoaBooks 코드를 `.source.tsx` 파일로 함께 포함했고, 실제 `.tsx` export는 스텁입니다. Phase 1 refactor를 마쳐야 v0.1.0을 publish할 수 있습니다.

---

## 1. 폴더 구조

```
joasuite-shared/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── .gitignore
├── README.md  ← 이 파일
└── src/
    ├── index.ts                ← public export
    ├── constants.ts            ✅ 완료 (AppCode, APP_DISPLAY, DEFAULT_APP_URLS, ROLES_BY_APP)
    ├── types.ts                ✅ 완료 (Membership, AppCatalogEntry, TenantAppRow, …)
    ├── context.tsx             ✅ 완료 (JoaSuiteProvider, useJoaSuite, UiAdapter, RouterAdapter, BoundServerFns)
    ├── i18n-helper.ts          ✅ 완료 (mergeSharedResources, SUPPORTED_LANGUAGES)
    ├── i18n/
    │   ├── en.json             ✅ 완료 (JoaBooks에서 추출한 suite/people/account/bell/common/set)
    │   ├── ko.json             ✅
    │   ├── zh.json             ✅
    │   ├── es.json             ✅
    │   └── vi.json             ✅
    ├── components/
    │   ├── ThemeToggle.tsx     ✅ 완료 (적응 완료)
    │   ├── LanguageSwitcher.tsx ✅ 완료
    │   ├── UserBadge.tsx       ⚠️ STUB → UserBadge.source.tsx 포팅 필요
    │   ├── UserBadge.source.tsx        (JoaBooks 원본)
    │   ├── NotificationsBell.tsx ⚠️ STUB
    │   ├── NotificationsBell.source.tsx
    │   ├── SuiteSwitcher.tsx   ⚠️ STUB
    │   ├── SuiteSwitcher.source.tsx
    │   ├── SuiteHomePage.tsx   ⚠️ STUB
    │   ├── SuiteHomePage.source.tsx
    │   ├── SuiteSettingsHub.tsx ⚠️ STUB
    │   ├── SuiteSettingsHub.source.tsx
    │   └── people/
    │       ├── PeopleListPage.tsx   ⚠️ STUB + .source
    │       ├── PeopleInvitePage.tsx ⚠️ STUB + .source
    │       └── PeopleDetailPage.tsx ⚠️ STUB + .source
    └── server/
        ├── index.ts                  ⚠️ 빈 placeholder (createXxx factory들 작성 필요)
        ├── suite.functions.source.ts
        ├── suite-home.functions.source.ts
        ├── notifications.functions.source.ts
        ├── account.functions.source.ts
        └── admin.functions.source.ts
```

---

## 2. 핵심 아키텍처: Dependency Injection via Context

이 패키지는 다음을 **직접 import하지 않습니다** (각 앱마다 다르기 때문):
- 호스트 앱의 Supabase 클라이언트 (`@/integrations/supabase/client`)
- 호스트 앱의 `useAuth` 훅 (`@/lib/auth-context`)
- 호스트 앱의 shadcn 프리미티브 (`@/components/ui/*`) — 각 앱 테마와 일치해야 함
- 호스트 앱의 TanStack Router `Link` (타입이 호스트 라우트에 묶여 있음)
- 호스트 앱의 server function 미들웨어 (`requireSupabaseAuth`)

대신 각 앱은 루트에서 **한 번** `<JoaSuiteProvider>`를 호출해 이것들을 주입합니다:

```tsx
// 각 앱의 src/routes/__root.tsx 또는 src/routes/app.tsx
import { JoaSuiteProvider } from "@joasuite/shared-ui";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Link, useNavigate } from "@tanstack/react-router";
import * as ui from "@/components/ui/_barrel"; // 또는 직접 import
import * as fns from "@/lib/_joasuite-fns"; // 아래 step 3 참고

<JoaSuiteProvider
  value={{
    currentApp: "joabooks",      // JoaSOP에서는 "joasop"
    supabase,
    useAuth,
    ui: { Button: ui.Button, Input: ui.Input, /* … 전체 UiAdapter */ },
    router: { Link, useNavigate },
    fns,
    themeStorageKey: "joabooks-theme", // 앱마다 다르게 두면 테마가 앱별로 독립
  }}
>
  <Outlet />
</JoaSuiteProvider>
```

공유 컴포넌트는 내부에서 `useJoaSuite()`로 이 값을 읽습니다.

---

## 3. Server function 패턴

각 앱의 `requireSupabaseAuth` 미들웨어를 주입받는 factory 패턴:

```ts
// 패키지: src/server/suite.functions.ts (작성 필요)
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export function createListSuiteApps(deps: { requireSupabaseAuth: any }) {
  return createServerFn({ method: "POST" })
    .middleware([deps.requireSupabaseAuth])
    .inputValidator((d) => z.object({ tenantId: z.string().uuid() }).parse(d))
    .handler(async ({ data, context }) => {
      // ... JoaBooks 원본과 byte-for-byte 동일하게 ...
    });
}
```

각 앱에서:

```ts
// JoaBooks: src/lib/_joasuite-fns/index.ts
import {
  createListSuiteApps,
  createSubscribeApp,
  // ...
} from "@joasuite/shared-ui/server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const deps = { requireSupabaseAuth };

export const listSuiteApps = createListSuiteApps(deps);
export const subscribeApp = createSubscribeApp(deps);
// ...

// Then bind with useServerFn for the BoundServerFns object:
// (이건 컴포넌트가 호출 가능한 형태)
export function useBoundFns(): BoundServerFns {
  return {
    listSuiteApps: useServerFn(listSuiteApps),
    // ...
  };
}
```

---

## 4. i18n 통합

각 앱의 `src/i18n/index.ts`:

```ts
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { mergeSharedResources } from "@joasuite/shared-ui";

import en from "./locales/en.json";
import ko from "./locales/ko.json";
import zh from "./locales/zh.json";
import es from "./locales/es.json";
import vi from "./locales/vi.json";

const resources = mergeSharedResources({ en, ko, zh, es, vi });

i18n.use(initReactI18next).init({
  resources,
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
```

App-specific 키가 동일 path에서 shared 키를 덮어쓸 수 있도록 deep-merge되어 있습니다.

---

## 5. Tailwind v4 셋업

각 앱의 `src/styles.css`에 다음을 추가하면 패키지 안의 Tailwind 클래스도 빌드에 포함됩니다:

```css
@source "../node_modules/@joasuite/shared-ui/dist";
```

---

## 6. Phase 1 refactor 체크리스트 (v0.1.0 publish 전 완료)

각 `.source` 파일 → `.tsx` 본문 포팅 시 적용할 변환:

### 컴포넌트 (5개)

1. **import 변환**
   - `@/lib/auth-context` → `useJoaSuite().useAuth()`
   - `@/integrations/supabase/client` → `useJoaSuite().supabase`
   - `@/components/ui/button` 등 → `useJoaSuite().ui.Button` 등 (구조분해)
   - `@tanstack/react-router`의 `Link`, `useNavigate` → `useJoaSuite().router.Link`, `.useNavigate()`
   - `@/lib/suite.functions` 등 server fn → `useJoaSuite().fns.listSuiteApps` 등
   - `@/i18n` 의 `SUPPORTED_LANGUAGES` → 패키지의 `SUPPORTED_LANGUAGES` (이미 LanguageSwitcher 완료)

2. **`createFileRoute` 제거**
   - People/Suite 페이지 컴포넌트는 라우트가 아니라 **순수 컴포넌트**로 변환
   - `export const Route = createFileRoute(...)({ component: X })` 삭제
   - 각 앱이 자기 라우트 파일에서 `<PeopleListPage appCode="joabooks" />` 형태로 마운트

3. **하드코딩된 `"joabooks"` 제거**
   - SuiteSwitcher, SuiteHomePage: 현재 앱 비교에 `useJoaSuite().currentApp` 사용
   - DEFAULT_APP_URLS 등은 이미 `constants.ts`에서 export됨

4. **라우트 경로 처리**
   - `/app/people`, `/app/suite` 등 내부 링크는 그대로 둠 (모든 앱이 동일한 경로 사용 가정)
   - 만약 앱별로 prefix가 다르다면 `routerAdapter`에 `appPrefix` 추가

### Server functions (5개 source 파일)

1. 각 `export const xxx = createServerFn(...)...` → `export function createXxx(deps: { requireSupabaseAuth }) { return createServerFn(...).middleware([deps.requireSupabaseAuth])... }`
2. `requireSupabaseAuth` import 제거 (deps로 받음)
3. 핸들러 본문은 byte-for-byte 보존
4. `src/server/index.ts`에서 모두 re-export

### 빌드 & publish

```bash
bun install
bun run typecheck
bun run build       # dist/ 생성
git add . && git commit -m "feat: initial v0.1.0"
git tag v0.1.0
git push origin main --tags
```

각 앱에서:
```bash
bun add github:joasuite/joasuite-shared#v0.1.0
```

---

## 7. 향후 업데이트 워크플로우 (목표)

공통 코드 수정 필요 시:

1. `joasuite-shared` repo에서 수정 (로컬 or Lovable 프로젝트로 연결)
2. `bun run build`
3. 버전 bump → `git tag v0.1.1` → push
4. 각 앱에서 `bun update @joasuite/shared-ui` 또는 의존성의 `#v0.1.0` → `#v0.1.1` 변경
5. Lovable 양방향 sync가 각 앱 preview에 자동 반영

**5개 앱에 같은 프롬프트를 반복할 필요 없음.**

---

## 8. Phase 2: JoaBooks가 패키지 사용

별도 turn에서 진행:
1. `bun add github:joasuite/joasuite-shared#v0.1.0`
2. `src/i18n/index.ts`를 `mergeSharedResources` 사용으로 교체
3. `src/routes/app.tsx`에 `<JoaSuiteProvider>` 추가
4. `src/components/SuiteSwitcher.tsx`, `UserBadge.tsx`, `NotificationsBell.tsx`, `ThemeToggle.tsx`, `LanguageSwitcher.tsx` 삭제 → `@joasuite/shared-ui` import로 교체
5. `src/routes/app.people.*.tsx`, `app.suite.tsx`, `app.suite.settings.tsx` 안에 페이지 컴포넌트만 `<PeopleListPage appCode="joabooks" />` 등으로 교체
6. `src/lib/suite.functions.ts` 등 server fn 파일은 패키지 factory를 호출하는 8줄짜리 wrapper로 축소
7. Playwright로 헤더/Suite/People 시각 회귀 확인

## 9. Phase 3: JoaSOP가 패키지 사용

JoaSOP에서:
1. `bun add github:joasuite/joasuite-shared#v0.1.0`
2. Phase 2와 동일하되 `currentApp="joasop"`, `themeStorageKey="joasop-theme"` 전달
3. JoaSOP 고유 i18n과 머지

## 10. Phase 4: 신규 앱 (JoaOffice, JoaApproval, JoaCRM)

부트스트랩 시점부터 `@joasuite/shared-ui` 의존성 포함 → 시작부터 drift 0.

---

## 9. 라이센스

Private — JoaSuite 전용. 외부 공개 금지.
