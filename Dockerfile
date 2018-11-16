FROM node:11.1-alpine as builder

WORKDIR /opt/speccy

COPY . /opt/speccy/

ENV NODE_ENV=production

RUN apk add --no-cache git \
    && npm install

FROM node:11.1-alpine

COPY --from=builder /opt/speccy/ /opt/speccy/

RUN ln -s /opt/speccy/speccy.js /usr/local/bin/speccy

WORKDIR /project

ENTRYPOINT ["speccy"]
CMD ["-h"]

