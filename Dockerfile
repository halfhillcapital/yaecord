FROM node:20-alpine

WORKDIR /app
COPY . .

RUN npm ci

ENV YAE_URL=http://host.docker.internal:8010
ENV WHISPER_URL=http://host.docker.internal:8080
ENV KOKORO_URL=http://host.docker.internal:8880

# Start the application
CMD ["npm", "start"]
