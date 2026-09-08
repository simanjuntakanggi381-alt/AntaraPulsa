package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"antarapulsa/backend/internal/auth"
	"antarapulsa/backend/internal/h2hr"
	"antarapulsa/backend/internal/handler"
	"antarapulsa/backend/internal/model"
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
	syncH2HRProducts(dataStore)
	app := handler.New(dataStore, auth.New(os.Getenv("AUTH_SECURE_COOKIES") == "true", os.Getenv("AUTH_SESSION_SECRET")))
	log.Printf("AntaraPulsa API aktif di http://localhost:%s", port)
	if err := http.ListenAndServe(":"+port, app.Routes()); err != nil {
		log.Fatal(err)
	}
}

func syncH2HRProducts(dataStore *store.Store) {
	client := h2hr.New(h2hr.ConfigFromEnv())
	if !h2hr.ConfigFromEnv().Ready() {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	response, err := client.Call(ctx, h2hr.Request{Commands: "PRODUK"})
	if err != nil {
		log.Printf("sinkronisasi katalog H2HR dilewati: %v", err)
		return
	}
	products := make([]model.Product, 0, len(response.Items))
	for _, item := range response.Items {
		if item.SKU == "" || item.Name == "" {
			continue
		}
		provider := item.Brand
		if provider == "" {
			provider = item.Category
		}
		if provider == "" {
			provider = "Pulsa24Jam"
		}
		category := item.Category
		if category == "" {
			category = item.Group
		}
		if category == "" {
			category = "Lainnya"
		}
		products = append(products, model.Product{ID: item.SKU, Provider: provider, Name: item.Name, Type: category, Price: item.Price + item.AdditionalFee, Color: providerColor(provider)})
	}
	if len(products) == 0 {
		log.Printf("sinkronisasi katalog H2HR tidak menemukan SKU aktif")
		return
	}
	if err := dataStore.ReplaceProducts(products); err != nil {
		log.Printf("sinkronisasi katalog H2HR gagal disimpan: %v", err)
		return
	}
	log.Printf("katalog H2HR tersinkron: %d SKU aktif", len(products))
}

func providerColor(provider string) string {
	for _, pair := range []struct{ match, color string }{{"telkomsel", "#ef3340"}, {"indosat", "#f6c700"}, {"xl", "#2f49d1"}, {"tri", "#ff6b35"}, {"pln", "#19a7ce"}, {"dana", "#1687e0"}, {"gopay", "#00aed6"}, {"ovo", "#4c3cc9"}} {
		if strings.Contains(strings.ToLower(provider), pair.match) {
			return pair.color
		}
	}
	return "#178e69"
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
