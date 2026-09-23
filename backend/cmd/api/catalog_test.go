package main

import (
	"strings"
	"testing"

	"antarapulsa/backend/internal/catalog"
	"antarapulsa/backend/internal/h2hr"
	"antarapulsa/backend/internal/model"
)

func TestCatalogProductsMapsProviderCategoryAndPrice(t *testing.T) {
	got := catalogProducts([]h2hr.Product{
		{SKU: " tsel10 ", Name: "Pulsa Reguler Telkomsel 10.000", Category: "Pulsa", Brand: "Telkomsel", PriceType: "FIXED", Price: 10500, AdditionalFee: 250},
		{SKU: "xl-data", Name: "Paket Internet XL 5GB", Category: "Data", PriceType: "FIXED", Price: 25000},
	})
	if len(got) != 2 {
		t.Fatalf("want 2 products, got %d", len(got))
	}
	var pulsa, data = got[1], got[0]
	if pulsa.ID != "TSEL10" || pulsa.Provider != "Telkomsel" || pulsa.Type != "Pulsa" || pulsa.Price != 10750 {
		t.Fatalf("unexpected pulsa mapping: %+v", pulsa)
	}
	if data.Provider != "Pulsa24Jam" || data.Type != "Data" {
		t.Fatalf("unexpected data mapping: %+v", data)
	}
}

func TestGenericProviderNamesStayWithinTheirService(t *testing.T) {
	cases := []struct{ brand, category, sku, name, want string }{
		{"PDAM", "Tagihan Air", "AIR001", "PDAM TRI TIRTA ACEH", "PDAM Tri Tirta Aceh"},
		{"Multifinance", "Multifinance", "MFSMART", "SMART FINANCE", "Smart Finance"},
		{"Bank", "Transfer Bank", "DBJAGO", "BANK JAGO", "Bank Jago"},
		{"Bank", "Transfer Bank", "026", "026 BANK LIPPO", "Bank Lippo"},
		{"Bank", "Transfer Bank", "CEKDANA", "CEK NAMA DANA ELEKTRIK", "DANA"},
		{"Voucher", "Voucher Data", "NETFLIX1", "VOUCHER NETFLIX HARIAN", "Netflix"},
	}
	for _, tc := range cases {
		if got := displayProvider(tc.brand, tc.category, tc.sku, tc.name); got != tc.want {
			t.Errorf("%s: want %q, got %q", tc.sku, tc.want, got)
		}
	}
}

func TestLiveCatalogRejectsMissingFees(t *testing.T) {
	snapshot := []model.Product{{ID: "A", PriceType: "FIXED", Price: 1000}, {ID: "B", PriceType: "OPEN_AMOUNT", Fee: 1500}}
	live := []model.Product{{ID: "A", PriceType: "FIXED", Price: 1000}, {ID: "B", PriceType: "OPEN_AMOUNT", Fee: 0}}
	if liveCatalogUsable(live, snapshot) {
		t.Fatal("live catalog with missing open-amount fees must not replace snapshot")
	}
	live[1].Fee = 1500
	if !liveCatalogUsable(live, snapshot) {
		t.Fatal("complete live catalog should be usable")
	}
}

func TestCatalogProductsKeepsOpenAmountAndRejectsDuplicates(t *testing.T) {
	got := catalogProducts([]h2hr.Product{
		{SKU: "DANA", Name: "DANA bebas nominal", Category: "E-Wallet", Brand: "DANA", PriceType: "OPEN_AMOUNT", AdditionalFee: 1000},
		{SKU: "T5", Name: "Pulsa Telkomsel 5.000", Category: "Pulsa", Brand: "Telkomsel", PriceType: "FIXED", Price: 5500},
		{SKU: "t5", Name: "Duplikat", PriceType: "FIXED", Price: 5600},
		{SKU: "", Name: "Tanpa SKU", PriceType: "FIXED", Price: 1000},
	})
	if len(got) != 2 {
		t.Fatalf("want fixed and open-amount products, got %+v", got)
	}
	var foundOpen bool
	for _, product := range got {
		if product.ID == "DANA" {
			foundOpen = product.PriceType == "OPEN_AMOUNT" && product.Fee == 1000 && product.Price == 0
		}
	}
	if !foundOpen {
		t.Fatalf("open-amount metadata was not preserved: %+v", got)
	}
	if got[1].ID != "T5" || got[1].Provider != "Telkomsel" || got[1].Type != "Pulsa" {
		t.Fatalf("unexpected fixed product: %+v", got[1])
	}
}

func TestNormalizeCategories(t *testing.T) {
	cases := map[string]string{
		"Kuota internet Telkomsel": "Paket Data",
		"Token PLN 20.000":         "Token PLN",
		"Top up GoPay":             "E-Wallet",
		"BPJS Kesehatan":           "BPJS",
		"Mobile Legends diamond":   "Game",
	}
	for name, want := range cases {
		if got := normalizeCategory("", "", name); got != want {
			t.Errorf("%q: want %q, got %q", name, want, got)
		}
	}
}

func TestNormalizeCategoryPreservesOrMapsProviderCategory(t *testing.T) {
	if got := normalizeCategory("Produk Donasi", "", "Sedekah digital"); got != "Donasi & Zakat" {
		t.Fatalf("provider category should be mapped, got %q", got)
	}
	if got := normalizeCategory("Produk Khusus", "", "Layanan premium"); got != "Produk Khusus" {
		t.Fatalf("unknown provider category should remain visible, got %q", got)
	}
}

func TestCatalogHasSpecificProvidersForEveryH2HRProduct(t *testing.T) {
	items, err := catalog.Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	products := catalogProducts(items)
	if len(products) != 15026 {
		t.Fatalf("want 15026 products, got %d", len(products))
	}
	bySKU := make(map[string]model.Product, len(products))
	for _, product := range products {
		bySKU[product.ID] = product
	}
	for _, item := range items {
		product, ok := bySKU[item.SKU]
		if !ok {
			t.Fatalf("upstream SKU %s missing from retail catalog", item.SKU)
		}
		if product.Name != item.Name || product.Type != item.Category || product.PriceType != item.PriceType {
			t.Fatalf("upstream fields changed for SKU %s: %+v", item.SKU, product)
		}
		if item.PriceType == "OPEN_AMOUNT" {
			if product.Price != 0 || product.Fee != item.AdditionalFee {
				t.Fatalf("open amount fee changed for SKU %s: %+v", item.SKU, product)
			}
		} else if product.Price != item.Price+item.AdditionalFee {
			t.Fatalf("fixed price changed for SKU %s: %+v", item.SKU, product)
		}
	}
	generic := map[string]bool{"": true, "asuransi": true, "multifinance": true, "pbb": true, "paket data": true, "samsat": true, "pdam": true, "gas": true, "bank": true, "voucher": true}
	providersByCategory := map[string]map[string]struct{}{}
	for _, product := range products {
		if providersByCategory[product.Type] == nil {
			providersByCategory[product.Type] = map[string]struct{}{}
		}
		providersByCategory[product.Type][product.Provider] = struct{}{}
		if generic[strings.ToLower(strings.TrimSpace(product.Provider))] {
			t.Errorf("SKU %s still has generic provider %q", product.ID, product.Provider)
		}
	}
	for category, minimum := range map[string]int{"Bank Transfer": 80, "Transfer Bank": 100, "Tagihan Air": 300, "Multifinance": 50, "Game": 50} {
		if len(providersByCategory[category]) < minimum {
			t.Errorf("%s only has %d specific providers, want at least %d", category, len(providersByCategory[category]), minimum)
		}
	}
}
