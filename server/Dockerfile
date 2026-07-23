# ── Stage 1: Build React ──────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ ./
RUN NODE_OPTIONS=--max_old_space_size=4096 npm run build

# ── Stage 2: Run Express Server ───────────────────────
FROM node:20-alpine

# Required for bcrypt native bindings
RUN apk add --no-cache python3 make g++

WORKDIR /app/server
COPY server/package*.json ./
RUN npm install --production
COPY server/ ./

# Copy React build from Stage 1
COPY --from=builder /app/client/build /app/client/build

# Create upload directories
RUN mkdir -p uploads/students uploads/school-logo

EXPOSE 5000
CMD ["node", "server.js"]
