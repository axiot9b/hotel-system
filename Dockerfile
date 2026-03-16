FROM node:20-alpine

WORKDIR /app

# Install backend dependencies
COPY backend/package*.json ./backend/
RUN npm install --prefix backend --omit=dev

# Install frontend dependencies and build
COPY frontend/package*.json ./frontend/
RUN npm install --prefix frontend

COPY frontend/ ./frontend/
RUN npm run build --prefix frontend

# Copy backend source (after frontend build so layer cache is useful)
COPY backend/ ./backend/

ENV NODE_ENV=production
EXPOSE 3001

CMD ["node", "backend/src/index.js"]
