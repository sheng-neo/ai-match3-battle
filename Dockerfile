# AI 大乱斗·消消乐 —— 单容器部署（参照网页版红警）：构建客户端 + 同端口托管静态与嘴炮 API。
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# 客户端构建 + 嘴炮核心转译为零依赖 ESM（供运行层直接 node 启动）
RUN npm run build \
  && npx esbuild api/_lib/tauntHandler.ts --bundle --platform=node --format=esm --outfile=server/tauntHandler.mjs

FROM node:22-slim AS run
WORKDIR /app
ENV NODE_ENV=production
# 运行层零 node_modules：只带静态产物与零依赖服务器
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
EXPOSE 8080
ENV PORT=8080
ENV STATIC_DIR=/app/dist
ENV DATA_DIR=/data
CMD ["node", "server/index.mjs"]
