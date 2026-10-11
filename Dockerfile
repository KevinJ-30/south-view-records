FROM node:22-bookworm-slim

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm build

ENV KRAKEN_URL=http://kraken:5000

EXPOSE 8080

CMD ["node", "dist/index.js"]
