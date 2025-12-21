FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev --ignore-scripts

COPY . .

EXPOSE 7777

CMD ["node", "server.js"]
