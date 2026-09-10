package h2hr

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestProductCatalogueCanExceedOneMegabyte(t *testing.T) {
	largeName := strings.Repeat("produk-katalog-", 80000)
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		fmt.Fprintf(w, `{"ok":true,"items":[{"sku":"SKU1","nama":%q,"harga":1000,"tipe_harga":"FIXED"}]}`, largeName)
	}))
	defer server.Close()

	client := New(Config{URL: server.URL, APIKey: "test", PIN: "1234", Enabled: true})
	result, err := client.Call(context.Background(), Request{Commands: "PRODUK"})
	if err != nil {
		t.Fatalf("large catalogue should be readable: %v", err)
	}
	if len(result.Items) != 1 || result.Items[0].SKU != "SKU1" {
		t.Fatalf("unexpected catalogue: %+v", result.Items)
	}
}
