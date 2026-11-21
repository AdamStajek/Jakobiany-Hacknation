FROM node:24-slim
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/angular.json frontend/tsconfig.json frontend/proxy.conf.json frontend/.postcssrc.json ./
COPY frontend/src ./src
CMD ["npm", "start", "--", "--host", "0.0.0.0"]
