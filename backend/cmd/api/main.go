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

// catalogProducts converts every active Pulsa24Jam SKU into a retail item while
// retaining whether its value is fixed or must be supplied by the customer.
func catalogProducts(items []h2hr.Product) []model.Product {
	products := make([]model.Product, 0, len(items))
	seen := make(map[string]struct{}, len(items))
	for _, item := range items {
		sku := strings.ToUpper(strings.TrimSpace(item.SKU))
		name := strings.TrimSpace(item.Name)
		priceType := strings.ToUpper(strings.TrimSpace(item.PriceType))
		if sku == "" || name == "" {
			continue
		}
		if priceType == "" {
			priceType = "FIXED"
		}
		if priceType != "OPEN_AMOUNT" && item.Price <= 0 {
			continue
		}
		if _, duplicate := seen[sku]; duplicate {
			continue
		}
		seen[sku] = struct{}{}
		provider := normalizeProvider(item.Brand, item.Category, sku, name)
		category := normalizeCategory(item.Category, item.Group, name)
		price := item.Price
		if priceType != "OPEN_AMOUNT" {
			price += item.AdditionalFee
		}
		products = append(products, model.Product{
			ID: sku, Provider: provider, Name: name, Type: category,
			Price: price, Color: providerColor(provider), PriceType: priceType, Fee: item.AdditionalFee,
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
		{"HP Pascabayar", []string{"hp pascabayar", "pulsa pascabayar", "kartu halo", "halo postpaid", "xl prioritas", "indosat postpaid"}},
		{"Aktivasi Perdana", []string{"aktivasi perdana", "kartu perdana", "registrasi perdana"}},
		{"Masa Aktif", []string{"masa aktif", "tambah masa"}},
		{"Paket Telepon", []string{"paket telepon", "paket telpon", "voice package"}},
		{"Transfer Bank", []string{"bank transfer", "transfer bank", "withdrawal deposit"}},
		{"Donasi & Zakat", []string{"donasi", "zakat", "sedekah", "infaq"}},
		{"Internet & TV", []string{"indihome", "wifi", "internet rumah", "first media", "myrepublic"}},
		{"Paket Data", []string{"paket data", "internet", "kuota"}},
		{"Token PLN", []string{"token pln", "pln prepaid", "listrik prabayar"}},
		{"E-Wallet", []string{"e-wallet", "e-money", "dana", "gopay", "ovo", "linkaja", "shopeepay", "astrapay"}},
		{"Game", []string{"game", "diamond", "mobile legends", "free fire", "pubg"}},
		{"Voucher Digital", []string{"voucher", "gift card"}},
		{"TV & Streaming", []string{"streaming", "netflix", "vidio", "spotify", "wetv", "viu", "tv kabel"}},
		{"Telepon & SMS", []string{"telepon", "telpon", "sms"}},
		{"BPJS", []string{"bpjs"}},
		{"PDAM", []string{"pdam", "air minum"}},
		{"Gas", []string{"pgn", "gas negara"}},
		{"Multifinance", []string{"multifinance", "leasing", "adira", "fif", "oto finance"}},
		{"Transportasi", []string{"grab", "gojek", "maxim", "transportasi"}},
		{"Pendidikan", []string{"pendidikan", "sekolah", "universitas"}},
		{"Asuransi", []string{"asuransi", "insurance"}},
		{"Pajak", []string{"pajak", "pbb", "samsat"}},
		{"PPOB", []string{"ppob", "pascabayar", "tagihan"}},
		{"Pulsa", []string{"pulsa", "regular", "reguler"}},
	} {
		for _, term := range rule.terms {
			if strings.Contains(value, term) {
				return rule.category
			}
		}
	}
	if raw := strings.TrimSpace(category); raw != "" {
		return cleanCategoryName(raw)
	}
	if raw := strings.TrimSpace(group); raw != "" {
		return cleanCategoryName(raw)
	}
	return "Lainnya"
}

func cleanCategoryName(value string) string {
	value = strings.Join(strings.Fields(strings.ReplaceAll(value, "_", " ")), " ")
	if value == "" {
		return "Lainnya"
	}
	words := strings.Fields(strings.ToLower(value))
	for i := range words {
		if len(words[i]) > 0 {
			words[i] = strings.ToUpper(words[i][:1]) + words[i][1:]
		}
	}
	return strings.Join(words, " ")
}

func normalizeProvider(brand, category, sku, name string) string {
	brand = strings.TrimSpace(brand)
	generic := map[string]bool{"": true, "pulsa": true, "data": true, "paket data": true, "e-wallet": true, "ppob": true, "produk": true}
	if !generic[strings.ToLower(brand)] {
		return brand
	}
	value := strings.ToLower(strings.Join([]string{sku, category, name}, " "))
	providers := []struct {
		name  string
		terms []string
	}{
		{"Telkomsel", []string{"telkomsel", "tsel", "simpati", "kartu as", "by.u", "byu"}},
		{"Indosat", []string{"indosat", "im3", "mentari", "isat"}},
		{"Smartfren", []string{"smartfren", "smart", "sf"}},
		{"Axis", []string{"axis"}}, {"XL", []string{" xl ", "xlaxiata", "xtra"}},
		{"Tri", []string{" tri ", "three", "3data"}}, {"PLN", []string{"pln", "token listrik"}},
		{"DANA", []string{"dana"}}, {"GoPay", []string{"gopay"}}, {"OVO", []string{" ovo", "ovo "}},
		{"LinkAja", []string{"linkaja"}}, {"ShopeePay", []string{"shopee"}}, {"AstraPay", []string{"astrapay", "asa"}},
	}
	for _, provider := range providers {
		for _, term := range provider.terms {
			if strings.Contains(" "+value+" ", term) {
				return provider.name
			}
		}
	}
	if brand != "" {
		return brand
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
