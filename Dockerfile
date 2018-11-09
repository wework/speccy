FROM node:11.1-stretch
RUN npm install --global speccy

WORKDIR /project

ENTRYPOINT ["speccy"]
CMD ["-h"]

