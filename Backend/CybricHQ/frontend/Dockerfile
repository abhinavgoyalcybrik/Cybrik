# frontend/Dockerfile (use Node >= 20.9 for Next.js)
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --legacy-peer-deps

# Copy source and build
COPY . .
RUN npm run build

# Runner stage
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app ./
EXPOSE 3000
CMD ["npm", "run", "start"]
