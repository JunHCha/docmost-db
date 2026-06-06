<div align="center">
    <h1><b>Docmost-db</b></h1>
    <p>
        Notion 스타일 <b>데이터베이스(Database)</b> 기능을 더한 <a href="https://github.com/docmost/docmost"><strong>Docmost</strong></a> 포크입니다.
        <br />
        <a href="./README.md">English</a>
    </p>
</div>
<br />

> [!NOTE]
> **이 저장소는 포크(fork)입니다.**
> [`docmost/docmost`](https://github.com/docmost/docmost)을 기반으로, 위키 페이지 안에 Notion 스타일 데이터베이스 뷰(Table / Board)와 행 필터·정렬·일괄 편집 기능을 추가하는 것을 목표로 합니다.
> 원본 Docmost의 사용법·셀프호스팅은 [공식 문서](https://docmost.com/docs)를 참고하세요.

## 이 포크에서 추가하는 것

위키 페이지에 임베드할 수 있는 경량 데이터베이스 기능을 점진적으로 구현하고 있습니다.

- **Database / Table 뷰** — 영속화, 다중 뷰, 뷰 스위처, 컬럼 표시·너비 조정
- **Board (Kanban) 뷰** — Select/Status 컬럼 기준 그룹화 및 카드 드래그
- **행 필터 / 정렬** — 서버측 필터·정렬 API + 필터/정렬 빌더 툴바 UI
- **행 멀티셀렉트** — 거터 체크박스 기반 다중 선택 & 일괄 삭제

> ⚠️ 진행 중인 실험 기능입니다. 프로덕션 사용을 권장하지 않습니다.

## What does it look like

**Board (Kanban) 뷰** — `Status` 속성 기준 컬럼 그룹, 카드 속성 태그, 컬럼별 카드 수 + "+ New". 카드를 다른 컬럼으로 드래그하면 상태값이 변경됩니다.

<img width="1258" alt="Board (Kanban) view" src="https://github.com/user-attachments/assets/e63c0814-aea6-474e-a83f-127aa5fbc363" />

**Table 뷰** — 기본 표 뷰(Title + Status 컬럼). 같은 데이터가 Table/Board 탭으로 전환됩니다.

<img width="1252" alt="Table view" src="https://github.com/user-attachments/assets/421b706c-aa00-48be-b27c-5f6fdfaafa61" />

**필터 / 정렬 빌더 툴바** — 활성 개수 배지가 붙은 Filter·Sort 버튼, 타입별 값 위젯, 드래그로 정렬 순서 재배치.

<img width="1266" alt="Filter / sort builder toolbar" src="https://github.com/user-attachments/assets/e4c665b8-6ca5-4a80-aeac-b811c48ddd68" />

## QA & 버그 리포트

이 포크의 QA 과정에서 발견한 버그는 **[Docmost-db QA board](https://github.com/users/JunHCha/projects/3)** 프로젝트에서 관리합니다.

- 버그를 발견하면 [🐞 QA Bug Report](https://github.com/JunHCha/docmost-db/issues/new?template=qa_bug_report.yml) 템플릿으로 이슈를 생성해 주세요.
- 생성된 이슈는 `bug`, `qa` 라벨이 붙고 QA board에서 진행 상황을 추적합니다.

## 빠른 시작 (개발)

```bash
# 의존성 설치 (corepack 통해 pnpm 사용)
corepack enable
pnpm install

# 개발용 Postgres/Redis 기동
docker compose -f docker-compose.dev.yml up -d

# 개발 서버 실행
pnpm dev
```

원본 Docmost의 셀프호스팅·배포 절차는 [공식 문서](https://docmost.com/docs/self-hosting/development)를 따릅니다.

---

원본 Docmost의 기능·라이선스 등 상세 내용은 [영문 README](./README.md#upstream-docmost) 또는 [공식 문서](https://docmost.com/docs)를 참고하세요.
