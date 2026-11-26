# 공부 일지 뷰어

Node.js 24에서 `pnpm install --frozen-lockfile` 후 `pnpm dev`로 시작한다. 로컬 주소는 `http://localhost:4321/TIL/`이다. 배포와 같은 정적 파일은 `pnpm build`로 만들고 `pnpm preview`로 확인한다.

워크스페이스에서 `apps/web`은 읽기 화면과 로컬 편집기, `apps/reviewer`는 PR 댓글과 병합 처리를 담당한다. 두 앱은 `libs/journal`의 글 규격을 공유한다. 글별 `content/posts/YYYY-MM-DD/NN/` 폴더에 작성자의 `title.md`, 병합 후 생성되는 `review.md`, 첨부 이미지용 `assets/`를 모은다. 첫 글이나 사진을 저장하면 편집기가 해당 폴더를 만든다.

| 바꾸려는 것 | 위치 |
| --- | --- |
| 공부 글과 첫 이미지 | `content/posts/YYYY-MM-DD/NN/title.md`, 같은 폴더의 `assets/` · [글 작성 규격](writing.md) |
| 분야 이름과 설명 | `content/categories.yml` |
| 기록 목록, 학습 현황, 글 상세 | `apps/web/src/pages/index.astro`, `growth.astro`, `notes/[...id].astro` |
| 로컬 글쓰기와 이미지 드롭 | `apps/web/src/editor/` |
| 아티클메이트 이름과 리뷰 항목 | `libs/journal/review.js` |
| 공통 메뉴, 최신 글 카드, 리뷰 대화 | `apps/web/src/components/` |
| 글 정렬, 중복 분야 집계, 리뷰 결합 | `apps/web/src/lib/notes.js` |
| Markdown 이미지와 본문·리뷰 구분 | `apps/web/src/lib/markdown.js` |
| 색·간격·반응형 레이아웃 | `apps/web/src/styles/site.css` |
| 검색, 분야 미리보기, 글 목차 | `apps/web/src/scripts/` |

페이지는 빌드 때 글과 리뷰를 읽는다. 같은 글에 분야가 두 개면 각 분야 목록에 한 번씩 표시하고 전체 글 수는 한 번만 센다. 브라우저는 완성된 HTML과 해당 화면의 조작에 필요한 스크립트를 받는다.

## GitHub Pages

저장소의 **Settings → Pages → Build and deployment → Source**에서 **GitHub Actions**를 선택한다. `main`의 뷰어나 글이 바뀌면 `pages.yml`이 `apps/web/dist/`를 배포한다. 같은 워크플로에서 병합한 글의 리뷰와 README 목차를 한 커밋에 저장한 뒤 그 상태를 한 번 배포한다. 수동 배포는 Actions의 **공부 일지 Pages 배포 → Run workflow**에서 실행한다.

사이트 주소와 프로젝트 경로는 `apps/web/astro.config.mjs`의 `site`, `base`로 관리한다. 글 주소는 `notes/YYYY-MM-DD/NN/`이다. 예전에 날짜 폴더 바로 아래에 작성한 글은 기존 주소인 `notes/YYYY-MM-DD/`에서 열린다.
