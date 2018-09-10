FROM node:latest
RUN npm install --global speccy

WORKDIR /project

ENTRYPOINT ["speccy"]
CMD ["-h"]