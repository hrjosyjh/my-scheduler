#!/bin/bash

# 색상 정의
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}==================================================${NC}"
echo -e "${BLUE}   📅 Schedule Manager Re-Installer (v2.0)       ${NC}"
echo -e "${BLUE}==================================================${NC}"

# 1. Node.js 확인
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js가 필요합니다.${NC}"
    exit 1
fi

# 2. Root Setup
echo -e "\n${BLUE}👉 [1/3] Root 프로젝트 설정...${NC}"
[ ! -f "package.json" ] && npm init -y > /dev/null
npm install concurrently --save-dev --silent

# package.json 스크립트 강제 업데이트
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json"));
pkg.scripts = {
  "start": "concurrently \"npm run server --prefix server\" \"npm run client --prefix client\"",
  "server": "npm run server --prefix server",
  "client": "npm run client --prefix client"
};
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
'

# 3. Server Setup
echo -e "\n${BLUE}👉 [2/3] Backend (Server) 설정...${NC}"
mkdir -p server && cd server
[ ! -f "package.json" ] && npm init -y > /dev/null
npm install express cors sqlite3 bcryptjs jsonwebtoken node-ical axios --silent
# 서버 실행 스크립트 추가
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json"));
pkg.scripts = { "server": "node server.js" };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
'
cd ..

# 4. Client Setup
echo -e "\n${BLUE}👉 [3/3] Frontend (Client) 설정...${NC}"
mkdir -p client && cd client
[ ! - -f "package.json" ] && npm init -y > /dev/null
# 최신 Tailwind v4 및 의존성 설치
npm install react react-dom axios @fullcalendar/react @fullcalendar/daygrid @fullcalendar/timegrid @fullcalendar/interaction tailwindcss @tailwindcss/postcss postcss autoprefixer react-icons --silent
# 클라이언트 실행 스크립트 추가
node -e '
const fs = require("fs");
const pkg = JSON.parse(fs.readFileSync("package.json"));
pkg.scripts = { "client": "vite", "dev": "vite", "build": "vite build" };
fs.writeFileSync("package.json", JSON.stringify(pkg, null, 2));
'

# 기본 설정 파일 복구 (없을 때만)
[ ! -f "postcss.config.js" ] && echo "export default { plugins: { '@tailwindcss/postcss': {}, autoprefixer: {} } }" > postcss.config.js
[ ! -f "src/index.css" ] && mkdir -p src && echo '@import "tailwindcss";' > src/index.css

cd ..

echo -e "\n${BLUE}==================================================${NC}"
echo -e "${GREEN}   ✅ 모든 환경 설정이 완료되었습니다!${NC}"
echo -e "   실행 명령: ${GREEN}npm start${NC}"
echo -e "${BLUE}==================================================${NC}"