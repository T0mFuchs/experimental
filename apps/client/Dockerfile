FROM node:20-alpine as base
ARG CLIENT_PORT
ARG SERVER_PORT
ARG HOST_NAME
ENV VITE_CLIENT_PORT=$CLIENT_PORT
ENV VITE_SERVER_PORT=$SERVER_PORT
ENV VITE_HOST_NAME=$HOST_NAME

WORKDIR /app
COPY apps/client .

RUN yarn global add pnpm
RUN pnpm i
RUN pnpm run build
RUN pnpm prune --prod
RUN yarn global remove pnpm

FROM node:20-alpine as runner
ARG CLIENT_PORT
ARG SERVER_PORT
ARG HOST_NAME
ENV VITE_CLIENT_PORT=$CLIENT_PORT
ENV VITE_SERVER_PORT=$SERVER_PORT
ENV VITE_HOST_NAME=$HOST_NAME
ENV NODE_ENV=production
WORKDIR /app
COPY --from=base /app/dist dist
COPY --from=base /app/node_modules node_modules
COPY --from=base /app/index.js .
COPY --from=base /app/package.json .
CMD node index.js
EXPOSE $CLIENT_PORT:$CLIENT_PORT
