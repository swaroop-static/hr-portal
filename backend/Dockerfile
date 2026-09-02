# Stage 1 — install production dependencies and generate Prisma client
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci --omit=dev
RUN npx prisma generate

# Stage 2 — runtime image
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/node_modules/.prisma ./node_modules/.prisma
COPY . .

RUN mkdir -p uploads/resumes

EXPOSE 5000

# Run migrations then start (works with both SQLite and PostgreSQL via DATABASE_URL)
CMD ["sh", "-c", "npx prisma db push && node src/index.js"]
