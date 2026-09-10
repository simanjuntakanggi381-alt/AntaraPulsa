package main

import (
	"testing"

	"antarapulsa/backend/internal/h2hr"
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
	if data.Provider != "XL" || data.Type != "Paket Data" {
		t.Fatalf("unexpected data mapping: %+v", data)
	}
}

func TestCatalogProductsKeepsOpenAmountAndRejectsDuplicates(t *testing.T) {
	got := catalogProducts([]h2hr.Product{
		{SKU: "DANA", Name: "DANA bebas nominal", Brand: "DANA", PriceType: "OPEN_AMOUNT", AdditionalFee: 1000},
		{SKU: "T5", Name: "Pulsa Telkomsel 5.000", PriceType: "FIXED", Price: 5500},
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
	if got[1].ID != "T5" || got[1].Provider != "Telkomsel" {
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
