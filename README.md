# PointKey React MVP

React + TypeScript + Vite 기반의 PointKey MVP입니다.

## 기능
- 시나리오별 참고 이미지 업로드
- 이미지 클릭으로 포인트 좌표 지정
- 조이스틱 버튼으로 미세 이동
- WinTitle / Window Text / Hotkey / Action Mode 입력
- AHK v2 코드 실시간 생성
- `.ahk` 파일 다운로드
- localStorage 자동 저장

## 실행
```bash
npm install
npm run dev
```

## 빌드
```bash
npm run build
npm run preview
```

## 구조
- `src/App.tsx`: 전체 앱
- `src/styles.css`: 스타일

## 메모
- 현재 버전은 클라이언트 단독 앱입니다.
- 업로드 이미지는 브라우저 메모리와 localStorage에 저장됩니다.
- 아주 큰 이미지를 많이 저장하면 브라우저 저장 용량 제한에 걸릴 수 있습니다.
