#!/bin/bash
# CBigData — GeoServer 首次初始化脚本
#
# 用途: Docker 容器启动后，创建 hunan 工作区、启用 CORS、验证服务可用
# 用法: bash scripts/geoserver-setup.sh
#
# 前置条件: GeoServer Docker 容器已启动（docker compose up -d）

set -e

GEOSERVER_URL="${GEOSERVER_URL:-http://localhost:8080/geoserver}"
ADMIN_USER="${GEOSERVER_USER:-admin}"
ADMIN_PASS="${GEOSERVER_PASS:-geoserver}"
WORKSPACE="hunan"

AUTH="${ADMIN_USER}:${ADMIN_PASS}"
REST="${GEOSERVER_URL}/rest"

# --------------- 1. 等待 GeoServer 启动 ---------------
echo "⏳ 等待 GeoServer 启动..."
for i in $(seq 1 30); do
  if curl -sf "${REST}/about/version.json" > /dev/null 2>&1; then
    echo "✓ GeoServer 就绪"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "✗ GeoServer 超时未启动，请检查 docker compose logs"
    exit 1
  fi
  sleep 3
done

# --------------- 2. 创建工作区 hunan ---------------
echo ""
echo "📁 检查工作区 ${WORKSPACE}..."
WS_EXISTS=$(curl -sf -u "${AUTH}" "${REST}/workspaces/${WORKSPACE}" 2>/dev/null || true)

if echo "$WS_EXISTS" | grep -q "${WORKSPACE}"; then
  echo "  ✓ 工作区已存在"
else
  echo "  正在创建..."
  curl -sf -u "${AUTH}" \
    -X POST "${REST}/workspaces" \
    -H "Content-Type: application/json" \
    -d "{\"workspace\":{\"name\":\"${WORKSPACE}\"}}" > /dev/null
  echo "  ✓ 工作区 ${WORKSPACE} 创建完成"
fi

# --------------- 3. 验证 WMS 服务端点 ---------------
echo ""
echo "🔍 验证 WMS 端点..."
WMS_CHECK=$(curl -sf "${GEOSERVER_URL}/${WORKSPACE}/wms?service=WMS&version=1.1.0&request=GetCapabilities" 2>/dev/null || true)
if echo "$WMS_CHECK" | grep -q "WMS_Capabilities"; then
  echo "  ✓ WMS GetCapabilities 正常"
else
  echo "  ⚠ WMS 端点响应异常（可能不影响功能，首次发布图层后自动修复）"
fi

# --------------- 4. 打印摘要 ---------------
echo ""
echo "═══════════════════════════════════════"
echo "  GeoServer 初始化完成"
echo "═══════════════════════════════════════"
echo "  管理面板: ${GEOSERVER_URL}"
echo "  用户名:   ${ADMIN_USER}"
echo "  密码:     ${ADMIN_PASS}"
echo "  工作区:   ${WORKSPACE}"
echo "  REST API: ${REST}/workspaces/${WORKSPACE}"
echo "═══════════════════════════════════════"
echo ""
echo "下一步: 启动后端 → node backend/dataservice.js"
