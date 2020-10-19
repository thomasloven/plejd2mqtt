FROM node:14-alpine3.11

ENV LANG C.UTF-8

COPY ./ /plejd

WORKDIR /plejd

RUN npm install \
  --no-optional \
  --no-audit \
  --no-update-notifier \
  --unsafe-perm

ENTRYPOINT ["node", "/plejd/main.js"]
