FROM node:26-alpine AS building
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true
WORKDIR /app

RUN npm i pnpm -g
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json  ./
COPY ./drizzle drizzle
COPY ./drizzle.config.ts drizzle.config.ts
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .
RUN pnpm  run build 

ENV NODE_ENV=production
ENV PORT=4000
ENV HOST=0.0.0.0


EXPOSE 4000
RUN npm i tsx -g
# apps/api "start" script -> node dist/server.js
CMD ["sh", "-c", "npm run db:migrate && tsx /app/dist/server.js"]
