package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"antarapulsa/backend/internal/auth"
	"antarapulsa/backend/internal/handler"
	"antarapulsa/backend/internal/store"
)

func main() {
	loadEnvFile(".env")
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	var dataStore *store.Store
	var err error
	if databaseURL := os.Getenv("DATABASE_URL"); databaseURL != "" {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		dataStore, err = store.NewPostgres(ctx, databaseURL)
		if err != nil {
			log.Fatalf("PostgreSQL tidak siap: %v", err)
		}
		defer dataStore.Close()
		log.Printf("AntaraPulsa memakai PostgreSQL")
	} else {
		dataStore = store.New()
		log.Printf("DATABASE_URL belum diatur; memakai penyimpanan sementara")
	}
	app := handler.New(dataStore, auth.New(os.Getenv("AUTH_SECURE_COOKIES") == "true"))
	log.Printf("AntaraPulsa API aktif di http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, app.Routes()); err != nil {
		log.Fatal(err)
	}
}

// loadEnvFile keeps deployment simple: system environment wins, then .env fills gaps.
func loadEnvFile(path string) {
	data, err := os.ReadFile(path)
	if err != nil {
		return
	}
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok || os.Getenv(key) != "" {
			continue
		}
		os.Setenv(strings.TrimSpace(key), strings.Trim(strings.TrimSpace(value), "\"'"))
	}
}
