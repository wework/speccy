FROM node:11.1-alpine as builder

WORKDIR /opt/speccy

COPY . /opt/speccy/

ENV NODE_ENV=production

# Ignore version locking to avoid undesired breaks due to changes in upstream
# hadolint ignore=DL3018
RUN apk add --no-cache git \
    && npm install

FROM node:11.1-alpine

COPY --from=builder /opt/speccy/ /opt/speccy/

RUN ln -s /opt/speccy/speccy.js /usr/local/bin/speccy

WORKDIR /project

EXPOSE 5000
ENTRYPOINT ["speccy"]
CMD ["-h"]

