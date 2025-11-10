FROM node:20-alpine

WORKDIR /usr/src/app

# Install build tools required for native modules (e.g., sqlite3)
RUN apk add --no-cache python3 make g++

COPY package*.json ./

RUN npm ci --omit=dev

COPY . .

ENV NODE_ENV=production
ENV PORT=3000
ENV USE_MOCK_MAX_API=true

EXPOSE 3000

CMD ["npm", "start"]

