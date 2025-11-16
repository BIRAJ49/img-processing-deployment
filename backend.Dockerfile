FROM node:20-alpine AS build

WORKDIR /app/server

COPY server/package*.json ./
RUN npm install --omit=dev

COPY server ./
# Include the static web assets so Express can serve them
COPY web /app/web
RUN mkdir -p /app/storage/uploads /app/storage/processed

#Runtime image 
FROM node:20-alpine

WORKDIR /app/server

# Create non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

COPY --from=build /app /app

USER appuser

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["node", "src/index.js"]
