FROM node:26-alpine AS building
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
ARG CI=true

RUN npm i pnpm -g
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json tsconfig.json  ./
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile
ARG VITE_API_URL=/api/v1
ENV VITE_API_URL=$VITE_API_URL
COPY . .
RUN pnpm run build 


# ---- serve: nginx serving the SPA + /api/ proxy ----
FROM nginx:1.27-alpine AS serve
ARG APP_DIR
ARG NGINX_CONF=nginx.conf
COPY --from=building /app/dist /usr/share/nginx/html
COPY ./nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80

