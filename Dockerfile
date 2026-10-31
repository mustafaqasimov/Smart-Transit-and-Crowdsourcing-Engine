# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS ui
WORKDIR /ui
COPY frontend/package*.json ./
RUN --mount=type=secret,id=proxy_ca if [ -f /run/secrets/proxy_ca ]; then NODE_EXTRA_CA_CERTS=/run/secrets/proxy_ca npm ci; else npm ci; fi
COPY frontend/ .
RUN npm run build
FROM maven:3.9.9-eclipse-temurin-21 AS java-build
WORKDIR /build
COPY backend/pom.xml ./
COPY scripts/maven-build.sh /usr/local/bin/transit-maven
RUN chmod +x /usr/local/bin/transit-maven
RUN --mount=type=secret,id=proxy_ca --mount=type=secret,id=maven_settings transit-maven dependency:go-offline
COPY backend/src ./src
COPY --from=ui /ui/dist ./src/main/resources/static
RUN --mount=type=secret,id=proxy_ca --mount=type=secret,id=maven_settings transit-maven package
FROM eclipse-temurin:21-jre-alpine
WORKDIR /app
COPY --from=java-build /build/target/transit-1.0.0.jar /app/transit.jar
USER 10001
EXPOSE 8000
ENTRYPOINT ["java","-jar","/app/transit.jar"]
