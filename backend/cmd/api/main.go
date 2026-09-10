package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"sort"
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
	products := catalogProducts(response.Items)
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

// catalogProducts converts Pulsa24Jam's live catalogue into safe retail items.
// OPEN_AMOUNT products need an amount/min/max flow and must never be charged as
// if their administration fee were the product price, so the first production
// purchase flow deliberately exposes fixed-price SKUs only.
func catalogProducts(items []h2hr.Product) []model.Product {
	products := make([]model.Product, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		sku := strings.ToUpper(strings.TrimSpace(item.SKU))
		name := strings.TrimSpace(item.Name)
		priceType := strings.ToUpper(strings.TrimSpace(item.PriceType))
		if sku == "" || name == "" || item.Price <= 0 || priceType == "OPEN_AMOUNT" {
			continue
		}
		if _, duplicate := seen[sku]; duplicate {
			continue
		}
		seen[sku] = struct{}{}
		provider := normalizeProvider(item.Brand, item.Category, name)
		category := normalizeCategory(item.Category, item.Group, name)
		products = append(products, model.Product{
			ID: sku, Provider: provider, Name: name, Type: category,
			Price: item.Price + item.AdditionalFee, Color: providerColor(provider),
		})
	}
	sort.Slice(products, func(i, j int) bool {
		if products[i].Type != products[j].Type {
			return products[i].Type < products[j].Type
		}
		if products[i].Provider != products[j].Provider {
			return products[i].Provider < products[j].Provider
		}
		if products[i].Price != products[j].Price {
			return products[i].Price < products[j].Price
		}
		return products[i].ID < products[j].ID
	})
	return products
}

func normalizeCategory(category, group, name string) string {
	value := strings.ToLower(strings.Join([]string{category, group, name}, " "))
	for _, rule := range []struct {
		category string
		terms    []string
	}{
		{"Paket Data", []string{"paket data", "internet", "kuota"}},
		{"Token PLN", []string{"token pln", "pln prepaid", "listrik prabayar"}},
		{"E-Wallet", []string{"e-wallet", "e-money", "dana", "gopay", "ovo", "linkaja", "shopeepay", "astrapay"}},
		{"Game", []string{"game", "diamond", "mobile legends", "free fire", "pubg"}},
		{"Voucher", []string{"voucher"}},
		{"PPOB", []string{"ppob", "pascabayar", "bpjs", "pdam", "tagihan"}},
		{"Pulsa", []string{"pulsa", "regular", "reguler"}},
	} {
		for _, term := range rule.terms {
			if strings.Contains(value, term) {
				return rule.category
			}
		}
	}
	return "Lainnya"
}

func normalizeProvider(brand, category, name string) string {
	if value := strings.TrimSpace(brand); value != "" {
		return value
	}
	value := strings.ToLower(strings.Join([]string{category, name}, " "))
	for _, provider := range []string{"Telkomsel", "Indosat", "Smartfren", "LinkAja", "ShopeePay", "AstraPay", "GoPay", "DANA", "OVO", "PLN", "Axis", "XL", "Tri"} {
		if strings.Contains(value, strings.ToLower(provider)) {
			return provider
		}
	}
	if value := strings.TrimSpace(category); value != "" {
		return value
	}
	return "Pulsa24Jam"
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
