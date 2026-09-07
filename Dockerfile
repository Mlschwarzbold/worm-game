FROM node:22-alpine AS manifest

WORKDIR /build
COPY . .
RUN node scripts/generate-level-manifest.js

FROM nginx:1.27-alpine

COPY --from=manifest /build /usr/share/nginx/html

EXPOSE 80
