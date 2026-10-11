# 단축키 입력 · Obsidian Shortcut Capture

Windows 데스크톱 Obsidian에서 누른 키 조합을 원래 텍스트 위치에 입력합니다. Ctrl+A를 누르고 **삽입**을 선택하면 원문에 `` `Ctrl+A` ``가 들어갑니다.

커서 위의 작은 한 줄 팝업에서 **키 조합 / 취소 / 삽입 / ×**를 표시합니다. 배경만 반투명하며 글자와 버튼은 선명합니다. Obsidian 테마를 따릅니다.

## BRAT 설치

1. Obsidian의 커뮤니티 플러그인에서 **BRAT**을 설치하고 활성화합니다.
2. BRAT 설정에서 **Add beta plugin**을 선택합니다.
3. `tlatndms2-droid/obsidian-shortcut-capture`를 입력하고 **Latest version**을 선택한 뒤 **Add plugin**을 누릅니다.
4. 커뮤니티 플러그인 목록에서 **단축키 입력**이 활성화됐는지 확인합니다.

[최신 Release](https://github.com/tlatndms2-droid/obsidian-shortcut-capture/releases/latest)의 `main.js`, `manifest.json`, `styles.css`를 Vault의 `.obsidian/plugins/shortcut-capture-sandbox/`에 넣어 수동 설치할 수도 있습니다. 내부 ID는 기존 Sandbox 설치와의 호환을 위해 유지합니다.

## 사용 방법

1. 입력할 위치에 커서를 놓거나 교체할 글자를 선택합니다.
2. 명령 팔레트에서 **단축키 입력: 단축키 입력**을 실행합니다.
3. 원하는 키 조합을 누른 다음 **삽입**을 누릅니다.
4. 커서는 삽입한 문자열 뒤로 돌아갑니다. **Ctrl+Z**로 삽입 또는 교체를 되돌립니다.

설정 → 단축키에서 **단축키 입력** 명령에 실행 키를 지정할 수 있습니다. 기본 실행 키는 강제하지 않습니다. 실행에 사용한 키는 모두 뗀 뒤 새 조합을 누르세요.

- `←`는 취소, `→`는 삽입 버튼을 선택합니다. 선택 후 Enter는 해당 버튼을 실행합니다.
- 버튼 선택 전 Enter와 Esc는 캡처 대상입니다. Esc로 팝업을 닫지 않습니다.
- 취소, ×, 바깥 클릭은 원문을 바꾸지 않습니다.
- 같은 누름 사이클의 최대 조합을 유지합니다. 모두 뗀 뒤 새 입력을 누르면 이전 결과를 교체합니다.
- 원래 입력 위치가 사라지거나 글이 변경됐다면 안전하게 삽입을 중단합니다.

## 확인한 입력 영역

Obsidian 1.12.7 및 1.14.4의 격리 Sandbox에서 확인했습니다.

| 영역 | 확인한 결과 |
|---|---|
| Markdown 본문 | 삽입, 선택 교체, 커서 복귀, Ctrl+Z |
| Canvas 텍스트 카드 | 삽입, 선택 교체, 포커스 복귀, Ctrl+Z, 카드 저장 |
| Canvas 그룹명 · 검색창 | 선택 교체, 커서 복귀, Ctrl+Z |
| 노트 상단 제목 · 파일 탐색기 이름 변경 | 이름 확정 전 선택 교체, 커서 복귀, Ctrl+Z |

파일 이름 확정 후의 이름 변경 자체를 되돌리는 기능은 제공하지 않습니다. Windows가 선점하는 키 조합은 강제 캡처하지 않습니다. 실제 Windows 한/영 입력 상태는 사용자 확인이 남아 있으며, Process와 물리 키 코드를 이용한 모의 입력만 확인했습니다. 제3자 플러그인 입력창과 별도 팝아웃 창은 검증하지 않았습니다.

외부 API, 전역 키 감지, 입력 이력, 클립보드 사용, 추가 설정 화면과 리본 버튼은 없습니다.

## 개발

```sh
npm install
npm run check
npm test
npm run build
```

빌드 결과는 `main.js`입니다. 배포 파일은 `main.js`, `manifest.json`, `styles.css`입니다.
