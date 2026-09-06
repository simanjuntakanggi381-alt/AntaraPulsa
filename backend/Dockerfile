FROM golang:1.22-alpine AS build
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /antarapulsa-api ./cmd/api

FROM alpine:3.20
RUN adduser -D -H -u 10001 appuser
WORKDIR /app
COPY --from=build /antarapulsa-api ./antarapulsa-api
USER appuser
EXPOSE 8080
ENTRYPOINT ["./antarapulsa-api"]
