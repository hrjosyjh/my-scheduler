# 📅 Personal Schedule Manager (나만의 일정관리 프로그램)

## 1. 프로젝트 개요
사용자별 인증 시스템을 갖춘 웹 기반 일정 관리 애플리케이션입니다. 
- **개인 일정 관리:** CRUD 및 날짜/시간 기반 할 일(To-Do) 관리.
- **외부 일정 통합:** iCal(.ics) URL 연동.
- **다국어 지원:** 한국어(Korean) / 영어(English) 전환 가능.
- **보안:** JWT 인증, 비밀번호 암호화.

## 2. 기술 스택 (Tech Stack)

### Frontend
- **Framework:** React 19 (Vite)
- **Styling:** Tailwind CSS v4 + @tailwindcss/postcss
- **Calendar:** FullCalendar v6 (DayGrid, TimeGrid, Interaction)
- **Icons:** React Icons (Fa)
- **State Management:** React useState, useEffect (LocalStorage for Auth/Lang)

### Backend
- **Runtime:** Node.js + Express.js
- **Database:** SQLite3 (File: `server/schedule.db`)
- **Security:** JWT, bcryptjs
- **External Parsing:** node-ical, axios

---

## 3. 데이터베이스 구조 (SQLite)

- **`users`**: 사용자 계정 정보 (username, password)
- **`events`**: 일정 및 할 일 데이터
    - `start`: ISO8601 포맷 (YYYY-MM-DDTHH:mm) - 시간 정보 포함
    - `allDay`: `0`(시간 지정) 또는 `1`(하루 종일)
    - `completed`: `1`(완료) 또는 `0`(미완료)
- **`external_calendars`**: 외부 iCal URL 소스

---

## 4. 설치 및 실행 (Quick Start)

### 🚀 설치 및 자동 복구
```bash
cd my-scheduler
./install_scheduler.sh
```

### 🏃 실행
```bash
npm start
```
- 접속: http://localhost:5173

---

## 5. 구현 기능 목록 (Feature List)

### ✅ 인증 (Authentication)
- 사용자 회원가입 및 로그인 (JWT 기반)
- 데이터 분리 (로그인한 사용자별 개인 일정 저장)

### ✅ 일정 관리 (Calendar)
- 월간/주간/일간 달력 보기
- 외부 일정(Google Calendar 등) iCal 연동 및 읽기 전용 표시
- 일정 클릭 시 상세 정보 확인 및 수정/삭제

### ✅ 할 일 관리 (To-Do List)
- **보기 모드 전환:** 달력(Calendar) ↔ 할 일 목록(List View)
- **퀵 등록:** 상단 입력창을 통해 제목, 날짜, 시간 입력 후 즉시 생성
- **시간 설정:** `datetime-local` 입력을 통해 구체적인 시간(시:분)까지 지정 가능
- **완료 체크:** 체크박스로 할 일 완료/미완료 상태 토글
- **달력 연동:** 시간이 지정된 할 일은 달력의 해당 시간대(TimeGrid)에 표시됨

### ✅ 사용자 편의 (UX/UI)
- **다국어 지원:** 한국어/영어 실시간 전환 (LocalStorage 저장)
- **반응형 디자인:** 모바일/데스크탑 환경 대응 (Tailwind CSS)

---

## 6. 개발 이력 (Change Log)

- **v1.0.0:** 초기 일정 관리 기능(CRUD), 백엔드 API 구축.
- **v1.1.0:** 로그인/회원가입 기능 추가, 외부 캘린더 연동.
- **v1.2.0:** 다국어(한글/영어) 지원 추가.
- **v1.3.0 (Current):** 
    - To-Do List 전용 뷰 추가.
    - 할 일 생성 시 날짜 및 시간(Time) 지정 기능 추가.
    - 달력과 To-Do 리스트 간 데이터 완전 동기화 구현.

---

## 7. 향후 개발 로드맵 (ToDo)
1. **드래그 앤 드롭:** 달력에서 일정 시간 변경 시 DB 업데이트 로직 연결.
2. **반복 일정:** 매일/매주/매월 반복되는 일정(RRule) 구현.
3. **알림 기능:** 일정 시간 임박 시 브라우저 알림 전송.
