# Frontend Dockerfile
FROM node:20-slim

WORKDIR /app
COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Use a simple server to serve the static files or just use vite preview for demo
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "5173"]
