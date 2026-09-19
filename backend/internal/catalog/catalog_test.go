package catalog

import "testing"

func TestSnapshotMatchesPulsa24JamDashboardExport(t *testing.T) {
	products, err := Snapshot()
	if err != nil {
		t.Fatal(err)
	}
	if len(products) != 15026 {
		t.Fatalf("want 15026 products, got %d", len(products))
	}
	fixed := 0
	seen := make(map[string]struct{}, len(products))
	for _, product := range products {
		if product.SKU == "" || product.Name == "" || product.Category == "" || product.Brand == "" {
			t.Fatalf("incomplete upstream product: %+v", product)
		}
		if _, duplicate := seen[product.SKU]; duplicate {
			t.Fatalf("duplicate SKU: %s", product.SKU)
		}
		seen[product.SKU] = struct{}{}
		if product.PriceType == "FIXED" {
			fixed++
		}
	}
	if fixed != 6246 {
		t.Fatalf("want 6246 fixed products, got %d", fixed)
	}
}
