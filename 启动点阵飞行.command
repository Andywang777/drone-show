#!/bin/bash
# 双击本文件即可启动「点阵飞行」本地服务并自动打开浏览器。
# 关闭这个终端窗口 = 停止服务。也可在项目目录执行 npm start 达到同样效果。
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR" || exit 1

if [ ! -f server.mjs ]; then
  echo "❌ 本文件需要和 server.mjs 放在同一个项目目录内。"
  echo "   当前目录：$DIR"
  echo
  read -r -n 1 -s -p "按任意键关闭窗口…"
  exit 1
fi

PORT=4178
URL="http://127.0.0.1:$PORT"

# 双击启动时继承的 PATH 很窄，这里补齐常见的 Node 安装位置
export PATH="/usr/local/bin:/opt/homebrew/bin:/opt/homebrew/opt/node/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
NODE=""
if command -v node >/dev/null 2>&1; then
  NODE="$(command -v node)"
else
  for candidate in /usr/local/bin/node /opt/homebrew/bin/node /opt/homebrew/opt/node/bin/node "$HOME"/.workbuddy/binaries/node/versions/*/bin/node; do
    if [ -x "$candidate" ]; then NODE="$candidate"; break; fi
  done
fi

if [ -z "$NODE" ]; then
  echo "❌ 未找到 Node.js。"
  echo "   请先安装 Node.js 18 或更高版本：https://nodejs.org"
  echo "   或在项目目录执行：npm start"
  echo
  read -r -n 1 -s -p "按任意键关闭窗口…"
  exit 1
fi

# 端口探测用 Node 直接连，不经过系统代理：curl 遇到代理返回的错误页时退出码仍为 0，会误判成"服务已在运行"。
port_open(){
  "$NODE" -e 'const s=require("net").connect(Number(process.argv[1]),"127.0.0.1");s.on("connect",()=>{s.destroy();process.exit(0)});s.on("error",()=>process.exit(1))' "$PORT" >/dev/null 2>&1
}

# 服务已在运行时直接打开页面，避免端口冲突
if port_open; then
  echo "✓ 服务已在运行：$URL"
  open "$URL"
  echo
  echo "（本次没有重复启动服务。需要停止请关闭原本运行服务的窗口。）"
  exit 0
fi

echo "正在启动本地服务…"
"$NODE" server.mjs &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

for _ in $(seq 1 40); do
  if port_open; then break; fi
  sleep 0.25
done

if port_open; then
  echo "✓ 已启动：$URL"
else
  echo "⚠️ 服务启动超时，请检查端口 $PORT 是否被占用。"
fi
open "$URL"
echo
echo "浏览器已打开。此窗口保持开启；关闭窗口即停止服务。"
wait "$SERVER_PID"
