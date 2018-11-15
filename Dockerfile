FROM node:11.1-alpine

RUN apk add --no-cache --virtual .build_deps git \
    && npm install --global speccy \
    && apk del .build_deps

WORKDIR /project

ENTRYPOINT ["speccy"]
CMD ["-h"]

